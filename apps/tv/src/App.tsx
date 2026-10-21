import './remote/configureSpatialNavigation';
import React, { useEffect } from 'react';
import { ThemeProvider } from './components/ui';
import { nav, type Route } from './lib/app';
import { remote } from './remote/remote';
import { AddProfile } from './screens/AddProfile';
import { CameraCheck } from './screens/CameraCheck';
import { Home } from './screens/Home';
import { LessonDetail } from './screens/LessonDetail';
import { Pair } from './screens/Pair';
import { Player } from './screens/Player';
import { Profiles } from './screens/Profiles';
import { Progress } from './screens/Progress';
import { ServerError } from './screens/ServerError';
import { Settings } from './screens/Settings';
import { Splash } from './screens/Splash';
import { Summary } from './screens/Summary';
import { useApp } from './useStore';

function render(r: Route) {
  switch (r.name) {
    case 'splash':
      return <Splash />;
    case 'serverError':
      return <ServerError message={r.message} />;
    case 'profiles':
      return <Profiles />;
    case 'addProfile':
      return <AddProfile />;
    case 'home':
      return <Home />;
    case 'detail':
      return <LessonDetail lessonId={r.lessonId} />;
    case 'pair':
      return <Pair lessonId={r.lessonId} together={r.together} />;
    case 'cameraCheck':
      return <CameraCheck lessonId={r.lessonId} />;
    case 'player':
      return <Player lessonId={r.lessonId} />;
    case 'summary':
      return <Summary lessonId={r.lessonId} summary={r.summary} />;
    case 'progress':
      return <Progress />;
    case 'settings':
      return <Settings />;
  }
}

export function App() {
  const stack = useApp((s) => s.stack);
  const route = stack[stack.length - 1]!;
  // Back pops the screen stack (the Player handles Back itself with a confirm dialog).
  useEffect(
    () => remote.on((k) => (k === 'back' && stack.length > 1 ? (nav.back(), true) : false)),
    [stack.length],
  );
  return <ThemeProvider key={stack.length + route.name}>{render(route)}</ThemeProvider>;
}
