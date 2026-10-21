import type { Gate, IstepTrack, ReferenceTimeline } from '@instep/istep-format';
import type { Catalog, LessonDetail } from '@instep/protocol';
import { meters } from './meter';

const PIN_KEY = 'instep.creatorPin';
export const creatorPin = {
  get: () => sessionStorage.getItem(PIN_KEY) ?? '',
  set: (p: string) => sessionStorage.setItem(PIN_KEY, p),
  clear: () => sessionStorage.removeItem(PIN_KEY),
};

export class CreatorError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details?: { path: string; message: string }[],
  ) {
    super(message);
  }
}

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      headers: {
        'x-creator-pin': creatorPin.get(),
        ...(init.body && typeof init.body === 'string' ? { 'content-type': 'application/json' } : {}),
      },
    });
  } catch {
    throw new CreatorError("Can't reach the InStep server.", 0);
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok)
    throw new CreatorError(
      body.message ?? body.errors?.[0]?.message ?? `HTTP ${res.status}`,
      res.status,
      body.errors,
    );
  return body as T;
}

export const creatorApi = {
  list: () => req<Catalog>('/api/lessons?all=1'),
  lesson: (id: string) => req<LessonDetail>(`/api/lessons/${id}`),
  track: (id: string) => req<IstepTrack>(`/api/lessons/${id}/track`),
  reference: (url: string) => req<ReferenceTimeline>(url),
  create: (b: {
    title: string;
    channel: string;
    creator: string;
    needs: string[];
    cameraView: string;
    cameraHint: string;
    disclaimer?: string;
  }) => req<LessonDetail>('/api/lessons', { method: 'POST', body: JSON.stringify(b) }),
  autogates: (id: string) =>
    req<{ gates: Gate[]; labels: 'ai' | 'template' }>(`/api/lessons/${id}/autogates`, { method: 'POST' }),
  saveTrack: (id: string, t: IstepTrack) =>
    req<{ ok: true }>(`/api/lessons/${id}/track`, { method: 'PUT', body: JSON.stringify(t) }),
  publish: (id: string) => req<LessonDetail>(`/api/lessons/${id}/publish`, { method: 'POST' }),
  async checkPin(): Promise<boolean> {
    const r = await fetch('/api/creator/check', { headers: { 'x-creator-pin': creatorPin.get() } });
    return r.status === 204;
  },

  /**
   * Uploads the instructor's demonstration (the ONLY video InStep ever uploads) with progress.
   * Bytes are counted by the video meter, so the privacy numbers stay honest everywhere.
   */
  upload(
    id: string,
    video: Blob | null,
    reference: ReferenceTimeline,
    onProgress: (p: number) => void,
  ): Promise<LessonDetail> {
    const form = new FormData();
    if (video) form.append('video', video, video.type.includes('mp4') ? 'demo.mp4' : 'demo.webm');
    form.append(
      'reference',
      new Blob([JSON.stringify(reference)], { type: 'application/json' }),
      'reference.json',
    );
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `/api/lessons/${id}/assets`);
      xhr.setRequestHeader('x-creator-pin', creatorPin.get());
      let sent = 0;
      xhr.upload.onprogress = (e) => {
        meters.video.add(e.loaded - sent);
        sent = e.loaded;
        if (e.lengthComputable) onProgress(e.loaded / e.total);
      };
      xhr.onload = () => {
        const body = JSON.parse(xhr.responseText || '{}');
        if (xhr.status >= 200 && xhr.status < 300) resolve(body);
        else reject(new CreatorError(body.message ?? `Upload failed (${xhr.status})`, xhr.status));
      };
      xhr.onerror = () => reject(new CreatorError('Upload failed — check your connection.', 0));
      xhr.send(form);
    });
  },
};
