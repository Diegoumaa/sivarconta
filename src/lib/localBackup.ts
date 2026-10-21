/** Demo-only storage. A corrupt cache or full browser storage must not crash the app. */
export function readBackup<T>(key: string, fallback: T[]): T[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) || 'null');
    return Array.isArray(value) && value.every(row => row && typeof row === 'object' && typeof row.id === 'string')
      ? value as T[]
      : fallback;
  } catch {
    return fallback;
  }
}

export function writeBackup(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
