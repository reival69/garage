// Talleo — low-level storage layer.
// The ONLY place that touches localStorage. Components must never read/write
// localStorage directly; they go through repositories built on top of this.
//
// Key scheme:
//   talleo:{tenantId}:{collection}   — per-tenant collections
//   talleo:global:{collection}       — global collections (tenants, plans, users)

const PREFIX = "talleo";
export const GLOBAL = "global";

function storageAvailable(): boolean {
  return typeof window !== "undefined" && !!window.localStorage;
}

export function keyFor(collection: string, tenantId: string = GLOBAL): string {
  return `${PREFIX}:${tenantId}:${collection}`;
}

export function read<T>(collection: string, tenantId: string = GLOBAL): T[] {
  if (!storageAvailable()) return [];
  try {
    const raw = window.localStorage.getItem(keyFor(collection, tenantId));
    if (!raw) return [];
    return JSON.parse(raw) as T[];
  } catch {
    return [];
  }
}

export function write<T>(
  collection: string,
  tenantId: string,
  items: T[],
): void {
  if (!storageAvailable()) return;
  try {
    window.localStorage.setItem(
      keyFor(collection, tenantId),
      JSON.stringify(items),
    );
  } catch (err) {
    // Likely quota exceeded (base64 photos/signatures).
    console.error("Talleo storage write failed", err);
  }
}

/** Read a single non-collection value (e.g. flags). */
export function readRaw(key: string): string | null {
  if (!storageAvailable()) return null;
  return window.localStorage.getItem(`${PREFIX}:${key}`);
}

export function writeRaw(key: string, value: string): void {
  if (!storageAvailable()) return;
  window.localStorage.setItem(`${PREFIX}:${key}`, value);
}

/** Remove every Talleo key. Used by resetDemo(). */
export function clearAll(): void {
  if (!storageAvailable()) return;
  const toRemove: string[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const k = window.localStorage.key(i);
    if (k && k.startsWith(`${PREFIX}:`)) toRemove.push(k);
  }
  toRemove.forEach((k) => window.localStorage.removeItem(k));
}

/** List every tenant key suffix present (used to scan across tenants). */
export function listTenantIdsWithCollection(collection: string): string[] {
  if (!storageAvailable()) return [];
  const ids: string[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const k = window.localStorage.key(i);
    if (!k) continue;
    const parts = k.split(":");
    if (parts.length === 3 && parts[0] === PREFIX && parts[2] === collection) {
      ids.push(parts[1]);
    }
  }
  return ids;
}

export function uid(prefix = "id"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}
