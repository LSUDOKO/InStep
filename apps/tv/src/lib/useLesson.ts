import { useEffect, useState } from 'react';
import { loadLesson, type LoadedLesson } from './lessonCache';

export function useLesson(id: string) {
  const [state, setState] = useState<{ lesson?: LoadedLesson; error?: string }>({});
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    setState({});
    loadLesson(id).then(
      (lesson) => live && setState({ lesson }),
      (e: Error) => live && setState({ error: e.message }),
    );
    return () => {
      live = false;
    };
  }, [id, attempt]);
  return { ...state, retry: () => setAttempt((a) => a + 1) };
}
