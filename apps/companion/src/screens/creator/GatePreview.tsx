import { createGateRunner, type GateEval } from '@instep/gate-engine';
import type { Gate, ReferenceTimeline } from '@instep/istep-format';
import { toFrame } from '@instep/protocol';
import { AlertTriangle, CheckCircle2, Loader2, RotateCcw, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Preview } from '../../components/Preview';
import { getVision } from '../../lib/getVision';
import { buildLandmarksMessage, type VisionResult } from '../../lib/landmarks';
import type { Tracker } from '../../lib/vision';

/** Lets the creator try a gate with their own camera — the same engine the TV runs, entirely in this browser. */
export function GatePreview({
  gate,
  reference,
  tracking,
  onClose,
}: {
  gate: Gate;
  reference?: ReferenceTimeline;
  tracking: Tracker[];
  onClose: () => void;
}) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [ev, setEv] = useState<GateEval | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const drawRef = useRef<((r: VisionResult) => void) | null>(null);

  useEffect(() => {
    let s: MediaStream | null = null;
    void (async () => {
      try {
        s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        await (await getVision()).ensure(tracking);
        setStream(s);
      } catch (e) {
        setError((e as Error).message);
      }
    })();
    return () => s?.getTracks().forEach((t) => t.stop());
  }, [tracking]);

  useEffect(() => {
    if (!stream) return;
    const runner = createGateRunner(gate, reference ? { reference } : {});
    let raf = 0;
    let last = 0;
    const tick = async () => {
      raf = requestAnimationFrame(() => void tick());
      const v = videoRef.current;
      if (!v || v.readyState < 2) return;
      const now = performance.now();
      const r = (await getVision()).detect(v, tracking, now);
      drawRef.current?.(r);
      const e = runner.push(
        toFrame(buildLandmarksMessage(r, { seq: 0, ts: Date.now(), role: 'host', tracking, fps: 30 })),
      );
      if (now - last > 100) {
        last = now;
        setEv(e);
      }
    };
    raf = requestAnimationFrame(() => void tick());
    return () => cancelAnimationFrame(raf);
  }, [stream, gate, reference, tracking, attempt]);

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="preview-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="row">
          <h1 id="preview-title" className="grow">
            Try: {gate.label}
          </h1>
          <button className="btn ghost icon" onClick={onClose} aria-label="Close">
            <X size={16} strokeWidth={2.5} aria-hidden />
          </button>
        </div>
        {error && (
          <div className="banner bad">
            <AlertTriangle size={20} /> {error}
          </div>
        )}
        {!stream && !error && (
          <p className="row muted">
            <Loader2 className="spin" size={18} /> Opening the camera…
          </p>
        )}
        {stream && <Preview stream={stream} mirrored hidden={false} videoRef={videoRef} drawRef={drawRef} />}
        {ev && (
          <div
            className={`card ${ev.status === 'passed' ? 'ok' : ev.status === 'blocked_safety' ? 'bad' : 'warn'}`}
          >
            <div className="row">
              {ev.status === 'passed' ? <CheckCircle2 color="var(--ok)" /> : null}
              <strong>
                {ev.status === 'passed' ? 'Passed!' : (ev.message ?? ev.worst?.hint ?? 'Waiting…')}
              </strong>
            </div>
            <div className="progress">
              <div style={{ width: `${Math.round(ev.progress * 100)}%` }} />
            </div>
            {ev.reps !== undefined && <span className="muted small">Reps: {ev.reps}</span>}
            {ev.fingerErrors?.length ? (
              <span className="muted small">
                Fingers to fix: {ev.fingerErrors.map((f) => `${f.finger} (${f.hint})`).join(', ')}
              </span>
            ) : null}
          </div>
        )}
        <button className="btn ghost block" onClick={() => setAttempt((a) => a + 1)}>
          <RotateCcw size={20} /> Try again
        </button>
      </div>
    </div>
  );
}
