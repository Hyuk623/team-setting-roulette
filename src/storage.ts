import type { StoredSession } from './types';

const STORAGE_KEY = 'roulette-session-v2';

export function loadSession(): StoredSession | null {
  const rawValue = window.localStorage.getItem(STORAGE_KEY);

  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as StoredSession;
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function saveSession(session: StoredSession): void {
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      ...session,
      updatedAt: new Date().toISOString(),
    }),
  );
}

export function clearSession(): void {
  window.localStorage.removeItem(STORAGE_KEY);
}
