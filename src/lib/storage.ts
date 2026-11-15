/**
 * Defensive Web Storage access. Storage can be unavailable or throw
 * (private mode, blocked site data, quota), so every call is wrapped and
 * falls back to an in-memory map for the lifetime of the page.
 */
const memory = new Map<string, string>();

type Area = 'local' | 'session';

function area(kind: Area): Storage | null {
  try {
    const s = kind === 'local' ? window.localStorage : window.sessionStorage;
    const probe = '__pawhaven_probe__';
    s.setItem(probe, probe);
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

export function readJSON<T>(key: string, fallback: T, kind: Area = 'local'): T {
  try {
    const raw = area(kind)?.getItem(key) ?? memory.get(`${kind}:${key}`) ?? null;
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeJSON(key: string, value: unknown, kind: Area = 'local'): void {
  const raw = JSON.stringify(value);
  try {
    const s = area(kind);
    if (s) s.setItem(key, raw);
    else memory.set(`${kind}:${key}`, raw);
  } catch {
    memory.set(`${kind}:${key}`, raw);
  }
}

export function removeKey(key: string, kind: Area = 'local'): void {
  try {
    area(kind)?.removeItem(key);
  } catch {
    /* ignore */
  }
  memory.delete(`${kind}:${key}`);
}

/** Test helper. */
export function __resetMemoryStorage(): void {
  memory.clear();
}
