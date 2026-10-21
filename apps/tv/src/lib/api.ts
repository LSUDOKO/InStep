import type { IstepTrack, ReferenceTimeline } from '@instep/istep-format';
import { validateReference, validateTrack } from '@instep/istep-format';
import type {
  Catalog,
  CoachRequest,
  CoachResponse,
  LessonDetail,
  Profile,
  Progress,
  SessionSummary,
} from '@instep/protocol';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/** REST client for the InStep server (plain HTTP port for the TV). */
export class Api {
  constructor(
    public baseUrl: string,
    private fetchImpl: typeof fetch = (...a) => fetch(...a),
    private timeoutMs = 6000,
  ) {}

  url(path: string) {
    return path.startsWith('http') ? path : `${this.baseUrl.replace(/\/$/, '')}${path}`;
  }

  private async req<T>(path: string, init: RequestInit = {}): Promise<T> {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), this.timeoutMs);
    try {
      const res = await this.fetchImpl(this.url(path), {
        ...init,
        signal: ctl.signal,
        headers: init.body ? { 'content-type': 'application/json' } : undefined,
      });
      if (res.status === 204) return undefined as T;
      const body = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new ApiError((body as { message?: string }).message ?? `HTTP ${res.status}`, res.status);
      return body as T;
    } catch (e) {
      if (e instanceof ApiError) throw e;
      throw new ApiError(`Can't reach the InStep server at ${this.baseUrl}`, 0);
    } finally {
      clearTimeout(timer);
    }
  }

  health = () => this.req<{ ok: boolean; version: string; mockAi: boolean }>('/api/health');
  catalog = () => this.req<Catalog>('/api/lessons');
  lesson = (id: string) => this.req<LessonDetail>(`/api/lessons/${encodeURIComponent(id)}`);
  async track(l: LessonDetail): Promise<IstepTrack> {
    const v = validateTrack(await this.req<unknown>(l.trackUrl));
    if (!v.ok)
      throw new ApiError(`This lesson file is invalid: ${v.errors[0]?.path} ${v.errors[0]?.message}`, 422);
    return v.value;
  }
  async reference(l: LessonDetail): Promise<ReferenceTimeline | undefined> {
    if (!l.referenceUrl) return undefined;
    const v = validateReference(await this.req<unknown>(l.referenceUrl));
    return v.ok ? v.value : undefined;
  }
  profiles = () => this.req<Profile[]>('/api/profiles');
  createProfile = (p: { name: string; avatar: string; affectedHand: Profile['affectedHand'] }) =>
    this.req<Profile>('/api/profiles', { method: 'POST', body: JSON.stringify(p) });
  progress = (id: string, days = 14) => this.req<Progress>(`/api/profiles/${id}/progress?days=${days}`);
  recentPasses = (id: string) => this.req<Record<string, number>>(`/api/profiles/${id}/recent-passes`);
  saveSession = (s: SessionSummary) =>
    this.req<{ id: string }>('/api/sessions', { method: 'POST', body: JSON.stringify(s) });
  coach = (c: CoachRequest) =>
    this.req<CoachResponse>('/api/coach', { method: 'POST', body: JSON.stringify(c) });
  /** Returns an audio URL, or null when Polly is off (caption + companion speech instead). */
  async voice(text: string, language: string): Promise<string | null> {
    const r = await this.req<{ url?: string } | undefined>('/api/voice', {
      method: 'POST',
      body: JSON.stringify({ text, language }),
    });
    return r?.url ? this.url(r.url) : null;
  }
  createReport = (profileId: string, days = 14) =>
    this.req<{ token: string; url: string }>('/api/reports', {
      method: 'POST',
      body: JSON.stringify({ profileId, days }),
    });
}
