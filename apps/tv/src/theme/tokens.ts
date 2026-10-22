import { Dimensions } from 'react-native';

/** Design at 1920×1080 (docs/09); scale to the actual screen. */
const scale = Dimensions.get('window').width / 1920;
export const px = (n: number) => Math.round(n * scale);

export type Palette = typeof dark;
/**
 * tvOS-grade dark theme. A true-black canvas (TV panels) with "glass" surfaces as white at low opacity,
 * a near-white focus platter with a near-black label (tvOS button focus), and teal reserved for progress
 * and success. Metrics come from Apple's tvOS 18 design templates; fonts are Amazon Ember (Vega's system face).
 */
const dark = {
  bg: '#000000',
  /** glass surfaces over black or over artwork */
  surface: 'rgba(255,255,255,0.08)',
  surface2: 'rgba(255,255,255,0.14)',
  surface3: 'rgba(255,255,255,0.22)',
  /** opaque fallbacks where translucency would stack */
  solid: '#141414',
  text: '#FFFFFF',
  muted: 'rgba(255,255,255,0.62)',
  faint: 'rgba(255,255,255,0.38)',
  brand: '#4FD1C5',
  /** focus platter (tvOS: white @ 90–95 %) and the label on it */
  focus: '#F5F5F7',
  onFocus: '#0B0B0C',
  ok: '#34D399',
  near: '#FBBF24',
  far: '#F87171',
  info: '#93C5FD',
  neutral: '#6B7280',
  scrim: 'rgba(0,0,0,0.62)',
  hairline: 'rgba(255,255,255,0.12)',
  shadow: '#000000',
  stroke: 1,
};
const highContrast: Palette = {
  ...dark,
  surface: '#1A1A1A',
  surface2: '#2A2A2A',
  surface3: '#3A3A3A',
  solid: '#0A0A0A',
  muted: '#E5E5E5',
  faint: '#BDBDBD',
  ok: '#00FF7F',
  near: '#FFD400',
  far: '#FF3B30',
  hairline: '#FFFFFF',
  stroke: 1.5,
};
export const palettes = { dark, highContrast };

export const channelColor: Record<string, string> = {
  fall_prevention: '#4FD1C5',
  stroke_rehab: '#7AA7FF',
  sign_language: '#C08BFF',
  cpr: '#FF6B6B',
  kids: '#FFB547',
};

/**
 * TV type scale (px at 1080p), tvOS 18 styles lifted to a 28 px floor for older viewers at 2–3 m:
 * display = Title1 (76), h1 = Title2 (57), h2 = Title3 (48), headline = Headline (38), body = Callout (31),
 * caption = 28 (tvOS Caption1 is 25; never below 28 here).
 */
export const type = { display: 76, h1: 57, h2: 48, headline: 38, body: 31, caption: 28 };
export const lineHeight = { display: 92, h1: 66, h2: 56, headline: 46, body: 40, caption: 36 };
/** Amazon Ember ships on Vega; undefined falls back to the system face. */
export const FONT = 'Amazon Ember';
/** tvOS standard safe area: 80 px left/right, 60 px top/bottom. */
export const SAFE = { h: 80, v: 60 };
/** Lockup (card) sizes from the tvOS 4-up grid: 410 × 231 with 40 px gutters inside the safe area. */
export const LOCKUP = { w: 410, h: 231, gap: 40, radius: 14 };
export const RADIUS = { button: 14, card: 14, panel: 28, pill: 999 };
export const FOCUS = { button: 1.06, card: 1.1, ms: 140 };
