import type {
  HWEvent,
  TVEventHandler as TVEventHandlerType,
} from '@amazon-devices/react-native-kepler/Libraries/TV/TVTypes';

// On Vega, 'react-native' resolves to the Kepler build, which provides TVEventHandler (as in the official sample).
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { TVEventHandler } = require('react-native') as { TVEventHandler: typeof TVEventHandlerType };

export type Key =
  'left' | 'right' | 'up' | 'down' | 'select' | 'back' | 'playpause' | 'rewind' | 'fastforward' | 'menu';

const MAP: Record<string, Key> = {
  left: 'left',
  right: 'right',
  up: 'up',
  down: 'down',
  select: 'select',
  back: 'back',
  playpause: 'playpause',
  skip_backward: 'rewind',
  skip_forward: 'fastforward',
  menu: 'menu',
};

type Listener = (k: Key) => boolean | void;

/**
 * Remote keys via TVEventHandler (same approach as the official Vega sample). Listeners are called
 * newest-first; a listener returning true consumes the key.
 */
class Remote {
  private listeners: Listener[] = [];
  private handler: TVEventHandlerType | null = null;

  private ensure() {
    if (this.handler) return;
    this.handler = new TVEventHandler();
    this.handler.enable(undefined, (_c: unknown, e: HWEvent) => {
      if (e.eventKeyAction !== 0 && e.eventKeyAction !== undefined) return; // key down only
      const k = MAP[e.eventType];
      if (!k) return;
      for (const l of [...this.listeners].reverse()) if (l(k) === true) return;
    });
  }

  on(l: Listener): () => void {
    this.ensure();
    this.listeners.push(l);
    return () => {
      this.listeners = this.listeners.filter((x) => x !== l);
    };
  }

  /** Arrow/OK keys for react-tv-space-navigation. */
  subscribeDirections(cb: (d: Key) => void) {
    return this.on((k) => {
      if (k === 'left' || k === 'right' || k === 'up' || k === 'down' || k === 'select') cb(k);
    });
  }
}

export const remote = new Remote();
