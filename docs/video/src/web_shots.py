#!/usr/bin/env python3
"""Real screenshots of the source pages the film cites (docs/SOURCES.md S1, S3, S5, S6), 1440 px wide.

For each page: dismiss cookie banners, scroll the key sentence into view, save a viewport PNG and the key phrase's
box (for the highlighter sweep) to docs/video/assets/web/<id>.png / .json.

  uv run --with playwright python docs/video/src/web_shots.py [S1 S3 ...]
"""
import json, sys
from pathlib import Path
from playwright.sync_api import sync_playwright

OUT = Path(__file__).resolve().parents[1] / 'assets/web'
PAGES = {
    'S1': ('https://www.who.int/news-room/fact-sheets/detail/falls', ['second-leading cause of unintentional injury deaths']),  # page now cites 842 000 (2023 GHE); film quotes the rank only
    'S3': ('https://www.medicaleconomics.com/view/patients-aren-t-doing-their-physical-therapy-homework', ['76% did not complete all of their assigned at-home physical therapy exercises']),
    'S5': ('https://en.wikipedia.org/wiki/Language_acquisition_by_deaf_children', ['at least 90% of deaf children are born to hearing parents']),
    'S6': ('https://cpr.heart.org/en/resources/cpr-facts-and-stats', ['most often occurs in homes/residences (73.4%)']),
}
UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
DISMISS = ['Accept all', 'Accept All', 'Accept All Cookies', 'Accept', 'I Accept', 'I agree', 'Agree', 'Allow all', 'OK', 'Got it', 'Close']
KILL_BANNERS = """() => { for (const el of document.querySelectorAll('body *')) { const cs = getComputedStyle(el);
  if ((cs.position === 'fixed' || cs.position === 'sticky') && /cookie|privacy|consent|partners/i.test(el.innerText || '')
      && el.getBoundingClientRect().top > 200) el.remove();
  if (cs.position === 'fixed' && el.getBoundingClientRect().top > 150) el.remove(); }
  document.querySelectorAll('iframe').forEach(f => { if (f.getBoundingClientRect().top > 150) f.remove(); }); }"""
FIND = """(needles) => {
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n; while ((n = w.nextNode())) {
    for (const s of needles) { const i = n.data.indexOf(s); if (i < 0) continue;
      const el = n.parentElement; const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || !el.offsetParent) continue;
      if (window.__scroll) el.scrollIntoView({block: 'center'});
      const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + s.length);
      const rects = [...r.getClientRects()].filter(q => q.width > 2).map(q => ({x: q.x, y: q.y, w: q.width, h: q.height}));
      return {text: n.data.trim(), needle: s, rects};
    } }
  return null; }"""

def shoot(b, sid, url, needles, ua):
    ctx = b.new_context(viewport={'width': 1440, 'height': 900}, device_scale_factor=1.5, user_agent=ua, locale='en-US')
    pg = ctx.new_page()
    pg.goto(url, wait_until='commit', timeout=60000)
    pg.wait_for_timeout(8000)
    for t in DISMISS:
        try:
            btn = pg.get_by_role('button', name=t, exact=True)
            if btn.count() and btn.first.is_visible():
                btn.first.click(timeout=1500); pg.wait_for_timeout(600)
        except Exception:
            pass
    for t in DISMISS[:7]:
        try:
            loc = pg.get_by_text(t, exact=True)
            if loc.count() and loc.first.is_visible():
                loc.first.click(timeout=1500); pg.wait_for_timeout(600)
        except Exception:
            pass
    hit = None
    for _ in range(4):  # scroll the sentence to the middle, let the page settle, measure; retry if it moved away
        pg.evaluate('window.__scroll = true'); pg.evaluate(FIND, needles); pg.wait_for_timeout(1800)
        pg.evaluate(KILL_BANNERS); pg.evaluate('window.__scroll = false')
        hit = pg.evaluate(FIND, needles)
        if hit and all(150 < r['y'] < 800 for r in hit['rects']):
            break
    pg.screenshot(path=str(OUT / f'{sid}.png'))
    title = pg.title()
    ctx.close()
    return hit, title

with sync_playwright() as p:
    b = p.chromium.launch(args=['--disable-blink-features=AutomationControlled'])
    for sid in (sys.argv[1:] or PAGES):
        url, needles = PAGES[sid]
        res = None
        for ua in (UA, None):
            try:
                hit, title = shoot(b, sid, url, needles, ua)
                res = {'id': sid, 'url': url, 'title': title, 'hit': hit, 'ua': 'default' if ua is None else 'chrome'}
                if hit: break
            except Exception as e:
                res = {'id': sid, 'url': url, 'error': str(e)}
        (OUT / f'{sid}.json').write_text(json.dumps(res, indent=1))
        print(sid, json.dumps(res)[:300])
    b.close()
