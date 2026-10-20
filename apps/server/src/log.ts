/** Tiny structured logger: `[module] message {json}`. Never pass landmark payloads here. */
export function logger(module: string) {
  const line = (level: 'log' | 'warn' | 'error') => (msg: string, data?: Record<string, unknown>) => {
    if (process.env.NODE_ENV === 'test' && level === 'log') return;
    console[level](`[${module}] ${msg}${data ? ' ' + JSON.stringify(data) : ''}`);
  };
  return { info: line('log'), warn: line('warn'), error: line('error') };
}
export type Logger = ReturnType<typeof logger>;
