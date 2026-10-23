#!/usr/bin/env python3
"""
Animated demonstration videos for lessons that have no recorded teacher yet.

A drawn figure (or hand) performs the exact move each gate checks, timed to the gate's `t` in track.istep, so the
move is on screen just before the video pauses. Segments that a gate loops (`rewindTo` .. `t`) start and end on
the same pose, so the loop is seamless. Every frame carries an "Animated demonstration" label: no person is shown
and nothing pretends to be a recording. Sign-language lessons get branded practice cards instead (no drawn hands).

  python3 scripts/make-animated-lesson.py fall-heel-raise-v1
  python3 scripts/make-animated-lesson.py --all
  python3 scripts/make-animated-lesson.py fall-heel-raise-v1 --still 15   # one PNG frame, for checking

Needs pycairo and ffmpeg. Output: content/lessons/<id>/video.mp4 (1280x720, 25 fps, H.264, no audio).
"""
import json
import math
import os
import subprocess
import sys

import cairo

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
W, H, FPS = 1920, 1080, 25
OUT_W, OUT_H = 1280, 720
FONT = 'Noto Sans'


# ---------- easing and timelines ----------

def smooth(x):
    x = max(0.0, min(1.0, x))
    return x * x * (3 - 2 * x)


def ramp(t, a, b):
    """0 before a, 1 after b, eased between."""
    return smooth((t - a) / (b - a)) if b > a else float(t >= b)


def pulse(t, start, rise, hold, fall):
    """0 -> 1 -> 0: rise over `rise` s from `start`, hold, fall."""
    return ramp(t, start, start + rise) - ramp(t, start + rise + hold, start + rise + hold + fall)


def mix(a, b, k):
    return a + (b - a) * k


def hexrgb(h, a=1.0):
    h = h.lstrip('#')
    return (int(h[0:2], 16) / 255, int(h[2:4], 16) / 255, int(h[4:6], 16) / 255, a)


def shade(c, k):
    """k < 1 darkens, k > 1 lightens toward white."""
    r, g, b, a = c
    if k <= 1:
        return (r * k, g * k, b * k, a)
    k -= 1
    return (r + (1 - r) * k, g + (1 - g) * k, b + (1 - b) * k, a)


# ---------- drawing helpers ----------

def capsule(cr, p, q, width, color, light=1.18):
    """A limb: round-capped stroke with a soft highlight along one side."""
    cr.set_line_cap(cairo.LINE_CAP_ROUND)
    cr.set_source_rgba(*color)
    cr.set_line_width(width)
    cr.move_to(*p)
    cr.line_to(*q)
    cr.stroke()
    dx, dy = q[0] - p[0], q[1] - p[1]
    n = math.hypot(dx, dy) or 1
    ox, oy = -dy / n * width * 0.18, dx / n * width * 0.18
    cr.set_source_rgba(*shade(color, light)[:3], 0.55)
    cr.set_line_width(width * 0.38)
    cr.move_to(p[0] - ox, p[1] - oy)
    cr.line_to(q[0] - ox, q[1] - oy)
    cr.stroke()


def rrect(cr, x, y, w, h, r):
    cr.new_sub_path()
    cr.arc(x + w - r, y + r, r, -math.pi / 2, 0)
    cr.arc(x + w - r, y + h - r, r, 0, math.pi / 2)
    cr.arc(x + r, y + h - r, r, math.pi / 2, math.pi)
    cr.arc(x + r, y + r, r, math.pi, 1.5 * math.pi)
    cr.close_path()


