import { useEffect, useState } from 'react';

export type Route =
  | { name: 'camera' }
  | { name: 'creator' }
  | { name: 'creator-new' }
  | { name: 'creator-edit'; id: string }
  | { name: 'report'; token: string }
  | { name: 'not-found' };

/** Tiny path router for /c/… (no dependency needed for a handful of routes). */
export function route(pathname: string): Route {
  const p = pathname.replace(/^\/c/, '').replace(/\/+$/, '') || '/';
  if (p === '/') return { name: 'camera' };
  if (p === '/creator') return { name: 'creator' };
  if (p === '/creator/new') return { name: 'creator-new' };
  let m = p.match(/^\/creator\/([a-z0-9-]+)$/);
  if (m) return { name: 'creator-edit', id: m[1]! };
  m = p.match(/^\/report\/([0-9a-f]{32})$/);
  if (m) return { name: 'report', token: m[1]! };
  return { name: 'not-found' };
}

export function navigate(path: string) {
  history.pushState(null, '', path);
  dispatchEvent(new PopStateEvent('popstate'));
}

export function useRoute(): Route {
  const [r, setR] = useState(() => route(location.pathname));
  useEffect(() => {
    const on = () => setR(route(location.pathname));
    addEventListener('popstate', on);
    return () => removeEventListener('popstate', on);
  }, []);
  return r;
}
