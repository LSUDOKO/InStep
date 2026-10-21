export type Settings = {
  serverUrl: string;
  language: 'en-US' | 'es-ES' | 'hi-IN' | 'fr-FR';
  captionScale: 1 | 1.25 | 1.5;
  voice: boolean;
  overlayMode: 'side_by_side' | 'overlay';
  highContrast: boolean;
  reduceMotion: boolean;
};

/**
 * Default server: the hosted instance. Vega's media player refuses plain-http video sources (verified on the
 * Virtual Device, see docs/FRICTION_LOG.md F-06), so the default must be HTTPS with a public certificate.
 * For a local server, enter http://10.0.2.2:8788 (the host as seen from the Virtual Device) in Settings —
 * REST and the relay work over http; only video playback needs HTTPS.
 */
export const DEFAULT_SERVER_URL = 'https://instep-wfcr.onrender.com';
export const LOCAL_SERVER_URL = 'http://10.0.2.2:8788';
export const DEFAULT_SETTINGS: Settings = {
  serverUrl: DEFAULT_SERVER_URL,
  language: 'en-US',
  captionScale: 1,
  voice: true,
  overlayMode: 'side_by_side',
  highContrast: false,
  reduceMotion: false,
};

export function parseSettings(raw: string | null): Settings {
  if (!raw) return DEFAULT_SETTINGS;
  try {
    const v = JSON.parse(raw) as Partial<Settings>;
    return { ...DEFAULT_SETTINGS, ...v };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export const LANGUAGES: { id: Settings['language']; label: string }[] = [
  { id: 'en-US', label: 'English' },
  { id: 'es-ES', label: 'Español' },
  { id: 'hi-IN', label: 'हिन्दी' },
  { id: 'fr-FR', label: 'Français' },
];