def backdrop(cr, deep, light, floor_y=None):
    g = cairo.LinearGradient(0, 0, W, H)
    g.add_color_stop_rgba(0, *hexrgb(light))
    g.add_color_stop_rgba(1, *hexrgb(deep))
    cr.set_source(g)
    cr.paint()
    # soft key light from the upper left
    rg = cairo.RadialGradient(W * 0.32, H * 0.2, 0, W * 0.32, H * 0.2, W * 0.75)
    rg.add_color_stop_rgba(0, 1, 1, 1, 0.10)
    rg.add_color_stop_rgba(1, 1, 1, 1, 0)
    cr.set_source(rg)
    cr.paint()
    if floor_y is not None:
        fg = cairo.LinearGradient(0, floor_y, 0, H)
        fg.add_color_stop_rgba(0, 0, 0, 0, 0.18)
        fg.add_color_stop_rgba(1, 0, 0, 0, 0.42)
        cr.set_source(fg)
        cr.rectangle(0, floor_y, W, H - floor_y)
        cr.fill()
        cr.set_source_rgba(1, 1, 1, 0.10)
        cr.set_line_width(2)
        cr.move_to(0, floor_y)
        cr.line_to(W, floor_y)
        cr.stroke()


def shadow(cr, cx, cy, rx, ry, alpha=0.35):
    cr.save()
    cr.translate(cx, cy)
    cr.scale(rx, ry)
    rg = cairo.RadialGradient(0, 0, 0, 0, 0, 1)
    rg.add_color_stop_rgba(0, 0, 0, 0, alpha)
    rg.add_color_stop_rgba(1, 0, 0, 0, 0)
    cr.set_source(rg)
    cr.arc(0, 0, 1, 0, 2 * math.pi)
    cr.fill()
    cr.restore()


def label(cr, text, sub=None):
    """Top-left chip: what this video is. Always on screen."""
    cr.select_font_face(FONT, cairo.FONT_SLANT_NORMAL, cairo.FONT_WEIGHT_BOLD)
    cr.set_font_size(30)
    ext = cr.text_extents(text)
    w = ext.x_advance + 64
    rrect(cr, 64, 56, w, 60, 30)
    cr.set_source_rgba(0, 0, 0, 0.34)
    cr.fill()
    cr.arc(64 + 30, 86, 7, 0, 2 * math.pi)
    cr.set_source_rgba(*hexrgb('#4FD1C5'))
    cr.fill()
    cr.set_source_rgba(1, 1, 1, 0.92)
    cr.move_to(64 + 46, 86 + 10)
    cr.show_text(text)
    if sub:
        cr.select_font_face(FONT, cairo.FONT_SLANT_NORMAL, cairo.FONT_WEIGHT_NORMAL)
        cr.set_font_size(30)
        cr.set_source_rgba(1, 1, 1, 0.72)
        cr.move_to(64 + 6, 170)
        cr.show_text(sub)


def chip(cr, text, x, y, alpha):
    """A cue chip (e.g. which foot), fades with `alpha`."""
    if alpha <= 0.01:
        return
    cr.select_font_face(FONT, cairo.FONT_SLANT_NORMAL, cairo.FONT_WEIGHT_BOLD)
    cr.set_font_size(40)
    ext = cr.text_extents(text)
    w = ext.x_advance + 64
    rrect(cr, x - w / 2, y, w, 72, 36)
    cr.set_source_rgba(1, 1, 1, 0.92 * alpha)
    cr.fill()
    cr.set_source_rgba(0.04, 0.05, 0.06, alpha)
    cr.move_to(x - ext.x_advance / 2, y + 50)
    cr.show_text(text)


# ---------- the standing figure (side view, facing right) ----------

S = 640  # figure height in px
FLOOR = 900
SKIN = hexrgb('#D9A27E')
SHIRT = hexrgb('#4FD1C5')
PANTS = hexrgb('#2E3946')
SHOE = hexrgb('#F2F2F4')
HAIR = hexrgb('#E6E2DC')
L = dict(foot=0.15 * S, shin=0.245 * S, thigh=0.245 * S, torso=0.30 * S, neck=0.045 * S, head=0.068 * S,
         upper=0.17 * S, fore=0.155 * S)
ANKLE_H = 0.045 * S


