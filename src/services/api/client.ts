/**
 * Minimal fetch wrapper for the Pawhaven API.
 * - Same-origin cookies (session is an httpOnly cookie the JS never sees).
 * - Double-submit CSRF token on every mutation.
 * - Uniform error type mapped from the API's `{ error: { code, message } }`.
 */
export class ApiRequestError extends Error {
  readonly code: string;
  readonly status: number;
  readonly fields?: Record<string, string>;
  readonly retryAfter?: number;

  constructor(status: number, code: string, message: string, fields?: Record<string, string>, retryAfter?: number) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = code;
    this.fields = fields;
    this.retryAfter = retryAfter;
  }
}

const CSRF_COOKIE = 'ph_csrf';

function readCookie(name: string): string | null {
  const match = document.cookie.split('; ').find((c) => c.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

let csrfPromise: Promise<string> | null = null;
async function csrfToken(): Promise<string> {
  const existing = readCookie(CSRF_COOKIE);
  if (existing) return existing;
  csrfPromise ??= fetch('/api/auth/csrf', { credentials: 'same-origin' })
    .then((r) => r.json())
    .then((d: { token: string }) => d.token)
    .finally(() => {
      csrfPromise = null;
    });
  return csrfPromise;
}

/** Listeners notified when the API says the session is gone (401). */
const unauthorizedListeners = new Set<() => void>();
export function onUnauthorized(fn: () => void) {
  unauthorizedListeners.add(fn);
  return () => {
    unauthorizedListeners.delete(fn);
  };
}

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export async function api<T>(
  method: Method,
  path: string,
  body?: unknown,
  opts: { signal?: AbortSignal; retryCsrf?: boolean } = {},
): Promise<T> {
  const headers: Record<string, string> = { accept: 'application/json' };
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
  if (body !== undefined && !isForm) headers['content-type'] = 'application/json';
  if (method !== 'GET') headers['x-csrf-token'] = await csrfToken();

  let res: Response;
  try {
    res = await fetch(path, {
      method,
      headers,
      credentials: 'same-origin',
      body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
      signal: opts.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new ApiRequestError(0, 'NETWORK', 'We couldn’t reach Pawhaven. Check your connection and try again.');
  }

  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (res.ok) return data as T;

  const e = (data as { error?: { code?: string; message?: string; fields?: Record<string, string>; retryAfter?: number } } | null)
    ?.error;
  const code = e?.code ?? (res.status >= 500 ? 'INTERNAL' : 'UNKNOWN');

  // A stale CSRF cookie: fetch a fresh token once and retry.
  if (code === 'CSRF' && opts.retryCsrf !== false) {
    document.cookie = `${CSRF_COOKIE}=; Max-Age=0; path=/`;
    return api<T>(method, path, body, { ...opts, retryCsrf: false });
  }
  if (res.status === 401 && code === 'UNAUTHENTICATED') unauthorizedListeners.forEach((fn) => fn());
  throw new ApiRequestError(res.status, code, e?.message ?? 'Something went wrong. Please try again.', e?.fields, e?.retryAfter);
}

export const http = {
  get: <T>(path: string, signal?: AbortSignal) => api<T>('GET', path, undefined, { signal }),
  post: <T>(path: string, body?: unknown) => api<T>('POST', path, body ?? {}),
  patch: <T>(path: string, body?: unknown) => api<T>('PATCH', path, body ?? {}),
  put: <T>(path: string, body?: unknown) => api<T>('PUT', path, body ?? {}),
  del: <T>(path: string) => api<T>('DELETE', path),
};
