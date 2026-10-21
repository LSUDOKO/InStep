import type { Vision } from './vision';

let vision: Vision | null = null;

/** MediaPipe is ~400 KB of JS: load it only when a camera page needs it. */
export async function getVision(): Promise<Vision> {
  if (!vision) vision = new (await import('./vision')).Vision();
  return vision;
}

/** The loaded instance (null until getVision() resolved once). */
export const loadedVision = () => vision;
