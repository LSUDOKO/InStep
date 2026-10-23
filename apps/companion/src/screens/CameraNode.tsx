import type { Message } from '@instep/protocol';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  LogOut,
  Mic,
  RefreshCw,
  SwitchCamera,
  Tv,
  VideoOff,
  WifiOff,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Brand } from '../components/Brand';
import { FullMessage } from '../components/FullMessage';
import { Preview } from '../components/Preview';
import { PrivacyPill } from '../components/PrivacyPill';
import { buildLandmarksMessage, RateLimiter, type VisionResult } from '../lib/landmarks';
import { placementAdvice, type CameraView, type Placement } from '../lib/placement';
import { RelayClient, relayUrl, type RelayState } from '../lib/relay';
import { getVision, loadedVision } from '../lib/getVision';
import { Metronome } from '../lib/metronome';
import {
  listenOnce,
  parseVoiceCommand,
  RaiseHandDetector,
  speechRecognitionAvailable,
} from '../lib/handsfree';
import type { Tracker } from '../lib/vision';

type Phase =
  | { kind: 'join'; error?: string }
  | { kind: 'camera' }
  | { kind: 'denied'; reason: 'denied' | 'no-camera' | 'busy' | 'other'; detail?: string }
  | { kind: 'models'; done: number; total: number }
  | { kind: 'live' };

type Lesson = { lessonId: string; tracking: Tracker[]; view: CameraView; hint?: string; gestures: boolean };
type GateInfo = Extract<Message, { type: 'gate_state' }>;

