import { Compass } from 'lucide-react';
import { lazy, Suspense } from 'react';
import { FullMessage } from './components/FullMessage';
import { useRoute } from './lib/router';
import { CameraNode } from './screens/CameraNode';

export { route } from './lib/router';

// Creator Studio and reports are separate chunks: the camera page stays small on phones.
const CreatorHome = lazy(() => import('./screens/creator/CreatorHome'));
const NewLesson = lazy(() => import('./screens/creator/NewLesson'));
const LessonEditor = lazy(() => import('./screens/creator/LessonEditor'));
const Report = lazy(() => import('./screens/Report'));

export function App() {
  const r = useRoute();
  const page = (() => {
    switch (r.name) {
      case 'camera':
        return <CameraNode />;
      case 'creator':
        return <CreatorHome />;
      case 'creator-new':
        return <NewLesson />;
      case 'creator-edit':
        return <LessonEditor id={r.id} />;
      case 'report':
        return <Report token={r.token} />;
      default:
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
  })();
  return <Suspense fallback={<main className="page" aria-busy="true" />}>{page}</Suspense>;
}
