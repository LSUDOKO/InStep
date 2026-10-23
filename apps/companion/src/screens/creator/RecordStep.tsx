import type { ReferenceTimeline } from '@instep/istep-format';
import type { LessonDetail } from '@instep/protocol';
import { AlertTriangle, Circle, Loader2, RotateCcw, Square, Upload, UploadCloud } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Preview } from '../../components/Preview';
import { creatorApi } from '../../lib/creatorApi';
import { getVision } from '../../lib/getVision';
import type { VisionResult } from '../../lib/landmarks';
import {
  extractReference,
  MAX_RECORD_SEC,
  pickMimeType,
  ReferenceBuilder,
  REFERENCE_FPS,
} from '../../lib/recorder';
import type { Tracker } from '../../lib/vision';

type Take = { video: Blob; reference: ReferenceTimeline; url: string };

/**
 * Records the instructor's demonstration (video + landmarks at 15 fps) or extracts landmarks from an
 * uploaded file, then uploads both. This is the only place InStep records video, and only on an explicit
 * "Record demonstration" action with a visible recording indicator.
 */
export function RecordStep({
  lesson,
  tracking,
  onUploaded,
}: {
  lesson: LessonDetail;
  tracking: Tracker[];
  onUploaded: () => void;
}) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [status, setStatus] = useState<
    'idle' | 'loading' | 'ready' | 'recording' | 'review' | 'extracting' | 'uploading'
  >('idle');
  const [elapsed, setElapsed] = useState(0);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [take, setTake] = useState<Take | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const drawRef = useRef<((r: VisionResult) => void) | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const builder = useRef<ReferenceBuilder | null>(null);
  const startedAt = useRef(0);

  useEffect(() => () => stream?.getTracks().forEach((t) => t.stop()), [stream]);

  const openCamera = async () => {
    setError('');
    setStatus('loading');
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: {
          facingMode: 'user',
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 },
        },
      });
      await (await getVision()).ensure(tracking);
      setStream(s);
      setStatus('ready');
    } catch (e) {
      setStatus('idle');
      setError(
        (e as DOMException).name === 'NotAllowedError'
          ? 'Camera access was blocked. Allow the camera for this site and try again.'
          : (e as Error).message,
      );
    }
  };

  // preview + landmark sampling loop
  useEffect(() => {
    if (!stream || (status !== 'ready' && status !== 'recording')) return;
    let raf = 0;
    let lastSample = -Infinity;
    const tick = async () => {
      raf = requestAnimationFrame(() => void tick());
      const v = videoRef.current;
      if (!v || v.readyState < 2) return;
      const vision = await getVision();
      const now = performance.now();
      const r = vision.detect(v, tracking, now);
      drawRef.current?.(r);
      if (status === 'recording' && now - lastSample >= 1000 / REFERENCE_FPS - 2) {
        lastSample = now;
        const t = (now - startedAt.current) / 1000;
        builder.current?.add(t, r);
        setElapsed(t);
        if (t >= MAX_RECORD_SEC) stop();
      }
    };
    raf = requestAnimationFrame(() => void tick());
    return () => cancelAnimationFrame(raf);
  }, [stream, status, tracking]);

  const start = () => {
    if (!stream) return;
    const mimeType = pickMimeType();
    const chunks: Blob[] = [];
    const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = () => {
      const video = new Blob(chunks, { type: rec.mimeType || 'video/webm' });
      setTake({ video, reference: builder.current!.build(), url: URL.createObjectURL(video) });
      setStatus('review');
    };
    builder.current = new ReferenceBuilder(tracking);
    startedAt.current = performance.now();
    recorder.current = rec;
    rec.start(1000);
    setElapsed(0);
    setStatus('recording');
  };

  const stop = () => recorder.current?.state === 'recording' && recorder.current.stop();

  const upload = async (t: { video: Blob; reference: ReferenceTimeline }) => {
    setStatus('uploading');
    setProgress(0);
    try {
      if (t.reference.frames.length < REFERENCE_FPS)
        throw new Error('The demonstration is too short — record at least a few seconds.');
      await creatorApi.upload(lesson.id, t.video, t.reference, setProgress);
      stream?.getTracks().forEach((tr) => tr.stop());
      onUploaded();
    } catch (e) {
      setError((e as Error).message);
      setStatus(take ? 'review' : 'idle');
    }
  };

  const onFile = async (file: File) => {
    setError('');
    setStatus('extracting');
    try {
      const vision = await getVision();
      await vision.ensure(tracking);
      const reference = await extractReference(file, vision, tracking, setProgress);
      await upload({ video: file, reference });
    } catch (e) {
      setError((e as Error).message);
      setStatus('idle');
    }
  };

  return (
    <div className="stack">
      <h2>Record the demonstration</h2>
      <p className="muted">
        Do each movement, then <strong>pause still for about a second</strong> at the key position — InStep
        turns those still moments into steps. Up to {MAX_RECORD_SEC} seconds. Only you, the instructor, are
        recorded.
      </p>
      {error && (
        <div className="banner bad" role="alert">
          <AlertTriangle size={20} /> {error}
        </div>
      )}

      {status === 'idle' && (
        <>
          <button className="btn primary block" onClick={() => void openCamera()}>
            <Circle size={20} /> Record demonstration
          </button>
          <label className="btn ghost block">
            <Upload size={20} /> Upload a video instead
            <input
              type="file"
              accept="video/*"
              hidden
              onChange={(e) => e.target.files?.[0] && void onFile(e.target.files[0])}
            />
          </label>
        </>
      )}
      {status === 'loading' && (
        <p className="row muted">
          <Loader2 className="spin" size={18} /> Opening the camera and body tracking…
        </p>
      )}

      {stream && (status === 'ready' || status === 'recording') && (
        <>
          <div style={{ position: 'relative' }}>
            <Preview stream={stream} mirrored hidden={false} videoRef={videoRef} drawRef={drawRef} />
            {status === 'recording' && (
              <span className="chip bad onvideo rec num" role="status">
                <span className="dot" /> REC {Math.floor(elapsed)}s / {MAX_RECORD_SEC}s
              </span>
            )}
          </div>
          {status === 'ready' ? (
            <button className="btn primary block" onClick={start}>
              <Circle size={20} fill="currentColor" /> Start recording
            </button>
          ) : (
            <button className="btn danger block" onClick={stop}>
              <Square size={20} fill="currentColor" /> Stop recording
            </button>
          )}
        </>
      )}

      {status === 'review' && take && (
        <>
          <video src={take.url} controls playsInline className="media" />
          <p className="muted small">
            {take.reference.frames.length} body-point frames captured ·{' '}
            {(take.video.size / 1024 / 1024).toFixed(1)} MB video
          </p>
          <button className="btn primary block" onClick={() => void upload(take)}>
            <UploadCloud size={20} /> Use this take
          </button>
          <button
            className="btn ghost block"
            onClick={() => {
              URL.revokeObjectURL(take.url);
              setTake(null);
              setStatus('ready');
            }}
          >
            <RotateCcw size={20} /> Record again
          </button>
        </>
      )}

      {(status === 'uploading' || status === 'extracting') && (
        <div className="card">
          <div className="row">
            <Loader2 className="spin" size={20} />{' '}
            {status === 'uploading'
              ? 'Uploading and converting your video…'
              : 'Finding body points in your video…'}
          </div>
          <div
            className="progress"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress * 100)}
          >
            <div style={{ width: `${Math.max(4, progress * 100)}%` }} />
          </div>
        </div>
      )}
    </div>
  );
}