const MAX_SEND_PER_SEC = 30;
/** ?record=1 keeps the landmarks messages sent (numbers only) so they can be saved on this device for replay tests. */
const RECORD = new URLSearchParams(location.search).get('record') === '1';
const recording: string[] = [];
function downloadRecording() {
  const blob = new Blob([recording.join('\n') + '\n'], { type: 'application/x-ndjson' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `instep-landmarks-${new Date().toISOString().replace(/[:.]/g, '-')}.jsonl`;
  a.click();
  URL.revokeObjectURL(a.href);
}
const metronome = new Metronome();

/** Compact, readable copy of the last message for the privacy sheet. */
function sample(m: unknown): string {
  return JSON.stringify(
    m,
    (k, v) =>
      Array.isArray(v) && v.length > 3 && Array.isArray(v[0])
        ? [...v.slice(0, 2), `… ${v.length} points`]
        : v,
    1,
  );
}

export function CameraNode() {
  const params = new URLSearchParams(location.search);
  const role: 'host' | 'guest' = params.get('role') === 'guest' ? 'guest' : 'host';
  const [room, setRoom] = useState((params.get('room') ?? '').replace(/\D/g, '').slice(0, 4));
  const [name, setName] = useState(params.get('name') ?? '');
  const [phase, setPhase] = useState<Phase>({ kind: 'join' });
  const [relayState, setRelayState] = useState<RelayState>({ kind: 'connecting' });
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facing, setFacing] = useState<'user' | 'environment'>('user');
  const [hidePreview, setHidePreview] = useState(false);
  const [lesson, setLesson] = useState<Lesson>({
    lessonId: '',
    tracking: ['pose'],
    view: 'front',
    gestures: false,
  });
  const [loadingTrackers, setLoadingTrackers] = useState(false);
  const [placement, setPlacement] = useState<Placement | null>(null);
  const [gate, setGate] = useState<GateInfo | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [fps, setFps] = useState(0);
  const [lastMessage, setLastMessage] = useState<string | null>(null);

  const relay = useRef<RelayClient | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const drawRef = useRef<((r: VisionResult) => void) | null>(null);
  const lessonRef = useRef(lesson);
  lessonRef.current = lesson;

  const secure = window.isSecureContext;
  const hasCamera = !!navigator.mediaDevices?.getUserMedia;

  // ---- camera ---------------------------------------------------------------
  const openCamera = useCallback(async (face: 'user' | 'environment') => {
    setPhase({ kind: 'camera' });
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: face, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
      });
      setStream((old) => {
        old?.getTracks().forEach((t) => t.stop());
        return s;
      });
      return true;
    } catch (e) {
      const n = (e as DOMException).name;
      setPhase({
        kind: 'denied',
        reason:
          n === 'NotAllowedError' || n === 'SecurityError'
            ? 'denied'
            : n === 'NotFoundError' || n === 'OverconstrainedError'
              ? 'no-camera'
              : n === 'NotReadableError'
                ? 'busy'
                : 'other',
        detail: (e as Error).message,
      });
      return false;
    }
  }, []);

  const start = useCallback(async () => {
    metronome.unlock(); // a user gesture: allowed to make sound later
    if (!(await openCamera(facing))) return;
    setPhase({ kind: 'models', done: 0, total: 1 });
    try {
      await (
        await getVision()
      ).ensure(lessonRef.current.tracking, (done, total) => setPhase({ kind: 'models', done, total }));
    } catch (e) {
      setPhase({
        kind: 'denied',
        reason: 'other',
        detail: `Could not load the body-tracking models: ${(e as Error).message}`,
      });
      return;
    }
    setPhase({ kind: 'live' });
  }, [facing, openCamera]);

  useEffect(() => () => stream?.getTracks().forEach((t) => t.stop()), [stream]);

  // ---- relay ----------------------------------------------------------------
  useEffect(() => {
    if (phase.kind !== 'live' || relay.current) return;
    relay.current = new RelayClient({
      url: relayUrl(),
      room,
      role,
      ...(name ? { name } : {}),
      onState: (s) => {
        setRelayState(s);
        if (s.kind === 'failed') {
          relay.current = null;
          setPhase({ kind: 'join', error: s.message });
        }
      },
      onMessage: (m) => {
        if (m.type === 'lesson_tracking') {
          const next: Lesson = {
            lessonId: m.lessonId,
            tracking: m.tracking,
            view: m.cameraView,
            gestures: m.gesturesEnabled,
            ...(m.hint ? { hint: m.hint } : {}),
          };
          setLoadingTrackers(true);
          void getVision()
            .then((v) => v.ensure(m.tracking))
            .then(() => setLesson(next))
            .finally(() => setLoadingTrackers(false));
        } else if (m.type === 'gate_state') {
          setGate(m);
          metronome.set(m.status !== 'passed' ? (m.metronomeBpm ?? null) : null);
        } else if (m.type === 'gate_result') {
          metronome.stop();
          setToast('Nice! Step passed');
          navigator.vibrate?.(120);
          setTimeout(() => setToast(null), 1600);
        } else if (m.type === 'speak' && 'speechSynthesis' in window) {
          const u = new SpeechSynthesisUtterance(m.text);
          u.lang = m.language;
          speechSynthesis.speak(u);
        } else if (m.type === 'lesson_ended') {
          setGate(null);
          metronome.stop();
        }
      },
    });
    return undefined;
  }, [phase.kind, room, role, name]);

  useEffect(
    () => () => {
      relay.current?.close();
      relay.current = null;
    },
    [],
  );

  // ---- inference loop: detect every new frame, send ≤ 30/s, never queue -----
  useEffect(() => {
    if (phase.kind !== 'live') return;
    let raf = 0;
    let lastVideoTime = -1;
    let seq = 0;
    let frames = 0;
    let fpsNow = 0;
    let lastPlacement = 0;
    const limiter = new RateLimiter(MAX_SEND_PER_SEC);
    const raise = new RaiseHandDetector();
    let last: unknown = null;
    const fpsTimer = setInterval(() => {
      fpsNow = frames;
      setFps(frames);
      frames = 0;
    }, 1000);
    const sampleTimer = setInterval(() => {
      if (last) setLastMessage(sample(last));
    }, 1000);

    const tick = () => {
      raf = requestAnimationFrame(tick);
      const v = videoRef.current;
      if (!v || v.readyState < 2 || v.currentTime === lastVideoTime) return;
      lastVideoTime = v.currentTime;
      const now = performance.now();
      const { tracking, view } = lessonRef.current;
      const vision = loadedVision();
      if (!vision) return;
      const r = vision.detect(v, tracking, now);
      frames++;
      drawRef.current?.(r);
      if (now - lastPlacement > 250) {
        lastPlacement = now;
        setPlacement(placementAdvice(view, r, tracking));
      }
      // Hands-free: raise a hand for 1.5 s to pause/resume (only when the lesson's poses don't raise arms).
      if (
        lessonRef.current.gestures &&
        lessonRef.current.tracking.includes('pose') &&
        raise.push(r.pose, now)
      ) {
        relay.current?.send({ type: 'control', action: 'toggle_pause', source: 'gesture' });
        flashRef.current('Hand raised — pause / play');
      }
      if (limiter.allow(now) && relay.current?.open) {
        const msg = buildLandmarksMessage(r, { seq: seq++, ts: Date.now(), role, tracking, fps: fpsNow });
        if (relay.current.send(msg)) {
          last = msg;
          if (RECORD) recording.push(JSON.stringify(msg));
        }
      }
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(fpsTimer);
      clearInterval(sampleTimer);
    };
  }, [phase.kind, role]);

  const flash = useCallback((text: string) => {
    setToast(text);
    setTimeout(() => setToast(null), 1600);
  }, []);
  const flashRef = useRef(flash);
  const [listening, setListening] = useState(false);
  const voice = async () => {
    setListening(true);
    try {
      const heard = await listenOnce('en-US');
      const action = parseVoiceCommand(heard);
      if (action) {
        relay.current?.send({ type: 'control', action, source: 'voice' });
        flash(`“${heard}” → ${action}`);
      } else flash(`Heard “${heard}” — try “pause”, “play”, “repeat” or “easier”`);
    } catch (e) {
      flash((e as Error).message);
    } finally {
      setListening(false);
    }
  };

  const leave = () => {
    relay.current?.close();
    relay.current = null;
    stream?.getTracks().forEach((t) => t.stop());
    setStream(null);
    setPhase({ kind: 'join' });
  };

  // ---- screens --------------------------------------------------------------
  if (!secure)
    return (
      <FullMessage icon={<Lock size={30} />} title="This page needs a secure connection" tone="warn">
        <p>
          Browsers only allow the camera on HTTPS pages. Open the address shown on your TV — it starts with
          https://.
        </p>
        <p className="small">
          Setting this up? Run <code>pnpm cert</code> on the computer running InStep and install its
          certificate on this phone (see README).
        </p>
      </FullMessage>
    );
  if (!hasCamera)
    return (
      <FullMessage icon={<VideoOff size={30} />} title="This browser can't use the camera" tone="bad">
        <p>Try Chrome on Android, Safari on iPhone (iOS 17+), or Chrome on a laptop.</p>
      </FullMessage>
    );

  if (phase.kind === 'denied') {
    const copy = {
      denied: [
        'Camera access was blocked',
        'Tap the camera or lock icon in the address bar, allow the camera for this site, then try again.',
      ],
      'no-camera': [
        'No camera found',
        'This device does not seem to have a camera we can use. Try another phone or laptop.',
      ],
      busy: [
        'The camera is busy',
        'Another app is using the camera. Close it (video calls, camera app), then try again.',
      ],
      other: ['Something went wrong', phase.detail ?? 'Please try again.'],
    }[phase.reason];
    return (
      <FullMessage
        icon={<AlertTriangle size={30} />}
        title={copy[0]!}
        tone="bad"
        actions={
          <button className="btn primary block" onClick={() => void start()}>
            <RefreshCw size={20} /> Try again
          </button>
        }
      >
        <p>{copy[1]}</p>
      </FullMessage>
    );
  }

  if (phase.kind === 'camera' || phase.kind === 'models')
    return (
      <FullMessage
        icon={<Loader2 size={30} className="spin" />}
        title={phase.kind === 'camera' ? 'Opening your camera…' : 'Getting body tracking ready…'}
      >
        {phase.kind === 'models' ? (
          <>
            <p>This runs on your phone. It can take a few seconds the first time.</p>
            <div
              className="progress"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={phase.total}
              aria-valuenow={phase.done}
            >
              <div style={{ width: `${Math.max(8, (phase.done / phase.total) * 100)}%` }} />
            </div>
          </>
        ) : (
          <p>If your browser asks, choose “Allow”.</p>
        )}
      </FullMessage>
    );

  if (phase.kind === 'join')
    return (
      <main className="page">
        <Brand />
        <h1>{role === 'guest' ? 'Join a practice together' : 'Use this phone as the camera'}</h1>
        <p className="lede">
          {role === 'guest'
            ? 'Your TV will wait for both of you to get each step right.'
            : 'The video on your TV pauses at each step and continues when you get it right.'}
        </p>
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            if (room.length === 4) void start();
          }}
        >
          {phase.error && (
            <div className="banner bad" role="alert">
              <AlertTriangle size={20} /> {phase.error}
            </div>
          )}
          <label htmlFor="room">Room code on your TV</label>
          <div className="code" aria-describedby="room-help">
            <input
              id="room"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={4}
              value={room}
              onChange={(e) => setRoom(e.target.value.replace(/\D/g, '').slice(0, 4))}
              aria-label="Four-digit room code"
            />
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                aria-hidden
                className={`cell ${room[i] ? 'filled' : ''} ${room.length === i ? 'active' : ''}`}
              >
                {room[i] ?? ''}
              </div>
            ))}
          </div>
          <p id="room-help" className="muted small footer-note">
            The four numbers under the QR code on your TV.
          </p>
          {role === 'guest' && (
            <>
              <label htmlFor="name">Your name (shown on the TV)</label>
              <input
                id="name"
                className="text-input"
                maxLength={40}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </>
          )}
          <div className="callout ok">
            <Lock size={20} color="var(--ok)" aria-hidden />
            <p>
              <strong>Your camera stays on this phone.</strong> Only body points — numbers for where your
              joints are — go to the TV. You can watch the live count at any time.
            </p>
          </div>
          <button
            className="btn primary block"
            type="submit"
            disabled={room.length !== 4 || (role === 'guest' && !name.trim())}
          >
            <Camera size={20} /> Start camera
          </button>
        </form>
      </main>
    );

  // ---- live -----------------------------------------------------------------
  const tvOk = relayState.kind === 'joined' && relayState.tvConnected;
  const status =
    relayState.kind === 'joined'
      ? tvOk
        ? { cls: 'ok', text: 'Connected to TV' }
        : { cls: 'warn', text: 'Waiting for TV' }
      : relayState.kind === 'reconnecting'
        ? { cls: 'bad', text: 'Reconnecting…' }
        : { cls: 'info', text: 'Connecting…' };

  const gateTone = gate
    ? gate.status === 'blocked_safety'
      ? 'bad'
      : gate.status === 'passed'
        ? 'ok'
        : 'brand'
    : '';
  return (
    <main className="page bleed">
      {/* hero: the camera preview, with the connection badge and the TV's current instruction on it */}
      <div className="hero">
        {stream && (
          <Preview
            stream={stream}
            mirrored={facing === 'user'}
            hidden={hidePreview}
            videoRef={videoRef}
            drawRef={drawRef}
          />
        )}
        <div className="overlay-top">
          <Brand />
          <span className={`chip onvideo ${status.cls}`} role="status" data-testid="connection">
            <span className="dot" /> {status.text}
          </span>
        </div>
        {gate && !hidePreview && (
          <div className="overlay-bottom">
            <Tv
              size={22}
              color={gate.status === 'blocked_safety' ? 'var(--far)' : 'var(--brand)'}
              aria-hidden
            />
            <div className="grow">
              <strong>{gate.label}</strong>
              {gate.worst && <div className="muted small">{gate.worst.hint}</div>}
            </div>
          </div>
        )}
      </div>

      {relayState.kind === 'reconnecting' && (
        <div className="banner" role="alert">
          <WifiOff size={20} /> Lost the connection to your TV. Reconnecting to room {room}.
        </div>
      )}

      <div className="list" aria-live="polite">
        {placement && (
          <div className={`item ${placement.ok ? 'ok' : 'warn'}`}>
            <span className="mark">
              <Camera size={17} aria-hidden />
            </span>
            <span>
              <span className="title" data-testid="placement">
                {placement.message}
              </span>
              {lesson.hint && <span className="sub">{lesson.hint}</span>}
            </span>
            {placement.ok ? (
              <CheckCircle2 size={22} color="var(--ok)" aria-label="Good" />
            ) : (
              <AlertTriangle size={22} color="var(--near)" aria-label="Adjust" />
            )}
          </div>
        )}
        {gate && hidePreview && (
          <div className={`item ${gateTone}`}>
            <span className="mark">
              <Tv size={17} aria-hidden />
            </span>
            <span>
              <span className="title">{gate.label}</span>
              {gate.worst && <span className="sub">{gate.worst.hint}</span>}
            </span>
          </div>
        )}
        {loadingTrackers && (
          <div className="item brand">
            <span className="mark">
              <Loader2 className="spin" size={17} aria-hidden />
            </span>
            <span className="title">Getting ready for this lesson</span>
          </div>
        )}
        <div className="item">
          <span className="mark" style={{ background: 'var(--indigo)' }}>
            <Tv size={17} aria-hidden />
          </span>
          <span>
            <span className="title">Room {room}</span>
            <span className="sub num">
              {role === 'guest' ? `Practising together as ${name}` : 'This phone is the camera'}
              {fps ? ` — ${fps} frames per second` : ''}
            </span>
          </span>
        </div>
      </div>

      {speechRecognitionAvailable() && (
        <div className="list">
          <button className="item action" onClick={() => void voice()} disabled={listening}>
            <span className="mark">
              <Mic size={20} aria-hidden />
            </span>
            {listening ? (
              <span className="title">Listening…</span>
            ) : (
              <span>
                <span className="title">Say a command:</span>
                <span className="sub">pause, play, repeat, easier</span>
              </span>
            )}
          </button>
        </div>
      )}
      {lesson.gestures && (
        <p className="muted small footer-note">
          Hands-free: raise one hand above your head for two seconds to pause or play.
        </p>
      )}

      <div className="stack">
        {RECORD && (
          <button className="btn ghost block" onClick={downloadRecording}>
            Save landmarks recording (numbers only, stays on this device)
          </button>
        )}
        <div className="row">
          <button
            className="btn ghost grow"
            onClick={() => setHidePreview((h) => !h)}
            aria-pressed={hidePreview}
          >
            {hidePreview ? <Eye size={20} /> : <EyeOff size={20} />}{' '}
            {hidePreview ? 'Show preview' : 'Hide preview'}
          </button>
          <button
            className="btn ghost icon"
            aria-label="Switch camera"
            onClick={() => {
              const f = facing === 'user' ? 'environment' : 'user';
              setFacing(f);
              void openCamera(f).then((ok) => ok && setPhase({ kind: 'live' }));
            }}
          >
            <SwitchCamera size={22} />
          </button>
          <button className="btn ghost icon" aria-label="Leave" onClick={leave}>
            <LogOut size={22} />
          </button>
        </div>
      </div>

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
      <PrivacyPill lastMessage={lastMessage} />
    </main>
  );
}
