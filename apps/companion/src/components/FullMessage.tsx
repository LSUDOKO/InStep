import type { ReactNode } from 'react';
import { Brand } from './Brand';

/** Designed full-screen state (loading, denied, insecure context, room not found…). */
export function FullMessage(props: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
  actions?: ReactNode;
  tone?: 'bad' | 'warn';
}) {
  return (
    <main className="page">
      <Brand />
      <section className="full" aria-live="polite">
        <div
          className="icon-wrap"
          style={{
            color:
              props.tone === 'bad' ? 'var(--far)' : props.tone === 'warn' ? 'var(--near)' : 'var(--brand)',
          }}
        >
          {props.icon}
        </div>
        <h1>{props.title}</h1>
        <div className="stack lede">{props.children}</div>
        {props.actions && <div className="stack">{props.actions}</div>}
      </section>
    </main>
  );
}