def leg_from_ground(heel_x, heel_raise_deg):
    """Stance leg: the ball of the foot stays on the floor; the heel lifts by rotating about it."""
    ball = (heel_x + L['foot'] * 0.72, FLOOR)
    toe = (heel_x + L['foot'], FLOOR)
    a = math.radians(heel_raise_deg)
    # ankle sits above the heel end of the foot; rotate (ankle - ball) about the ball
    rot = lambda vx, vy: (ball[0] + vx * math.cos(a) - vy * math.sin(a), ball[1] + vx * math.sin(a) + vy * math.cos(a))
    ankle = rot(heel_x + L['foot'] * 0.18 - ball[0], -ANKLE_H)
    heel = rot(heel_x - ball[0], 0.0)
    knee = (ankle[0] - 0.01 * S, ankle[1] - L['shin'])
    hip = (knee[0] + 0.005 * S, knee[1] - L['thigh'])
    return dict(heel=heel, ball=ball, toe=toe, ankle=ankle, knee=knee, hip=hip)


def leg_from_hip(hip, thigh_deg, knee_deg):
    """Swing leg from the hip: thigh angle forward of vertical, knee bend bringing the shin back."""
    t = math.radians(thigh_deg)
    knee = (hip[0] + L['thigh'] * math.sin(t), hip[1] + L['thigh'] * math.cos(t))
    s = t - math.radians(knee_deg)
    ankle = (knee[0] + L['shin'] * math.sin(s), knee[1] + L['shin'] * math.cos(s))
    sd, fw = (math.sin(s), math.cos(s)), (math.cos(s), -math.sin(s))  # down the shin, forward along the foot
    toe = (ankle[0] + fw[0] * 0.82 * L['foot'] + sd[0] * ANKLE_H * 0.6, ankle[1] + fw[1] * 0.82 * L['foot'] + sd[1] * ANKLE_H * 0.6)
    heel = (ankle[0] - fw[0] * 0.18 * L['foot'] + sd[0] * ANKLE_H * 0.6, ankle[1] - fw[1] * 0.18 * L['foot'] + sd[1] * ANKLE_H * 0.6)
    return dict(heel=heel, ball=toe, toe=toe, ankle=ankle, knee=knee, hip=hip)


def ik(shoulder, target, a, b, bend=1):
    """Two-link arm reaching `target`; the elbow bends down and back."""
    dx, dy = target[0] - shoulder[0], target[1] - shoulder[1]
    d = min(math.hypot(dx, dy), a + b - 0.5)
    base = math.atan2(dy, dx)
    cos_a = (a * a + d * d - b * b) / (2 * a * d)
    ang = base + bend * math.acos(max(-1, min(1, cos_a)))
    elbow = (shoulder[0] + a * math.cos(ang), shoulder[1] + a * math.sin(ang))
    hand = (shoulder[0] + d * math.cos(base), shoulder[1] + d * math.sin(base))
    return elbow, hand


def draw_leg(cr, leg, far):
    k = 0.72 if far else 1.0
    capsule(cr, leg['hip'], leg['knee'], 0.075 * S, shade(PANTS, k * 1.05))
    capsule(cr, leg['knee'], leg['ankle'], 0.062 * S, shade(PANTS, k))
    # shoe: heel to toe wedge
    cr.set_line_cap(cairo.LINE_CAP_ROUND)
    cr.set_line_join(cairo.LINE_JOIN_ROUND)
    cr.set_source_rgba(*shade(SHOE, k * 0.95))
    cr.set_line_width(0.05 * S)
    cr.move_to(*leg['heel'])
    cr.line_to(*leg['ankle'])
    cr.line_to(*leg['toe'])
    cr.close_path()
    cr.stroke_preserve()
    cr.fill()


def draw_arm(cr, shoulder, elbow, hand, far):
    k = 0.72 if far else 1.0
    capsule(cr, shoulder, elbow, 0.058 * S, shade(SHIRT, k * 0.92))
    capsule(cr, elbow, hand, 0.048 * S, shade(SKIN, k))
    cr.set_source_rgba(*shade(SKIN, k * 0.95))
    cr.arc(hand[0], hand[1], 0.03 * S, 0, 2 * math.pi)
    cr.fill()


