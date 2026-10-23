import type { Catalog } from '@instep/protocol';
import { AlertTriangle, ChevronRight, Clapperboard, KeyRound, Loader2, Lock, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Brand } from '../../components/Brand';
import { FullMessage } from '../../components/FullMessage';
import { creatorApi, creatorPin } from '../../lib/creatorApi';
import { navigate } from '../../lib/router';

/** Channel accents, shared with the TV (apps/tv/src/theme/tokens.ts). */
const CHANNEL_COLOR: Record<string, string> = {
  fall_prevention: '#5FC6FF',
  stroke_rehab: '#5BD7D3',
  sign_language: '#AE97FF',
  cpr: '#F87BAA',
  kids: '#F6D653',
};

/** Demo-only PIN gate (CREATOR_PIN). Production would need real accounts. */
export function PinGate({ children }: { children: React.ReactNode }) {
  const [ok, setOk] = useState<boolean | null>(creatorPin.get() ? null : false);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    if (ok === null) void creatorApi.checkPin().then(setOk, () => setOk(false));
  }, [ok]);
  if (ok) return <>{children}</>;
  if (ok === null)
    return (
      <FullMessage icon={<Loader2 className="spin" size={30} />} title="Checking access…">
        <p>One moment.</p>
      </FullMessage>
    );
  return (
    <main className="page">
      <Brand />
      <h1>Creator Studio</h1>
      <p className="lede">
        Record a lesson once on your phone. InStep finds the key moments and turns them into steps that wait
        for the learner.
      </p>
      <form
        className="stack"
        onSubmit={async (e) => {
          e.preventDefault();
          creatorPin.set(pin);
          if (await creatorApi.checkPin().catch(() => false)) setOk(true);
          else {
            creatorPin.clear();
            setError('That PIN is not right. Ask the person running the InStep server.');
          }
        }}
      >
        <label htmlFor="pin">Creator PIN</label>
        <input
          id="pin"
          className="code-input"
          inputMode="numeric"
          type="password"
          autoComplete="off"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
        />
        {error && (
          <div className="banner bad" role="alert">
            <AlertTriangle size={20} /> {error}
          </div>
        )}
        <button className="btn primary block" disabled={!pin}>
          <KeyRound size={20} /> Open Creator Studio
        </button>
      </form>
    </main>
  );
}

export default function CreatorHome() {
  return (
    <PinGate>
      <LessonList />
    </PinGate>
  );
}

function LessonList() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    creatorApi.list().then(setCatalog, (e: Error) => setError(e.message));
  }, []);
  const all =
    catalog?.channels.flatMap((c) =>
      c.lessons.map((l) => ({ ...l, channelTitle: c.title, color: CHANNEL_COLOR[c.channel] })),
    ) ?? [];
  const mine = all.filter((l) => l.editable);
  const builtIn = all.filter((l) => !l.editable);

  return (
    <main className="page">
      <Brand />
      <h1>Creator Studio</h1>
      <button className="btn primary block" onClick={() => navigate('/c/creator/new')}>
        <Plus size={20} /> New lesson
      </button>
      {error && (
        <div className="banner bad" role="alert">
          <AlertTriangle size={20} /> {error}
        </div>
      )}
      {!catalog && !error && (
        <p className="muted row">
          <Loader2 className="spin" size={18} /> Loading lessons…
        </p>
      )}
      {catalog && (
        <>
          <h2 className="section-title">Your lessons</h2>
          <div className="list">
            {mine.length === 0 && (
              <p className="item plain muted">No lessons yet. Tap “New lesson” to record your first one.</p>
            )}
            {mine.map((l) => (
              <button key={l.id} className="item" onClick={() => navigate(`/c/creator/${l.id}`)}>
                <span className="mark" style={{ background: l.color, color: '#000' }}>
                  <Clapperboard size={17} aria-hidden />
                </span>
                <span>
                  <span className="title">{l.title}</span>
                  <span className="sub">
                    {l.channelTitle}, {l.gateCount} {l.gateCount === 1 ? 'step' : 'steps'}
                  </span>
                </span>
                <span className={`chip ${l.status === 'published' ? 'ok' : 'warn'}`}>
                  {l.status === 'published' ? 'On TV' : 'Draft'}
                </span>
                <ChevronRight className="chev" size={20} aria-hidden />
              </button>
            ))}
          </div>
          {builtIn.length > 0 && (
            <>
              <h2 className="section-title">Built-in demonstration lessons</h2>
              <div className="list">
                {builtIn.map((l) => (
                  <div key={l.id} className="item">
                    <span className="mark" style={{ background: l.color, color: '#000' }}>
                      <Lock size={15} aria-hidden />
                    </span>
                    <span>
                      <span className="title">{l.title}</span>
                      <span className="sub">{l.channelTitle}, read-only</span>
                    </span>
                    <span className={`chip ${l.status === 'published' ? 'ok' : 'warn'}`}>
                      {l.status === 'published' ? 'On TV' : 'No video yet'}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </main>
  );
}
