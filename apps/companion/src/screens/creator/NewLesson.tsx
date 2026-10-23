import { AlertTriangle, ArrowRight, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { Brand } from '../../components/Brand';
import { creatorApi } from '../../lib/creatorApi';
import { navigate } from '../../lib/router';
import { PinGate } from './CreatorHome';

const FALL =
  'Use exercises prescribed or approved by your physiotherapist. Stop if you feel pain, dizziness or unsteadiness.';
export const CHANNELS = [
  {
    id: 'fall_prevention',
    label: 'Fall Prevention',
    view: 'front',
    hint: 'Place the camera at hip height, 2–3 m away.',
    disclaimer: FALL,
    needs: 'A sturdy chair',
  },
  {
    id: 'sign_language',
    label: 'Sign Language for Families',
    view: 'hands',
    hint: 'Hold your hand up at chest height, about 1 m from the camera.',
    disclaimer: 'A practice aid created with Deaf signers. Learn with Deaf teachers and community too.',
    needs: 'Good light on your hands',
  },
  {
    id: 'stroke_rehab',
    label: 'Stroke Hand Rehab',
    view: 'hands',
    hint: 'Rest your forearm on a table and show your hand to the camera.',
    disclaimer: FALL,
    needs: 'A table to rest your arm on',
  },
  {
    id: 'cpr',
    label: 'CPR Practice',
    view: 'side',
    hint: 'Place the camera at your side, about 1.5 m away.',
    disclaimer:
      'Practice aid for rhythm and straight arms only. It does not measure compression depth and is not certification. Take a certified CPR course.',
    needs: 'A firm cushion on the floor',
  },
  {
    id: 'kids',
    label: "Kids' Active Storytime",
    view: 'front',
    hint: 'Put the camera where it can see you from head to toe.',
    disclaimer: '',
    needs: 'Space to move',
  },
] as const;

export default function NewLesson() {
  return (
    <PinGate>
      <Form />
    </PinGate>
  );
}

function Form() {
  const [channel, setChannel] = useState<(typeof CHANNELS)[number]>(CHANNELS[0]);
  const [title, setTitle] = useState('');
  const [creator, setCreator] = useState('');
  const [needs, setNeeds] = useState<string>(CHANNELS[0].needs);
  const [hint, setHint] = useState<string>(CHANNELS[0].hint);
  const [disclaimer, setDisclaimer] = useState<string>(CHANNELS[0].disclaimer);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const requiresDisclaimer = channel.id !== 'kids';
  const valid =
    title.trim() &&
    creator.trim() &&
    (!requiresDisclaimer || disclaimer.trim()) &&
    (channel.id !== 'cpr' || disclaimer.includes('does not measure compression depth'));

  const pick = (id: string) => {
    const c = CHANNELS.find((x) => x.id === id)!;
    setChannel(c);
    setNeeds(c.needs);
    setHint(c.hint);
    setDisclaimer(c.disclaimer);
  };

  return (
    <main className="page">
      <Brand />
      <h1>New lesson</h1>
      <form
        className="stack"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError('');
          try {
            const l = await creatorApi.create({
              title: title.trim(),
              channel: channel.id,
              creator: creator.trim(),
              needs: needs
                .split(',')
                .map((n) => n.trim())
                .filter(Boolean),
              cameraView: channel.view,
              cameraHint: hint.trim() || channel.hint,
              ...(disclaimer.trim() ? { disclaimer: disclaimer.trim() } : {}),
            });
            navigate(`/c/creator/${l.id}`);
          } catch (err) {
            setError((err as Error).message);
            setBusy(false);
          }
        }}
      >
        <label htmlFor="channel">Channel</label>
        <select id="channel" className="text-input" value={channel.id} onChange={(e) => pick(e.target.value)}>
          {CHANNELS.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
        <label htmlFor="title">Lesson title</label>
        <input
          id="title"
          className="text-input"
          maxLength={80}
          placeholder="e.g. Sit to stand"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <label htmlFor="creator">Your name and role (shown as the lesson credit)</label>
        <input
          id="creator"
          className="text-input"
          maxLength={80}
          placeholder="e.g. Dr. A. Chen, PT"
          value={creator}
          onChange={(e) => setCreator(e.target.value)}
        />
        <label htmlFor="needs">What learners need (comma separated)</label>
        <input id="needs" className="text-input" value={needs} onChange={(e) => setNeeds(e.target.value)} />
        <label htmlFor="hint">Camera placement</label>
        <input id="hint" className="text-input" value={hint} onChange={(e) => setHint(e.target.value)} />
        <label htmlFor="disclaimer">
          Safety note shown to learners{requiresDisclaimer ? ' (required)' : ''}
        </label>
        <textarea
          id="disclaimer"
          className="text-input"
          value={disclaimer}
          onChange={(e) => setDisclaimer(e.target.value)}
        />
        {requiresDisclaimer && !disclaimer.trim() && (
          <p className="small field-warn">This channel always needs a safety note.</p>
        )}
        {error && (
          <div className="banner bad" role="alert">
            <AlertTriangle size={20} /> {error}
          </div>
        )}
        <button className="btn primary block" disabled={!valid || busy}>
          {busy ? <Loader2 className="spin" size={20} /> : <ArrowRight size={20} />} Next: record the
          demonstration
        </button>
      </form>
    </main>
  );
}
