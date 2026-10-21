import type { Catalog } from '@instep/protocol';
import { AlertTriangle, KeyRound, Loader2, Lock, Plus, Video } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Brand } from '../../components/Brand';
import { FullMessage } from '../../components/FullMessage';
import { creatorApi, creatorPin } from '../../lib/creatorApi';
import { navigate } from '../../lib/router';

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
      <p className="muted">
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
  const all = catalog?.channels.flatMap((c) => c.lessons.map((l) => ({ ...l, channelTitle: c.title }))) ?? [];
  const mine = all.filter((l) => l.editable);
  const builtIn = all.filter((l) => !l.editable);

  return (
    <main className="page">
      <div className="topbar">
        <Brand />
        <span className="chip info">Creator Studio</span>
      </div>
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
          <h1 style={{ fontSize: 22 }}>Your lessons</h1>
          {mine.length === 0 && (
            <p className="muted">No lessons yet. Tap “New lesson” to record your first one.</p>
          )}
          {mine.map((l) => (
            <button
              key={l.id}
              className="card"
              style={{ textAlign: 'left', border: 0, cursor: 'pointer' }}
              onClick={() => navigate(`/c/creator/${l.id}`)}
            >
              <div className="row">
                <Video size={20} color="var(--brand)" />
                <strong className="grow">{l.title}</strong>
                <span className={`chip ${l.status === 'published' ? 'ok' : 'warn'}`}>
                  {l.status === 'published' ? 'Published' : 'Draft'}
                </span>
              </div>
              <span className="muted small">
                {l.channelTitle} · {l.gateCount} steps
              </span>
            </button>
          ))}
          {builtIn.length > 0 && (
            <>
              <h1 style={{ fontSize: 22 }}>Built-in demonstration lessons</h1>
              {builtIn.map((l) => (
                <div key={l.id} className="card">
                  <div className="row">
                    <Lock size={18} color="var(--text-muted)" />
                    <strong className="grow">{l.title}</strong>
                    <span className={`chip ${l.status === 'published' ? 'ok' : 'warn'}`}>
                      {l.status === 'published' ? 'On TV' : 'Video not recorded'}
                    </span>
                  </div>
                  <span className="muted small">{l.channelTitle} · read-only</span>
                </div>
              ))}
            </>
          )}
        </>
      )}
    </main>
  );
}
