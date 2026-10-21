export type Settings = {
  serverUrl: string;
  language: 'en-US' | 'es-ES' | 'hi-IN' | 'fr-FR';
  captionScale: 1 | 1.25 | 1.5;
  voice: boolean;
  overlayMode: 'side_by_side' | 'overlay';
  highContrast: boolean;
  reduceMotion: boolean;
};

/** Default server for the Vega Virtual Device: 10.0.2.2 is the host as seen from the VVD's NAT (verify in M0). */
export const DEFAULT_SETTINGS: Settings = {
  serverUrl: 'http://10.0.2.2:8788',
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
