/**
 * Amazon Bedrock Converse API (text in, text out). Imported dynamically, so nothing AWS loads in mock mode.
 * The model comes from BEDROCK_MODEL_ID — never hard-coded.
 */
export type TextModel = (o: {
  system: string;
  user: string;
  maxTokens: number;
  temperature: number;
  timeoutMs: number;
}) => Promise<string>;

export async function createBedrockText(modelId: string, region: string): Promise<TextModel> {
  if (!modelId) throw new Error('BEDROCK_MODEL_ID is not set (required when MOCK_AI=false)');
  const { BedrockRuntimeClient, ConverseCommand } = await import('@aws-sdk/client-bedrock-runtime');
  const client = new BedrockRuntimeClient({ region });
  return async ({ system, user, maxTokens, temperature, timeoutMs }) => {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const out = await client.send(
        new ConverseCommand({
          modelId,
          system: [{ text: system }],
          messages: [{ role: 'user', content: [{ text: user }] }],
          inferenceConfig: { maxTokens, temperature },
        }),
        { abortSignal: ctl.signal },
      );
      const text = out.output?.message?.content?.map((c) => ('text' in c ? c.text : '')).join('') ?? '';
      if (!text.trim()) throw new Error('empty model response');
      return text.trim();
    } finally {
      clearTimeout(timer);
    }
  };
}
