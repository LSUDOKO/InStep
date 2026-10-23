import { POSE_EDGES, referencePoseAt } from '@instep/gate-engine';
import type { Gate, IstepTrack, ReferenceTimeline } from '@instep/istep-format';
import { Clock, Play, Plus, Trash2, Wand2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

const TYPE_LABEL: Record<Gate['type'], string> = {
  pose_match: 'Match a pose',
  hold_duration: 'Hold a pose',
  rep_count: 'Count repetitions',
  rhythm_bpm: 'Keep a rhythm',
  hand_sign: 'Hand shape',
  sequence_order: 'Sequence',
  safety_prerequisite: 'Safety check',
};

/** Gate types a creator can add per channel (safety gates come from auto-gates and cannot be loosened). */
export const ADDABLE: Record<IstepTrack['channel'], Gate['type'][]> = {
  fall_prevention: ['hold_duration', 'pose_match'],
  kids: ['pose_match', 'hold_duration'],
  sign_language: ['hand_sign'],
  stroke_rehab: ['rep_count'],
  cpr: ['rhythm_bpm'],
};

export function newGate(type: Gate['type'], t: number, n: number): Gate {
  const base = { id: `step${n}`, t, label: 'New step', fallbackTip: 'Copy what you see on screen.' };
  switch (type) {
    case 'hold_duration':
      return {
        ...base,
        type,
        target: { source: 'reference', atSec: t },
        joints: ['l_knee', 'r_knee', 'l_hip', 'r_hip', 'torso'],
        holdSec: 2,
        graceSec: 0.4,
      };
    case 'hand_sign':
      return { ...base, type, hand: 'any', target: { source: 'reference', atSec: t }, minFrames: 10 };
    case 'rep_count':
      return {
        ...base,
        type,
        metric: { kind: 'hand_openness', hand: 'affected' },
        range: { low: 0.25, high: 0.75 },
        reps: 10,
        rewindTo: Math.max(0, t - 2),
        then: 'loop_segment',
      };
    case 'rhythm_bpm':
      return {
        ...base,
        type,
        signal: { landmark: 'wrists_mid', axis: 'y' },
        bpm: { min: 100, max: 120 },
        count: 30,
        armsStraight: { minElbowDeg: 160 },
        metronomeBpm: 110,
      };
    default:
      return {
        ...base,
        type: 'pose_match',
        target: { source: 'reference', atSec: t },
        joints: ['l_shoulder', 'r_shoulder', 'l_elbow', 'r_elbow', 'l_knee', 'r_knee'],
        minFrames: 8,
      };
  }
}

/** Keeps reference targets aligned with the gate time when the creator moves a gate. */
function retime(g: Gate, t: number): Gate {
  const r = Math.round(t * 10) / 10;
  const target =
    'target' in g && g.target && 'source' in g.target && g.target.source === 'reference'
      ? { ...g.target, atSec: r }
      : undefined;
  return { ...g, t: r, ...(target ? { target } : {}) } as Gate;
}

export function GateEditor(props: {
  videoUrl: string;
  track: IstepTrack;
  reference?: ReferenceTimeline;
  gates: Gate[];
  onChange: (g: Gate[]) => void;
  onAutogates: () => void;
  onPreview: (g: Gate) => void;
  errors: Record<string, string>;
}) {
  const { gates, onChange, track } = props;
  const video = useRef<HTMLVideoElement | null>(null);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const [now, setNow] = useState(0);
  const [sel, setSel] = useState<number | null>(gates.length ? 0 : null);
  // select the first step when suggestions arrive after mount
  useEffect(() => {
    if (sel === null && gates.length) setSel(0);
    if (sel !== null && sel >= gates.length) setSel(gates.length ? gates.length - 1 : null);
  }, [gates.length, sel]);
  const duration = track.video.durationSec;
  const g = sel !== null ? gates[sel] : undefined;

  // reference skeleton over the video at the current time
  useEffect(() => {
    const c = canvas.current;
    const ctx = c?.getContext('2d');
    const pose = referencePoseAt(props.reference, now);
    if (!c || !ctx) return;
    c.width = c.clientWidth * devicePixelRatio;
    c.height = c.clientHeight * devicePixelRatio;
    ctx.clearRect(0, 0, c.width, c.height);
    if (!pose) return;
    ctx.strokeStyle = '#4FD1C5';
    ctx.lineWidth = 4 * devicePixelRatio;
    ctx.setLineDash([12, 8]);
    for (const [a, b] of POSE_EDGES) {
      const p = pose[a]!;
      const q = pose[b]!;
      if ((p.v ?? 1) < 0.5 || (q.v ?? 1) < 0.5) continue;
      ctx.beginPath();
      ctx.moveTo(p.x * c.width, p.y * c.height);
      ctx.lineTo(q.x * c.width, q.y * c.height);
      ctx.stroke();
    }
  }, [now, props.reference]);

  const update = (i: number, patch: Partial<Gate>) => {
    const next = gates.map((x, k) => (k === i ? ({ ...x, ...patch } as Gate) : x));
    onChange(next);
  };
  const seek = (t: number) => {
    if (video.current) video.current.currentTime = t;
    setNow(t);
  };
  const sortAndSelect = (next: Gate[], keep: Gate) => {
    const sorted = [...next].sort((a, b) => a.t - b.t);
    onChange(sorted);
    setSel(sorted.indexOf(keep));
  };

  return (
    <div className="stack">
      <div className="media" style={{ position: 'relative' }}>
        <video
          ref={video}
          src={props.videoUrl}
          controls
          playsInline
          style={{ width: '100%', display: 'block' }}
          onTimeUpdate={(e) => setNow(e.currentTarget.currentTime)}
          onSeeked={(e) => setNow(e.currentTarget.currentTime)}
        />
        <canvas
          ref={canvas}
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: 'calc(100% - 40px)',
            pointerEvents: 'none',
          }}
        />
      </div>

      {/* scrubber with a marker per step */}
      <div className="scrubber" aria-label="Steps on the timeline">
        <div className="playhead" style={{ left: `${(now / duration) * 100}%` }} />
        {gates.map((x, i) => (
          <button
            key={x.id}
            className={`marker ${x.type === 'safety_prerequisite' ? 'safety' : ''} ${i === sel ? 'selected' : ''}`}
            aria-label={`${x.label} at ${x.t} seconds`}
            style={{ left: `${(x.t / duration) * 100}%` }}
            onClick={() => {
              setSel(i);
              seek(x.t);
            }}
          />
        ))}
      </div>

      {/* the steps are a real sequence, so they are numbered */}
      {gates.length > 0 && (
        <div className="steps">
          {gates.map((x, i) => (
            <button
              key={x.id}
              className={`step ${x.type === 'safety_prerequisite' ? 'safety' : ''} ${i === sel ? 'selected' : ''}`}
              onClick={() => {
                setSel(i);
                seek(x.t);
              }}
            >
              <span className="n">{i + 1}</span>
              <span>
                <span className="title">{x.label}</span>
                <span className="sub">
                  {TYPE_LABEL[x.type]} at {x.t.toFixed(1)} s{props.errors[x.id] ? ' — needs attention' : ''}
                </span>
              </span>
              <span className="muted small">{i === sel ? 'Editing' : ''}</span>
            </button>
          ))}
        </div>
      )}
      {gates.length === 0 && (
        <p className="muted">No steps yet. Add one at the current video time, or let InStep suggest steps.</p>
      )}

      <div className="list">
        {ADDABLE[track.channel].map((type) => (
          <button
            key={type}
            className="item action"
            onClick={() => {
              const ng = newGate(type, Math.round(now * 10) / 10, gates.length + 1);
              sortAndSelect([...gates, ng], ng);
            }}
          >
            <span className="mark">
              <Plus size={22} aria-hidden />
            </span>
            <span className="title num">
              {TYPE_LABEL[type]} at {now.toFixed(1)} s
            </span>
          </button>
        ))}
        <button className="item action" onClick={props.onAutogates}>
          <span className="mark">
            <Wand2 size={20} aria-hidden />
          </span>
          <span className="title">Suggest steps again</span>
        </button>
      </div>

      {g && sel !== null && (
        <div className={`card ${props.errors[g.id] ? 'bad' : ''}`}>
          <div className="row">
            <strong className="grow">
              Step {sel + 1} of {gates.length}: {TYPE_LABEL[g.type]}
            </strong>
            <button
              className="btn ghost icon"
              aria-label="Try this step with my camera"
              onClick={() => props.onPreview(g)}
            >
              <Play size={20} />
            </button>
            {g.type !== 'safety_prerequisite' || track.channel !== 'fall_prevention' ? (
              <button
                className="btn ghost icon"
                aria-label="Delete step"
                onClick={() => {
                  onChange(gates.filter((_, k) => k !== sel));
                  setSel(null);
                }}
              >
                <Trash2 size={20} />
              </button>
            ) : null}
          </div>
          {props.errors[g.id] && <p className="small field-error">{props.errors[g.id]}</p>}

          <label htmlFor="t">Time (seconds)</label>
          <div className="row">
            <input
              id="t"
              className="text-input"
              type="number"
              step={0.1}
              min={0}
              max={duration}
              value={g.t}
              onChange={(e) => update(sel, retime(g, Number(e.target.value)))}
              onBlur={() => sortAndSelect(gates, g)}
            />
            <button
              className="btn ghost num"
              style={{ whiteSpace: 'nowrap' }}
              onClick={() =>
                sortAndSelect(
                  gates.map((x, k) => (k === sel ? retime(x, now) : x)),
                  retime(g, now),
                )
              }
            >
              <Clock size={18} /> Use {now.toFixed(1)}s
            </button>
          </div>
          <label htmlFor="label">Instruction on the TV (short)</label>
          <input
            id="label"
            className="text-input"
            maxLength={60}
            value={g.label}
            onChange={(e) => update(sel, { label: e.target.value })}
          />
          <label htmlFor="tip">Tip when someone is stuck</label>
          <textarea
            id="tip"
            className="text-input short"
            maxLength={200}
            value={g.fallbackTip}
            onChange={(e) => update(sel, { fallbackTip: e.target.value })}
          />

          {(g.type === 'pose_match' || g.type === 'hold_duration') && (
            <>
              <label htmlFor="tol">
                How close is close enough: ±
                {g.tolerance?.angleDeg ?? track.defaults?.tolerance?.angleDeg ?? 20}°
              </label>
              <input
                id="tol"
                type="range"
                min={10}
                max={40}
                value={g.tolerance?.angleDeg ?? 20}
                onChange={(e) => update(sel, { tolerance: { angleDeg: Number(e.target.value) } })}
              />
            </>
          )}
          {g.type === 'hold_duration' && (
            <>
              <label htmlFor="hold">Hold for (seconds)</label>
              <input
                id="hold"
                className="text-input"
                type="number"
                min={1}
                max={30}
                step={0.5}
                value={g.holdSec}
                onChange={(e) => update(sel, { holdSec: Number(e.target.value) } as Partial<Gate>)}
              />
            </>
          )}
          {g.type === 'hand_sign' && (
            <>
              <label htmlFor="curl">Finger tolerance: {g.tolerance?.curl ?? 0.3}</label>
              <input
                id="curl"
                type="range"
                min={0.15}
                max={0.5}
                step={0.05}
                value={g.tolerance?.curl ?? 0.3}
                onChange={(e) => update(sel, { tolerance: { curl: Number(e.target.value) } })}
              />
              <p className="muted small">
                The target hand shape is taken from your demonstration at this time.
              </p>
            </>
          )}
          {g.type === 'rep_count' && (
            <>
              <label htmlFor="reps">Repetitions</label>
              <input
                id="reps"
                className="text-input"
                type="number"
                min={1}
                max={100}
                value={g.reps}
                onChange={(e) => update(sel, { reps: Number(e.target.value) } as Partial<Gate>)}
              />
            </>
          )}
          {g.type === 'rhythm_bpm' && (
            <>
              <label htmlFor="count">Compressions</label>
              <input
                id="count"
                className="text-input"
                type="number"
                min={5}
                max={100}
                value={g.count}
                onChange={(e) => update(sel, { count: Number(e.target.value) } as Partial<Gate>)}
              />
              <p className="muted small">Rhythm target is fixed at 100–120 per minute with straight arms.</p>
            </>
          )}
          {g.type === 'safety_prerequisite' && (
            <p className="muted small">
              Safety checks use fixed thresholds and can never be loosened or skipped.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
