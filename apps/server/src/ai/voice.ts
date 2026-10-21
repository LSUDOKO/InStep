import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { logger } from '../log';
import type { AiBudget } from './budget';

const log = logger('voice');

/** Neural voices per language (verify availability in your region). */
export const VOICES: Record<string, string> = {
  'en-US': 'Joanna',
  'es-ES': 'Lucia',
  'hi-IN': 'Kajal',
  'fr-FR': 'Lea',
};

/** Amazon Polly text → MP3, cached on disk by text hash. Returns a URL path, or null to fall back to browser speech. */
export async function createVoice(o: { dir: string; region: string; budget: AiBudget }) {
  const { PollyClient, SynthesizeSpeechCommand } = await import('@aws-sdk/client-polly');
  type VoiceId = import('@aws-sdk/client-polly').VoiceId;
  type LanguageCode = import('@aws-sdk/client-polly').LanguageCode;
  const client = new PollyClient({ region: o.region });
  mkdirSync(o.dir, { recursive: true });
  return async (text: string, language: string): Promise<string | null> => {
    const voice = VOICES[language];
    if (!voice) return null;
    const file = `${createHash('sha256').update(`${language}|${text}`).digest('hex').slice(0, 32)}.mp3`;
    if (existsSync(join(o.dir, file))) return `/voice/${file}`;
    if (!o.budget.take('voice')) return null;
    try {
      const out = await client.send(
        new SynthesizeSpeechCommand({
          Engine: 'neural',
          OutputFormat: 'mp3',
          Text: text,
          VoiceId: voice as VoiceId,
          LanguageCode: language as LanguageCode,
        }),
      );
      const bytes = await out.AudioStream?.transformToByteArray();
      if (!bytes) return null;
      writeFileSync(join(o.dir, file), bytes);
      return `/voice/${file}`;
    } catch (e) {
      log.warn('polly failed, using browser speech', { error: (e as Error).message });
      return null;
    }
  };
}
export type Voice = Awaited<ReturnType<typeof createVoice>>;
