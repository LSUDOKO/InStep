import { Dimensions } from 'react-native';

/** Design at 1920×1080 (docs/09); scale to the actual screen. */
const scale = Dimensions.get('window').width / 1920;
export const px = (n: number) => Math.round(n * scale);

export type Palette = typeof dark;
/**
 * "Blue Hour" brand (docs/brand/palette.json, docs/09): a deep night-indigo canvas for living rooms, glass
 * surfaces as indigo-tinted white at low opacity, a near-white focus platter with an indigo label (tvOS button
 * focus), and sky blue as the brand (ghost skeleton, progress). ok / near / far are reserved for feedback.
 * Metrics come from Apple's tvOS 18 design templates; fonts are Amazon Ember (Vega's system face).
 */
const dark = {
  bg: '#0D0E2C',
  /** glass surfaces over the canvas or over artwork */
  surface: 'rgba(170,176,255,0.10)',
  surface2: 'rgba(170,176,255,0.16)',
  surface3: 'rgba(170,176,255,0.24)',
  /** opaque fallbacks where translucency would stack */
  solid: '#1A1C3F',
  text: '#F5F6FE',
  muted: '#B8BCD5',
  faint: '#A1A6C1',
  brand: '#5FC6FF',
  /** focus platter (tvOS: white @ 90–95 %) and the label on it */
  focus: '#F5F6FE',
  onFocus: '#0D0E2C',
  ok: '#49DE78',
  near: '#FFB439',
  far: '#FF6762',
  info: '#B5B8F1',
  neutral: '#6F7389',
  scrim: 'rgba(5,6,26,0.62)',
  hairline: 'rgba(184,188,213,0.16)',
  shadow: '#05041B',
  stroke: 1,
};
const highContrast: Palette = {
  ...dark,
  bg: '#000000',
  surface: '#1A1A1A',
  surface2: '#2A2A2A',
  surface3: '#3A3A3A',
  solid: '#0A0A0A',
  text: '#FFFFFF',
  muted: '#E5E5E5',
  faint: '#BDBDBD',
  focus: '#FFFFFF',
  onFocus: '#000000',
  ok: '#00FF7F',
  near: '#FFD400',
  far: '#FF3B30',
  scrim: 'rgba(0,0,0,0.62)',
  hairline: '#FFFFFF',
  shadow: '#000000',
  stroke: 1.5,
};
export const palettes = { dark, highContrast };

export const channelColor: Record<string, string> = {
  fall_prevention: '#5FC6FF',
  stroke_rehab: '#5BD7D3',
  sign_language: '#AE97FF',
  cpr: '#F87BAA',
  kids: '#F6D653',
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
