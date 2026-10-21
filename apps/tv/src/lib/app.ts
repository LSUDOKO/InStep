import type { SessionSummary } from '@instep/gated-player';
import type { Catalog, Profile } from '@instep/protocol';
import { Api } from './api';
import { DEFAULT_SETTINGS, type Settings } from './settings';
import { createStore } from './store';
import { TvRelay, type Peer, type RelayStatus } from './tvRelay';

export type Route =
  | { name: 'splash' }
  | { name: 'serverError'; message: string }
  | { name: 'profiles' }
  | { name: 'addProfile' }
  | { name: 'home' }
  | { name: 'detail'; lessonId: string }
  | { name: 'pair'; lessonId: string; together: boolean }
  | { name: 'cameraCheck'; lessonId: string }
  | { name: 'player'; lessonId: string }
  | { name: 'summary'; lessonId: string; summary: SessionSummary }
  | { name: 'progress' }
  | { name: 'settings' };

export type AppState = {
  stack: Route[];
  settings: Settings;
  profile: Profile | null;
  catalog: Catalog | null;
  catalogError: string | null;
  relayStatus: RelayStatus;
  room: string;
  joinUrl: string;
  peers: Peer[];
  mockAi: boolean;
};

export const store = createStore<AppState>({
  stack: [{ name: 'splash' }],
  settings: DEFAULT_SETTINGS,
  profile: null,
  catalog: null,
  catalogError: null,
  relayStatus: 'connecting',
  room: '',
  joinUrl: '',
  peers: [],
  mockAi: true,
});

export const nav = {
  current: (): Route => store.get().stack.at(-1)!,
  push: (r: Route) => store.set((s) => ({ stack: [...s.stack, r] })),
  replace: (r: Route) => store.set((s) => ({ stack: [...s.stack.slice(0, -1), r] })),
  reset: (r: Route) => store.set({ stack: [r] }),
  back: () => store.set((s) => (s.stack.length > 1 ? { stack: s.stack.slice(0, -1) } : {})),
};

/** Server-bound services; rebuilt when the server URL changes in Settings. */
export const services = {
  api: new Api(DEFAULT_SETTINGS.serverUrl),
  relay: null as TvRelay | null,
  connect(serverUrl: string) {
    this.api = new Api(serverUrl);
    this.relay?.close();
    const relay = new TvRelay(`${serverUrl.replace(/^http/, 'ws').replace(/\/$/, '')}/ws`);
    relay.listen({
      onStatus: (relayStatus) => store.set({ relayStatus }),
      onRoom: (room, joinUrl) => store.set({ room, joinUrl }),
      onPeers: (peers) => store.set({ peers }),
      onCatalogUpdated: () => void refreshCatalog(),
    });
    relay.connect();
    this.relay = relay;
  },
};

export async function refreshCatalog() {
  try {
    store.set({ catalog: await services.api.catalog(), catalogError: null });
  } catch (e) {
    store.set({ catalogError: (e as Error).message });
  }
}
