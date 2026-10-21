import { z } from 'zod';

const bool = z
  .string()
  .optional()
  .transform((v) => v === 'true' || v === '1');
const boolDefaultTrue = z
  .string()
  .optional()
  .transform((v) => v === undefined || v === '' || v === 'true' || v === '1');

export const Config = z.object({
  PORT: z.coerce.number().int().default(8787),
  TV_HTTP_PORT: z.coerce.number().int().default(8788),
  HOST: z.string().default('0.0.0.0'),
  PUBLIC_URL: z.string().default('http://localhost:8787'),
  HTTPS_CERT: z.string().optional(),
  HTTPS_KEY: z.string().optional(),
  DATA_DIR: z.string().default('./data'),
  CONTENT_DIR: z.string().default('../../content/lessons'),
  COMPANION_DIST: z.string().default('../companion/dist'),
  MOCK_AI: boolDefaultTrue,
  AWS_REGION: z.string().default('us-east-1'),
  BEDROCK_MODEL_ID: z.string().default(''),
  POLLY_ENABLED: bool,
  COACH_MAX_CALLS_PER_DAY: z.coerce.number().int().default(300),
  COACH_MIN_INTERVAL_SEC: z.coerce.number().default(8),
  MCP_ENABLED: bool,
  /** When set, the hosted /mcp endpoint requires `Authorization: Bearer <token>` */
  MCP_TOKEN: z.string().default(''),
  CREATOR_PIN: z.string().default('2468'),
});
export type Config = z.infer<typeof Config>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const clean = Object.fromEntries(Object.entries(env).filter(([, v]) => v !== ''));
  // Render sets RENDER_EXTERNAL_URL; use it for QR codes unless PUBLIC_URL is explicit.
  if (!clean.PUBLIC_URL && clean.RENDER_EXTERNAL_URL) clean.PUBLIC_URL = clean.RENDER_EXTERNAL_URL;
  return Config.parse(clean);
}
