import { ShieldCheck, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { formatRate, meters } from '../lib/meter';

/**
 * Shows MEASURED bytes per second. "Video sent" reads the video meter, which only media-upload code
 * can increment — the camera page has none, so it reads 0. Nothing here is hard-coded.
 */
export function PrivacyPill({ lastMessage }: { lastMessage: string | null }) {
  const [rates, setRates] = useState({ video: 0, body: 0, videoTotal: 0, bodyTotal: 0 });
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const id = setInterval(
      () =>
        setRates({
          video: meters.video.rate(),
          body: meters.bodyPoints.rate(),
          videoTotal: meters.video.total,
          bodyTotal: meters.bodyPoints.total,
        }),
      1000,
    );
    return () => clearInterval(id);
  }, []);

  return (
    <>
      <button
        className="ledger"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        data-testid="privacy-pill"
      >
        <ShieldCheck size={26} aria-hidden />
        <span>
          <span className="k">Video sent</span>
          <span className={`v ${rates.video === 0 ? 'zero' : ''}`} data-testid="video-rate">
            {formatRate(rates.video)}
          </span>
        </span>
        <span>
          <span className="k">Body points</span>
          <span className="v" data-testid="body-rate">
            {formatRate(rates.body)}
          </span>
        </span>
      </button>
      {open && (
        <div className="sheet-backdrop" onClick={() => setOpen(false)}>
          <div
            className="sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="privacy-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="row">
              <h2 id="privacy-title" className="grow">
                What leaves this phone
              </h2>
              <button className="btn ghost icon" onClick={() => setOpen(false)} aria-label="Close">
                <X size={16} strokeWidth={2.5} aria-hidden />
              </button>
            </div>
            <p className="muted">
              Your camera picture is analysed here, in this browser. It is never uploaded or recorded. Only
              body points — numbers for the position of your joints and fingers — go to your TV.
            </p>
            <div className="stat-grid">
              <div className="stat">
                <span className="muted small">Video sent</span>
                <b>{formatRate(rates.video)}</b>
                <span className="muted small">{(rates.videoTotal / 1024).toFixed(1)} KB total</span>
              </div>
              <div className="stat">
                <span className="muted small">Body points sent</span>
                <b>{formatRate(rates.body)}</b>
                <span className="muted small">{(rates.bodyTotal / 1024).toFixed(1)} KB total</span>
              </div>
            </div>
            <p className="small muted">These numbers are measured by counting every byte this page sends.</p>
            <label>Latest message (live)</label>
            <pre data-testid="privacy-sample">{lastMessage ?? 'Nothing sent yet.'}</pre>
          </div>
        </div>
      )}
    </>
  );
}
