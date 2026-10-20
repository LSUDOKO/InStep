import { HAND_EDGES, POSE_EDGES } from '@instep/gate-engine';
import { useEffect, useRef } from 'react';
import type { VisionResult } from '../lib/landmarks';

/**
 * Local-only camera preview with the detected skeleton drawn on top. The video element never leaves
 * this component; it is the MediaPipe input. `drawRef` lets the inference loop draw without re-rendering.
 */
export function Preview(props: {
  stream: MediaStream;
  mirrored: boolean;
  hidden: boolean;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  drawRef: React.RefObject<((r: VisionResult) => void) | null>;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const v = props.videoRef.current;
    if (v && v.srcObject !== props.stream) {
      v.srcObject = props.stream;
      void v.play().catch(() => undefined);
    }
  }, [props.stream, props.videoRef]);

  useEffect(() => {
    props.drawRef.current = (r) => {
      const c = canvasRef.current;
      const v = props.videoRef.current;
      if (!c || !v || props.hidden) return;
      const w = (c.width = c.clientWidth * devicePixelRatio);
      const h = (c.height = c.clientHeight * devicePixelRatio);
      const ctx = c.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, w, h);
      // map normalised video coords into the object-fit: cover box
      const vw = v.videoWidth || 16;
      const vh = v.videoHeight || 9;
      const s = Math.max(w / vw, h / vh);
      const ox = (w - vw * s) / 2;
      const oy = (h - vh * s) / 2;
      const X = (x: number) => ox + (props.mirrored ? 1 - x : x) * vw * s;
      const Y = (y: number) => oy + y * vh * s;
      ctx.lineCap = 'round';
      const lines = (
        pts: { x: number; y: number; visibility?: number }[],
        edges: [number, number][],
        color: string,
        width: number,
      ) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = width * devicePixelRatio;
        for (const [a, b] of edges) {
          const p = pts[a];
          const q = pts[b];
          if (!p || !q || (p.visibility ?? 1) < 0.5 || (q.visibility ?? 1) < 0.5) continue;
          ctx.beginPath();
          ctx.moveTo(X(p.x), Y(p.y));
          ctx.lineTo(X(q.x), Y(q.y));
          ctx.stroke();
        }
      };
      if (r.pose) lines(r.pose, POSE_EDGES, '#3DDC97', 5);
      for (const hand of r.hands ?? []) lines(hand.landmarks, HAND_EDGES, '#4FD1C5', 3);
      ctx.strokeStyle = '#FFB547';
      ctx.lineWidth = 3 * devicePixelRatio;
      for (const o of r.objects ?? []) {
        const [x, y, bw, bh] = o.box;
        const x1 = X(x);
        const x2 = X(x + bw);
        ctx.strokeRect(Math.min(x1, x2), Y(y), Math.abs(x2 - x1), bh * vh * s);
      }
    };
  }, [props.drawRef, props.hidden, props.mirrored, props.videoRef]);

  return (
    <>
      {/* Hidden previews stay rendered at 1 px so the browser keeps decoding frames for MediaPipe. */}
      <div
        className="preview"
        style={
          props.hidden
            ? { position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }
            : undefined
        }
      >
        <video
          ref={props.videoRef}
          className={props.mirrored ? 'mirror' : ''}
          playsInline
          muted
          autoPlay
          aria-label="Your camera preview (stays on this device)"
        />
        <canvas ref={canvasRef} aria-hidden />
      </div>
      {props.hidden && <div className="preview-hidden">Preview hidden — the camera is still working</div>}
    </>
  );
}