def draw_chair(cr, back_x):
    wood = hexrgb('#C9A27A')
    seat_y = FLOOR - 0.27 * S
    top_y = FLOOR - 0.56 * S
    depth = 0.24 * S
    shadow(cr, back_x + depth / 2, FLOOR + 6, depth * 0.9, 16, 0.4)
    cr.set_line_cap(cairo.LINE_CAP_ROUND)
    # far legs, then seat, then near legs and the back
    for x, k in ((back_x + 10, 0.7), (back_x + depth + 10, 0.7)):
        cr.set_source_rgba(*shade(wood, k))
        cr.set_line_width(16)
        cr.move_to(x, seat_y)
        cr.line_to(x, FLOOR)
        cr.stroke()
    rrect(cr, back_x - 8, seat_y - 14, depth + 24, 28, 12)
    cr.set_source_rgba(*shade(wood, 1.05))
    cr.fill()
    for x in (back_x, back_x + depth):
        cr.set_source_rgba(*wood)
        cr.set_line_width(18)
        cr.move_to(x, seat_y)
        cr.line_to(x, FLOOR)
        cr.stroke()
    cr.set_line_width(20)
    cr.move_to(back_x, seat_y)
    cr.line_to(back_x, top_y)
    cr.stroke()
    rrect(cr, back_x - 22, top_y - 16, 44, 0.14 * S, 14)
    cr.set_source_rgba(*shade(wood, 1.12))
    cr.fill()
    return (back_x, top_y)


def figure(cr, heel_x, near_heel, far_heel, far_leg=None, near_leg=None, chair_top=None, lean=4.0):
    """Draws the whole figure; `far_leg` / `near_leg` override a stance leg with a swing leg spec (thigh, knee)."""
    far = leg_from_ground(heel_x - 0.012 * S, far_heel)
    near = leg_from_ground(heel_x + 0.012 * S, near_heel)
    stance = near if far_leg is not None else far
    hip = ((far['hip'][0] + near['hip'][0]) / 2, min(far['hip'][1], near['hip'][1]) if far_leg is None and near_leg is None else stance['hip'][1])
    if far_leg is not None:
        far = leg_from_hip((hip[0] - 0.012 * S, hip[1]), *far_leg)
    if near_leg is not None:
        stance = far
        hip = (hip[0], far['hip'][1])
        near = leg_from_hip((hip[0] + 0.012 * S, hip[1]), *near_leg)
    a = math.radians(lean)
    shoulder = (hip[0] + L['torso'] * math.sin(a), hip[1] - L['torso'] * math.cos(a))
    neck_top = (shoulder[0] + L['neck'] * math.sin(a) + 0.01 * S, shoulder[1] - L['neck'])
    head = (neck_top[0] + 0.01 * S, neck_top[1] - L['head'] * 0.92)

    shadow(cr, heel_x + 0.08 * S, FLOOR + 8, 0.2 * S, 18)
    targets = (chair_top[0] - 0.012 * S, chair_top[1] + 0.004 * S) if chair_top else None
    if targets:
        far_el, far_hand = ik((shoulder[0] - 0.02 * S, shoulder[1] + 0.02 * S), (targets[0] - 0.02 * S, targets[1]), L['upper'], L['fore'])
        draw_arm(cr, (shoulder[0] - 0.02 * S, shoulder[1] + 0.02 * S), far_el, far_hand, True)
    draw_leg(cr, far, True)
    # torso and hips
    capsule(cr, (hip[0] - 0.005 * S, hip[1] - 0.01 * S), (hip[0] + 0.02 * S, hip[1] + 0.01 * S), 0.12 * S, PANTS)
    capsule(cr, (hip[0], hip[1] - 0.03 * S), shoulder, 0.135 * S, SHIRT, 1.12)
    draw_leg(cr, near, False)
    # neck and head
    capsule(cr, shoulder, neck_top, 0.045 * S, shade(SKIN, 0.92))
    rg = cairo.RadialGradient(head[0] - 0.02 * S, head[1] - 0.025 * S, 2, head[0], head[1], L['head'] * 1.1)
    rg.add_color_stop_rgba(0, *shade(SKIN, 1.12))
    rg.add_color_stop_rgba(1, *shade(SKIN, 0.86))
    cr.set_source(rg)
    cr.arc(head[0], head[1], L['head'], 0, 2 * math.pi)
    cr.fill()
    # hair cap (back and top of the head) and a small nose: tells which way the figure faces
    cr.set_source_rgba(*HAIR)
    cr.arc(head[0], head[1], L['head'] * 1.02, math.pi * 0.62, math.pi * 1.78)
    cr.close_path()
    cr.fill()
    cr.set_source_rgba(*shade(SKIN, 0.95))
    cr.arc(head[0] + L['head'] * 0.98, head[1] + L['head'] * 0.1, L['head'] * 0.16, 0, 2 * math.pi)
    cr.fill()
    if targets:
        sh = (shoulder[0] + 0.01 * S, shoulder[1] + 0.025 * S)
        el, hand = ik(sh, targets, L['upper'], L['fore'])
        draw_arm(cr, sh, el, hand, False)
    else:
        draw_arm(cr, shoulder, (shoulder[0] - 0.01 * S, shoulder[1] + L['upper']), (shoulder[0], shoulder[1] + L['upper'] + L['fore']), False)


