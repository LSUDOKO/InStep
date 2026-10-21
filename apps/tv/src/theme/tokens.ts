import { Dimensions } from 'react-native';

/** Design at 1920×1080 (docs/09); scale to the actual screen. */
const scale = Dimensions.get('window').width / 1920;
export const px = (n: number) => Math.round(n * scale);

export type Palette = typeof dark;
const dark = {
  bg: '#0E1116',
  surface: '#171B22',
  surface2: '#212733',
  text: '#F2F4F7',
  muted: '#A7B0BE',
  brand: '#4FD1C5',
  focus: '#FFFFFF',
  ok: '#3DDC97',
  near: '#FFB547',
  far: '#FF6B6B',
  info: '#7AA7FF',
  neutral: '#5B6575',
  scrim: 'rgba(0,0,0,0.55)',
  stroke: 1,
};
const highContrast: Palette = {
  ...dark,
  bg: '#000000',
  surface: '#0A0A0A',
  surface2: '#1A1A1A',
  text: '#FFFFFF',
  muted: '#E0E0E0',
  ok: '#00FF7F',
  near: '#FFD400',
  far: '#FF3B30',
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

/** TV type scale (px at 1080p); captions are never below 28. */
export const type = { display: 72, h1: 56, h2: 40, body: 32, caption: 28 };
export const SAFE = { h: 96, v: 54 };
