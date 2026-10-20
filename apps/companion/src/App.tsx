import { Compass } from 'lucide-react';
import { FullMessage } from './components/FullMessage';
import { CameraNode } from './screens/CameraNode';

/** Tiny path router for /c/… (no dependency needed for a handful of routes). */
export function route(pathname: string): { name: 'camera' } | { name: 'not-found' } {
  const p = pathname.replace(/^\/c/, '').replace(/\/+$/, '') || '/';
  if (p === '/') return { name: 'camera' };
  return { name: 'not-found' };
}

export function App() {
  const r = route(location.pathname);
  if (r.name === 'camera') return <CameraNode />;
  return (
    <FullMessage
      icon={<Compass size={30} />}
      title="Page not found"
      actions={
        <a className="btn primary block" href="/c/">
          Use this phone as a camera
        </a>
      }
    >
      <p>Check the address on your TV, or start again.</p>
    </FullMessage>
  );
}
