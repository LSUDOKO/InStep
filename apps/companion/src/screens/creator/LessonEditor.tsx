import type { Gate, IstepTrack, ReferenceTimeline } from '@instep/istep-format';
import { validateTrack } from '@instep/istep-format';
import type { LessonDetail } from '@instep/protocol';
import { AlertTriangle, ArrowLeft, CheckCircle2, Loader2, Save, Send, Tv } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Brand } from '../../components/Brand';
import { FullMessage } from '../../components/FullMessage';
import { creatorApi, CreatorError } from '../../lib/creatorApi';
import { navigate } from '../../lib/router';
import type { Tracker } from '../../lib/vision';
import { PinGate } from './CreatorHome';
import { GateEditor } from './GateEditor';
import { GatePreview } from './GatePreview';
import { RecordStep } from './RecordStep';

export default function LessonEditor({ id }: { id: string }) {
  return (
    <PinGate>
      <Editor id={id} />
    </PinGate>
  );
}

function Editor({ id }: { id: string }) {
  const [lesson, setLesson] = useState<LessonDetail | null>(null);
  const [track, setTrack] = useState<IstepTrack | null>(null);
  const [reference, setReference] = useState<ReferenceTimeline>();
  const [gates, setGates] = useState<Gate[]>([]);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState<'' | 'suggest' | 'save' | 'publish'>('');
  const [note, setNote] = useState<{ tone: 'ok' | 'bad' | 'info'; text: string } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<Gate | null>(null);

  const load = useCallback(async () => {
    try {
      const l = await creatorApi.lesson(id);
      const t = await creatorApi.track(id);
      setLesson(l);
      setTrack(t);
      setGates(t.gates);
      if (l.referenceUrl) setReference(await creatorApi.reference(l.referenceUrl));
      return { l, t };
    } catch (e) {
      setLoadError((e as Error).message);
      return null;
    }
  }, [id]);

  const suggest = useCallback(async () => {
    setBusy('suggest');
    setNote(null);
    try {
      const r = await creatorApi.autogates(id);
      setGates(r.gates);
      setNote({
        tone: 'info',
        text: `InStep suggested ${r.gates.length} ${r.gates.length === 1 ? 'step' : 'steps'} from your still moments${r.labels === 'ai' ? ' (wording by Amazon Bedrock)' : ''}. Check and edit them below.`,
      });
    } catch (e) {
      setNote({ tone: 'bad', text: (e as Error).message });
    } finally {
      setBusy('');
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loadError)
    return (
      <FullMessage icon={<AlertTriangle size={30} />} title="Couldn't open this lesson" tone="bad">
        <p>{loadError}</p>
      </FullMessage>
    );
  if (!lesson || !track)
    return (
      <FullMessage icon={<Loader2 size={30} className="spin" />} title="Opening lesson…">
        <p>One moment.</p>
      </FullMessage>
    );
  if (!lesson.editable)
    return (
      <FullMessage icon={<AlertTriangle size={30} />} title="Built-in lesson" tone="warn">
        <p>Built-in demonstration lessons are read-only.</p>
      </FullMessage>
    );

  const tracking = track.tracking as Tracker[];

  const save = async (andPublish: boolean) => {
    const next: IstepTrack = { ...track, gates: [...gates].sort((a, b) => a.t - b.t) };
    const v = validateTrack(next);
    if (!v.ok) {
      const byGate: Record<string, string> = {};
      for (const e of v.errors) {
        const m = e.path.match(/^gates\[(\d+)\]/);
        const g = m ? next.gates[Number(m[1])] : undefined;
        if (g) byGate[g.id] ??= e.message;
      }
      setErrors(byGate);
      setNote({ tone: 'bad', text: `Please fix: ${v.errors[0]!.path} — ${v.errors[0]!.message}` });
      return;
    }
    setErrors({});
    setBusy(andPublish ? 'publish' : 'save');
    try {
      await creatorApi.saveTrack(id, v.value);
      setTrack(v.value);
      if (andPublish) {
        const t0 = performance.now();
        await creatorApi.publish(id);
        setLesson({ ...lesson, status: 'published' });
        setNote({
          tone: 'ok',
          text: `Published in ${((performance.now() - t0) / 1000).toFixed(1)} s — it's now on every InStep TV.`,
        });
      } else setNote({ tone: 'ok', text: 'Draft saved.' });
    } catch (e) {
      setNote({
        tone: 'bad',
        text:
          e instanceof CreatorError && e.details?.length
            ? `${e.details[0]!.path}: ${e.details[0]!.message}`
            : (e as Error).message,
      });
    } finally {
      setBusy('');
    }
  };

  return (
    <main className="page" style={{ maxWidth: 820 }}>
      <div className="topbar">
        <button className="btn ghost" onClick={() => navigate('/c/creator')}>
          <ArrowLeft size={20} /> Lessons
        </button>
        <Brand />
      </div>
      <div className="row">
        <h1 className="grow" style={{ fontSize: 24 }}>
          {lesson.title}
        </h1>
        <span className={`chip ${lesson.status === 'published' ? 'ok' : 'warn'}`}>
          {lesson.status === 'published' ? 'Published' : 'Draft'}
        </span>
      </div>

      {note && (
        <div
          className={`banner ${note.tone === 'bad' ? 'bad' : ''}`}
          role="status"
          style={
            note.tone === 'ok'
              ? { background: 'color-mix(in srgb, var(--ok) 16%, var(--surface))' }
              : undefined
          }
        >
          {note.tone === 'ok' ? (
            <CheckCircle2 size={20} />
          ) : note.tone === 'bad' ? (
            <AlertTriangle size={20} />
          ) : (
            <Tv size={20} />
          )}{' '}
          {note.text}
        </div>
      )}

      {!lesson.videoUrl ? (
        <RecordStep
          lesson={lesson}
          tracking={tracking}
          onUploaded={() =>
            void load().then((r) => {
              if (r && r.t.gates.length === 0) void suggest();
            })
          }
        />
      ) : (
        <>
          {busy === 'suggest' && (
            <p className="row muted">
              <Loader2 className="spin" size={18} /> Finding the key moments…
            </p>
          )}
          <GateEditor
            videoUrl={lesson.videoUrl}
            track={track}
            {...(reference ? { reference } : {})}
            gates={gates}
            onChange={setGates}
            onAutogates={() => void suggest()}
            onPreview={setPreview}
            errors={errors}
          />
          <div className="row">
            <button className="btn ghost grow" disabled={!!busy} onClick={() => void save(false)}>
              {busy === 'save' ? <Loader2 className="spin" size={20} /> : <Save size={20} />} Save draft
            </button>
            <button
              className="btn primary grow"
              disabled={!!busy || gates.length === 0}
              onClick={() => void save(true)}
            >
              {busy === 'publish' ? <Loader2 className="spin" size={20} /> : <Send size={20} />} Publish to TV
            </button>
          </div>
        </>
      )}
      {preview && (
        <GatePreview
          gate={preview}
          {...(reference ? { reference } : {})}
          tracking={tracking}
          onClose={() => setPreview(null)}
        />
      )}
    </main>
  );
}
