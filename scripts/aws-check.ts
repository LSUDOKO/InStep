/**
 * Checks what InStep's AWS integration can use with the credentials on this machine.
 *
 *   pnpm aws:check                 # free calls only: identity, Bedrock model list, Polly voice list
 *   pnpm aws:check --probe         # + one 5-token Bedrock Converse call to BEDROCK_MODEL_ID (costs ~$0.0001)
 *   pnpm aws:check --probe --tts   # + one short Polly synthesis (~$0.0003)
 *
 * Reads BEDROCK_MODEL_ID / AWS_REGION from the environment or ../.env. Never prints secrets.
 */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';

const envFile = resolve(process.cwd(), '.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);
const { values } = parseArgs({
  options: { probe: { type: 'boolean', default: false }, tts: { type: 'boolean', default: false } },
});
const region = process.env.AWS_REGION ?? 'us-east-1';
const modelId = process.env.BEDROCK_MODEL_ID ?? '';
const ok = (s: string) => console.log(`  ✓ ${s}`);
const bad = (s: string) => console.log(`  ✗ ${s}`);

console.log(
  `InStep AWS check — region ${region}${modelId ? `, model ${modelId}` : ', BEDROCK_MODEL_ID not set'}\n`,
);

const { STSClient, GetCallerIdentityCommand } = await import('@aws-sdk/client-sts');
try {
  const id = await new STSClient({ region }).send(new GetCallerIdentityCommand({}));
  ok(`credentials: account ${id.Account?.replace(/^\d{8}/, '********')} (${id.Arn?.split('/').pop()})`);
} catch (e) {
  bad(`credentials: ${(e as Error).message}`);
  process.exit(1);
}

const { BedrockClient, ListFoundationModelsCommand } = await import('@aws-sdk/client-bedrock');
try {
  const r = await new BedrockClient({ region }).send(
    new ListFoundationModelsCommand({ byOutputModality: 'TEXT', byInferenceType: 'ON_DEMAND' }),
  );
  const ids = (r.modelSummaries ?? []).map((m) => m.modelId!);
  ok(`Bedrock: ${ids.length} on-demand text models listed in ${region}`);
  if (modelId)
    (ids.includes(modelId) ? ok : bad)(
      `BEDROCK_MODEL_ID ${modelId} ${ids.includes(modelId) ? 'is listed' : 'is NOT listed in this region'}`,
    );
  else
    console.log(
      `    e.g. ${ids
        .filter((i) => /nova-micro|nova-lite|haiku/.test(i))
        .slice(0, 3)
        .join(', ')}`,
    );
} catch (e) {
  bad(`Bedrock list: ${(e as Error).message}`);
}

const { PollyClient, DescribeVoicesCommand, SynthesizeSpeechCommand } = await import('@aws-sdk/client-polly');
const { VOICES } = await import('../apps/server/src/ai/voice');
try {
  const polly = new PollyClient({ region });
  const r = await polly.send(new DescribeVoicesCommand({ Engine: 'neural' }));
  const have = new Set((r.Voices ?? []).map((v) => v.Id));
  for (const [lang, voice] of Object.entries(VOICES))
    (have.has(voice as never) ? ok : bad)(`Polly neural voice ${voice} (${lang})`);
  if (values.tts) {
    const out = await polly.send(
      new SynthesizeSpeechCommand({
        Engine: 'neural',
        OutputFormat: 'mp3',
        Text: 'Nice. Hold it. Done.',
        VoiceId: 'Joanna',
        LanguageCode: 'en-US',
      }),
    );
    ok(`Polly synthesis: ${(await out.AudioStream!.transformToByteArray()).length} bytes of MP3`);
  }
} catch (e) {
  bad(`Polly: ${(e as Error).message}`);
}

if (values.probe) {
  if (!modelId) bad('--probe needs BEDROCK_MODEL_ID');
  else {
    const { createBedrockText } = await import('../apps/server/src/ai/bedrock');
    try {
      const model = await createBedrockText(modelId, region);
      const t0 = Date.now();
      const text = await model({
        system: 'Reply with the single word OK.',
        user: 'ping',
        maxTokens: 5,
        temperature: 0,
        timeoutMs: 8000,
      });
      ok(`Bedrock Converse: "${text}" in ${Date.now() - t0} ms`);
    } catch (e) {
      bad(`Bedrock Converse: ${(e as Error).message}`);
    }
  }
} else console.log('\n  (add --probe to make one 5-token Bedrock call; --tts for one Polly synthesis)');