def fade(cr, t, dur):
    k = max(1 - ramp(t, 0, 0.8), ramp(t, dur - 0.8, dur))
    if k > 0:
        cr.set_source_rgba(0, 0, 0, k)
        cr.paint()


# ---------- lessons ----------

DEEP, LIGHT = '#0B2A3A', '#2F6F78'
FIG_X = 760
CHAIR_X = FIG_X + 0.36 * S


def heel_raise(cr, t, dur):
    """chair t=3, stand t=8, raises loop 12..22 (5 reps of 2 s), final hold t=36."""
    backdrop(cr, DEEP, LIGHT, FLOOR)
    top = draw_chair(cr, CHAIR_X)
    lift = 0.0
    if 12 <= t < 22:
        p = (t - 12) % 2.0  # 0..2: rise 0.8, top 0.3, lower 0.8, rest 0.1 -> starts and ends flat
        lift = ramp(p, 0, 0.8) - ramp(p, 1.1, 1.9)
    lift = max(lift, pulse(t, 31.0, 1.2, 5.0, 1.2))  # rise at 31, hold 32.2..37.2 (gate at 36)
    deg = 24 * lift
    figure(cr, FIG_X, deg, deg, chair_top=top)
    label(cr, 'Animated demonstration', 'Heel raises with a chair')
    if 12 <= t < 22:
        n = int((t - 12) // 2) + 1
        chip(cr, f'Raise {n} of 5', FIG_X + 0.1 * S, 140, 1.0)
    chip(cr, 'Rise and hold', FIG_X + 0.1 * S, 140, pulse(t, 31.0, 0.4, 6.0, 0.4))
    fade(cr, t, dur)


def single_leg(cr, t, dur):
    """chair t=3, right foot hold (gate t=12, 5 s), left foot hold (gate t=26, 5 s)."""
    backdrop(cr, DEEP, LIGHT, FLOOR)
    top = draw_chair(cr, CHAIR_X)
    r = pulse(t, 9.0, 1.2, 7.0, 1.2)   # up 10.2..17.2
    l = pulse(t, 23.0, 1.2, 7.0, 1.2)  # up 24.2..31.2
    # facing right, the far leg is the figure's right leg
    if r > 0.001:
        figure(cr, FIG_X, 0, 0, far_leg=(6 * r, 72 * r), chair_top=top)
    elif l > 0.001:
        figure(cr, FIG_X, 0, 0, near_leg=(6 * l, 72 * l), chair_top=top)
    else:
        figure(cr, FIG_X, 0, 0, chair_top=top)
    label(cr, 'Animated demonstration', 'Single-leg stand with a chair')
    chip(cr, 'Right foot up', FIG_X + 0.1 * S, 140, pulse(t, 9.0, 0.4, 8.0, 0.4))
    chip(cr, 'Left foot up', FIG_X + 0.1 * S, 140, pulse(t, 23.0, 0.4, 8.0, 0.4))
    fade(cr, t, dur)


# ---------- the hand (palm towards the camera, forearm resting on a table) ----------

FINGERS = [  # x offset from palm centre, length factor, base angle (deg, spread)
    (-0.33, 0.80, -9),
    (-0.11, 1.00, -3),
    (0.11, 1.07, 2),
    (0.33, 0.97, 8),
]


def draw_hand(cr, cx, cy, u, close):
    """`close` 0 = open, 1 = soft fist. Fingers curl toward the camera: each joint's angle is projected onto the
    screen (cos of the accumulated flexion), so a curled finger folds down over the palm and shows its back."""
    # forearm from the bottom edge, resting on the table
    capsule(cr, (cx + 0.05 * u, H + 0.4 * u), (cx, cy + 0.55 * u), 0.82 * u, shade(SKIN, 0.94), 1.1)
    rrect(cr, cx - 0.52 * u, cy + 0.9 * u, 1.04 * u, H, 0.18 * u)  # sleeve
    cr.set_source_rgba(*hexrgb('#3E4B5B'))
    cr.fill()
    # palm
    rg = cairo.RadialGradient(cx - 0.1 * u, cy - 0.1 * u, 0.05 * u, cx, cy, 0.8 * u)
    rg.add_color_stop_rgba(0, *shade(SKIN, 1.08))
    rg.add_color_stop_rgba(1, *shade(SKIN, 0.9))
    rrect(cr, cx - 0.5 * u, cy - 0.5 * u, 1.0 * u, 1.05 * u, 0.32 * u)
    cr.set_source(rg)
    cr.fill()
    # palm creases fade as the hand closes (they get covered)
    cr.set_source_rgba(0, 0, 0, 0.10 * (1 - close))
    cr.set_line_width(0.02 * u)
    cr.move_to(cx - 0.42 * u, cy - 0.12 * u)
    cr.curve_to(cx - 0.1 * u, cy - 0.02 * u, cx + 0.2 * u, cy - 0.2 * u, cx + 0.45 * u, cy - 0.18 * u)
    cr.stroke()
    flex = [math.radians(d) * close for d in (80, 100, 55)]
    segs = []
    for fx, fl, spread in FINGERS:
        base = (cx + fx * u, cy - 0.46 * u)
        lens = [0.45 * fl * u, 0.30 * fl * u, 0.24 * fl * u]
        sp = math.radians(spread) * (1 - close)
        cum, depth, p = 0.0, 0.0, base
        for i, ln in enumerate(lens):
            cum += flex[i]
            q = (p[0] + ln * math.sin(sp) * math.cos(cum), p[1] - ln * math.cos(sp) * math.cos(cum))
            d2 = depth + ln * math.sin(cum)
            segs.append(((depth + d2) / 2, p, q, cum, i == 2, 0.21 * u * (1 - 0.08 * i)))
            p, depth = q, d2
    for _, p, q, cum, tip, wdt in sorted(segs, key=lambda s: s[0]):
        k = 0.82 + 0.25 * abs(math.cos(cum))
        capsule(cr, p, q, wdt, shade(SKIN, k), 1.1)
        if tip and cum > math.radians(150):  # back of the fingertip faces us: nail
            cr.set_source_rgba(*shade(SKIN, 1.35)[:3], 0.9)
            rrect(cr, q[0] - wdt * 0.28, q[1] - wdt * 0.15, wdt * 0.56, wdt * 0.5, wdt * 0.2)
            cr.fill()
    # thumb: out to the side when open, across the curled fingers when closed
    root = (cx + 0.42 * u, cy + 0.32 * u)
    ang = math.radians(mix(-38, -96, close))  # from up-right to pointing left across the palm
    l1, l2 = 0.36 * u, mix(0.32, 0.26, close) * u
    a1 = math.radians(mix(-28, -70, close))
    mid = (root[0] + l1 * math.cos(a1), root[1] + l1 * math.sin(a1))
    tip = (mid[0] + l2 * math.cos(ang), mid[1] + l2 * math.sin(ang))
    capsule(cr, root, mid, 0.24 * u, shade(SKIN, 0.96), 1.1)
    capsule(cr, mid, tip, 0.21 * u, shade(SKIN, 1.0), 1.12)


def hand_open_close(cr, t, dur):
    """open-close gate at t=8 loops 4..8; the teacher's rep is 2 s, starting and ending open."""
    backdrop(cr, '#0C2A24', '#2F7A62')
    # table edge
    cr.set_source_rgba(0, 0, 0, 0.28)
    cr.rectangle(0, H * 0.78, W, H * 0.22)
    cr.fill()
    cr.set_source_rgba(1, 1, 1, 0.08)
    cr.rectangle(0, H * 0.78, W, 3)
    cr.fill()
    close = 0.0
    if 4 <= t < dur - 2:
        p = (t - 4) % 2.0  # open 0..0.5, close 0.5..1.0, hold fist 1.0..1.4, open 1.4..1.9
        close = ramp(p, 0.5, 1.0) - ramp(p, 1.4, 1.9)
    elif t < 4:
        close = 0.35 * (1 - ramp(t, 1.0, 3.0))  # relaxed hand opening up
    u = 300
    shadow(cr, W / 2, H * 0.8, 360, 30, 0.3)
    draw_hand(cr, W / 2, H * 0.47, u, close)
    label(cr, 'Animated demonstration', 'Open and close your hand')
    if 4 <= t < dur - 2:
        chip(cr, 'Open' if close < 0.5 else 'Close', W / 2, 150, 1.0)
    fade(cr, t, dur)


def wrap(cr, text, width):
    lines, cur = [], ''
    for w in text.split():
        trial = (cur + ' ' + w).strip()
        if cr.text_extents(trial).x_advance > width and cur:
            lines.append(cur)
            cur = w
        else:
            cur = trial
    return lines + [cur] if cur else lines


def centred(cr, text, y, size, weight, alpha=1.0):
    cr.select_font_face(FONT, cairo.FONT_SLANT_NORMAL, weight)
    cr.set_font_size(size)
    cr.set_source_rgba(1, 1, 1, alpha)
    cr.move_to(W / 2 - cr.text_extents(text).x_advance / 2, y)
    cr.show_text(text)


def glyph(label):
    """'Letter A' -> 'A', 'Spell: C-A-B' -> 'C A B', 'Sign: I love you' -> 'I love you'."""
    s = label.split(':', 1)[-1].strip()
    if s.lower().startswith('letter '):
        s = s[7:]
    return s.replace('-', ' ')


def practice_cards(track):
    """Sign language: no drawn hands (a wrong handshape teaches the wrong sign). Branded step cards say what to sign
    and that a video by Deaf signers replaces them, timed like scripts/make-lesson-video.mjs."""
    gates = sorted(track['gates'], key=lambda g: g['t'])
    start = lambda g: g['rewindTo'] if isinstance(g.get('rewindTo'), (int, float)) else max(0, g['t'] - 1.5)

    def draw(cr, t, dur):
        backdrop(cr, '#1E1238', '#5B3A8E')
        idx = next((i for i, g in reversed(list(enumerate(gates))) if t >= start(g)), -1)
        label(cr, 'Practice card', 'A video by Deaf signers replaces this card')
        if idx < 0:
            centred(cr, track['title'], 500, 92, cairo.FONT_WEIGHT_BOLD)
            centred(cr, 'Sign Language for Families', 600, 44, cairo.FONT_WEIGHT_NORMAL, 0.72)
        else:
            g = gates[idx]
            centred(cr, f'Step {idx + 1} of {len(gates)}', 300, 40, cairo.FONT_WEIGHT_BOLD, 0.7)
            hero = glyph(g['label'])
            cr.select_font_face(FONT, cairo.FONT_SLANT_NORMAL, cairo.FONT_WEIGHT_BOLD)
            size = 260 if len(hero) <= 1 else 180 if len(hero) <= 5 else 130
            cr.set_font_size(size)
            tw = cr.text_extents(hero).x_advance
            bw = max(360, tw + 160)
            rrect(cr, W / 2 - bw / 2, 340, bw, 340, 48)
            cr.set_source_rgba(1, 1, 1, 0.10)
            cr.fill_preserve()
            cr.set_source_rgba(1, 1, 1, 0.18)
            cr.set_line_width(2)
            cr.stroke()
            centred(cr, hero, 510 + size * 0.36, size, cairo.FONT_WEIGHT_BOLD)
            cr.select_font_face(FONT, cairo.FONT_SLANT_NORMAL, cairo.FONT_WEIGHT_NORMAL)
            cr.set_font_size(44)
            for i, line in enumerate(wrap(cr, g.get('fallbackTip', ''), 1300)[:2]):
                centred(cr, line, 790 + i * 60, 44, cairo.FONT_WEIGHT_NORMAL, 0.86)
        fade(cr, t, dur)

    return draw


LESSONS = {
    'fall-heel-raise-v1': heel_raise,
    'fall-single-leg-stand-v1': single_leg,
    'rehab-hand-open-close-v1': hand_open_close,
    'asl-fingerspell-abc-v1': practice_cards,
    'asl-i-love-you-v1': practice_cards,
}
CARDS = {'asl-fingerspell-abc-v1', 'asl-i-love-you-v1'}


def render(lesson_id, still=None):
    d = os.path.join(ROOT, 'content/lessons', lesson_id)
    track = json.load(open(os.path.join(d, 'track.istep')))
    dur = float(track['video']['durationSec'])
    draw = LESSONS[lesson_id](track) if lesson_id in CARDS else LESSONS[lesson_id]
    surf = cairo.ImageSurface(cairo.FORMAT_ARGB32, W, H)
    cr = cairo.Context(surf)
    cr.set_antialias(cairo.ANTIALIAS_BEST)
    if still is not None:
        draw(cr, float(still), dur)
        out = os.path.join(d, f'still-{still}.png')
        surf.write_to_png(out)
        return print('wrote', out)
    out = os.path.join(d, track['video'].get('src', 'video.mp4'))
    ff = subprocess.Popen([
        'ffmpeg', '-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'bgra', '-s', f'{W}x{H}', '-r', str(FPS),
        '-i', '-', '-vf', f'scale={OUT_W}:{OUT_H}:flags=lanczos,format=yuv420p', '-c:v', 'libx264',
        '-profile:v', 'main', '-preset', 'slow', '-crf', '24', '-movflags', '+faststart', out,
    ], stdin=subprocess.PIPE)
    for i in range(int(round(dur * FPS))):
        cr.save()
        draw(cr, i / FPS, dur)
        cr.restore()
        surf.flush()
        ff.stdin.write(bytes(surf.get_data()))
    ff.stdin.close()
    if ff.wait():
        sys.exit('ffmpeg failed')
    print('wrote', out)
    if lesson_id in CARDS:  # still a stand-in: keep the placeholder marker (text-free posters, catalog rules)
        return
    marker = os.path.join(d, 'video.placeholder')
    if os.path.exists(marker):
        os.remove(marker)
    with open(os.path.join(d, 'video.animated'), 'w') as f:
        f.write('Animated demonstration from scripts/make-animated-lesson.py (no people). '
                'Delete this file when you add a recorded demonstration.\n')


if __name__ == '__main__':
    args = sys.argv[1:]
    still = None
    if '--still' in args:
        i = args.index('--still')
        still = args[i + 1]
        del args[i:i + 2]
    for lid in (list(LESSONS) if args == ['--all'] else args):
        render(lid, still)
