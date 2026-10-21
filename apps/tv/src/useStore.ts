import { useSyncExternalStore } from 'react';
import { store, type AppState } from './lib/app';

export function useApp<T>(select: (s: AppState) => T): T {
  return useSyncExternalStore(store.subscribe, () => select(store.get()));
}
