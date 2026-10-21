import { AlertTriangle, Loader2, Printer, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Brand } from '../components/Brand';
import { FullMessage } from '../components/FullMessage';

type ReportData = {
  learner: { name: string; avatar: string };
  days: number;
  progress: {
    days: { date: string; sessions: number; reps: number; holdSec: number }[];
    totals: { sessions: number; reps: number; holdSec: number; streakDays: number };
  };
  adherence: { done: number; planned: number };
  swayStops: number;
  sessions: {
    lessonTitle: string;
    startedAt: string;
    gatesPassed: number;
    gatesTotal: number;
    reps: number;
    bestHoldSec: number;
    avgBpm: number | null;
    easierMode: boolean;
  }[];
  needsCoaching: { label: string; lessonId: string; coachedCount: number }[];
};

/** Read-only caregiver / physio report from a share link. Body-point-derived numbers only. */
export default function Report({ token }: { token: string }) {
  const [data, setData] = useState<ReportData | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    fetch(`/api/reports/${token}`)
      .then(async (r) =>
        r.ok
          ? r.json()
          : Promise.reject(
              new Error((await r.json().catch(() => ({}))).message ?? 'This report is not available.'),
            ),
      )
      .then(setData, (e: Error) => setError(e.message));
  }, [token]);

  if (error)
    return (
      <FullMessage icon={<AlertTriangle size={30} />} title="Report not available" tone="warn">
        <p>{error}</p>
      </FullMessage>
    );
  if (!data)
    return (
      <FullMessage icon={<Loader2 className="spin" size={30} />} title="Loading report…">
        <p>One moment.</p>
      </FullMessage>
    );

  const max = Math.max(1, ...data.progress.days.map((d) => d.reps));
  const pct = data.adherence.planned
    ? Math.min(100, Math.round((data.adherence.done / data.adherence.planned) * 100))
    : null;
  return (
    <main className="page report" style={{ maxWidth: 820 }}>
      <div className="topbar">
        <Brand />
        <button className="btn ghost no-print" onClick={() => print()}>
          <Printer size={18} /> Print
        </button>
      </div>
      <h1>
        {data.learner.name}'s practice — last {data.days} days
      </h1>
      <div className="banner" style={{ background: 'color-mix(in srgb, var(--ok) 14%, var(--surface))' }}>
        <ShieldCheck size={20} color="var(--ok)" /> No video is ever recorded or stored. These numbers come
        from body points only.
      </div>
      <div className="stat-grid">
        <div className="stat">
          <span className="muted small">Sessions</span>
          <b>
            {data.adherence.done}
            {data.adherence.planned ? ` of ${data.adherence.planned} planned` : ''}
          </b>
          {pct !== null && <span className="muted small">{pct}% of the plan</span>}
        </div>
        <div className="stat">
          <span className="muted small">Repetitions</span>
          <b>{data.progress.totals.reps}</b>
        </div>
        <div className="stat">
          <span className="muted small">Days in a row (now)</span>
          <b>{data.progress.totals.streakDays}</b>
        </div>
        <div className="stat">
          <span className="muted small">Rest breaks (sway stops)</span>
          <b>{data.swayStops}</b>
        </div>
      </div>

      <section className="card">
        <strong>Repetitions per day</strong>
        <div className="bars" role="img" aria-label="Repetitions per day chart">
          {data.progress.days.map((d) => (
            <div
              key={d.date}
              className={d.sessions ? 'on' : ''}
              title={`${d.date}: ${d.reps} reps, ${d.sessions} sessions`}
              style={{ height: `${Math.max(3, (d.reps / max) * 100)}%` }}
            />
          ))}
        </div>
        <div className="row muted small" style={{ justifyContent: 'space-between' }}>
          <span>{data.progress.days[0]?.date}</span>
          <span>{data.progress.days.at(-1)?.date}</span>
        </div>
      </section>

      {data.needsCoaching.length > 0 && (
        <section className="card">
          <strong>Steps that needed a tip most often</strong>
          {data.needsCoaching.map((n) => (
            <div key={n.lessonId + n.label} className="row">
              <span className="grow">{n.label}</span>
              <span className="muted">{n.coachedCount}×</span>
            </div>
          ))}
        </section>
      )}

      <section className="card">
        <strong>Sessions</strong>
        {data.sessions.length === 0 && <p className="muted">No sessions in this period yet.</p>}
        {data.sessions.map((s) => (
          <div
            key={s.startedAt}
            className="stack"
            style={{ gap: 2, borderTop: '1px solid var(--surface-2)', paddingTop: 8 }}
          >
            <span>
              <strong>{new Date(s.startedAt).toLocaleDateString()}</strong> {s.lessonTitle}
            </span>
            <span className="muted small">
              {s.gatesPassed} of {s.gatesTotal} steps{s.reps ? `, ${s.reps} reps` : ''}
              {s.bestHoldSec ? `, best hold ${s.bestHoldSec} s` : ''}
              {s.avgBpm ? `, ${s.avgBpm} per minute` : ''}
              {s.easierMode ? ', easier mode' : ''}
            </span>
          </div>
        ))}
      </section>
      <p className="muted small">
        InStep is a practice aid and has not been clinically tested. It does not diagnose anything.
      </p>
    </main>
  );
}
