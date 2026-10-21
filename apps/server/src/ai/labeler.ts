import type { Channel, Gate } from '@instep/istep-format';
import { z } from 'zod';
import { filterTip } from '../coach/filter';
import { logger } from '../log';
import type { AiBudget } from './budget';
import type { TextModel } from './bedrock';

const log = logger('labels');

export const LABEL_SYSTEM = `You write labels for steps in a physical practice video. For each gate you get its index,
type and a short numeric summary. Reply with STRICT JSON only: an array of
{"gateIndex": number, "label": string, "fallbackTip": string}.
label: imperative, at most 6 words. fallbackTip: one kind, specific instruction, at most 20 words.
Never diagnose or mention injury, disease, medication or numbers/degrees. For sign language describe the hand
shape only. For CPR only rhythm and straight arms. Language: {language}.`;

const Reply = z.array(
  z.object({
    gateIndex: z.number().int(),
    label: z.string().min(1).max(60),
    fallbackTip: z.string().min(1).max(200),
  }),
);

/** Compact, numbers-only description of each gate: no video, no images, no landmark streams. */
function summarise(gates: Gate[]) {
  return gates.map((g, gateIndex) => ({
    gateIndex,
    type: g.type,
    t: g.t,
    ...('joints' in g ? { joints: g.joints } : {}),
    ...(g.type === 'hold_duration' ? { holdSec: g.holdSec } : {}),
    ...(g.type === 'rep_count' ? { metric: g.metric.kind, reps: g.reps } : {}),
  }));
}

export function createLabeler(o: { model?: TextModel; budget: AiBudget }) {
  return {
    /** Rewrites template labels with AI when available; any failure keeps the deterministic templates. */
    async label(
      channel: Channel,
      language: string,
      gates: Gate[],
    ): Promise<{ gates: Gate[]; source: 'ai' | 'template' }> {
      if (!o.model || gates.length === 0 || !o.budget.take('labels')) return { gates, source: 'template' };
      try {
        const raw = await o.model({
          system: LABEL_SYSTEM.replace('{language}', language),
          user: JSON.stringify({ channel, gates: summarise(gates) }),
          maxTokens: 600,
          temperature: 0.4,
          timeoutMs: 8000,
        });
        const json = raw.slice(raw.indexOf('['), raw.lastIndexOf(']') + 1);
        const r = Reply.safeParse(JSON.parse(json));
        if (!r.success) throw new Error('reply did not match the schema');
        const out = gates.map((g, i) => {
          const hit = r.data.find((x) => x.gateIndex === i);
          const label = hit && hit.label.split(/\s+/).length <= 6 ? filterTip(hit.label) : null;
          const tip = hit ? filterTip(hit.fallbackTip) : null;
          return { ...g, ...(label ? { label } : {}), ...(tip ? { fallbackTip: tip } : {}) };
        });
        return { gates: out, source: 'ai' };
      } catch (e) {
        log.warn('labeling failed, keeping templates', { error: (e as Error).message });
        return { gates, source: 'template' };
      }
    },
  };
}
export type Labeler = ReturnType<typeof createLabeler>;
