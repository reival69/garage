// Garage — low-level storage layer.
//
// Components never talk to the server directly: they use the repositories in
// repos.ts, which read and write here, synchronously, as they did when the demo
// kept everything in localStorage.
//
// Now the data lives in PostgreSQL on the server. This module keeps an in-memory
// copy of what the current user may see (loaded at start by AuthContext through
// `hydrate`) and sends every change to the server in the background (see
// `setPersister`). The server re-checks every change, so this cache is only a
// convenience, never the source of truth.

const PREFIX = "talleo";
export const GLOBAL = "global";

export interface StoredDoc {
  t: string; // tenant id or "global"
  c: string; // collection
  id: string;
  data: Record<string, unknown>;
}

export interface PendingOp {
  t: string;
  c: string;
  upserts: Record<string, unknown>[];
  deletes: string[];
}

/** Sends changes to the server; resolves with the saved documents. */
export type Persister = (ops: PendingOp[]) => Promise<StoredDoc[]>;

const cache = new Map<string, Map<string, Record<string, unknown>>>();
let persister: Persister | null = null;
let queue = new Map<string, PendingOp>();
let flushing: Promise<void> | null = null;
let flushScheduled = false;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
const pendingListeners = new Set<(pending: boolean) => void>();

function cacheKey(collection: string, tenantId: string) {
  return `${tenantId}:${collection}`;
}

function bucket(collection: string, tenantId: string, create = false) {
  const key = cacheKey(collection, tenantId);
  let b = cache.get(key);
  if (!b && create) {
    b = new Map();
    cache.set(key, b);
  }
  return b;
}

const clone = <T>(value: T): T =>
  value === undefined ? value : (JSON.parse(JSON.stringify(value)) as T);

export function keyFor(collection: string, tenantId: string = GLOBAL): string {
  return `${PREFIX}:${tenantId}:${collection}`;
}

export function read<T>(collection: string, tenantId: string = GLOBAL): T[] {
  const b = bucket(collection, tenantId);
  // Copies, so callers can modify what they get without touching the cache
  return b ? (Array.from(b.values(), (v) => clone(v)) as T[]) : [];
}

export function write<T>(collection: string, tenantId: string, items: T[]): void {
  const b = bucket(collection, tenantId, true)!;
  const next = new Map<string, Record<string, unknown>>();
  for (const item of items as Record<string, unknown>[]) next.set(item.id as string, clone(item));

  const op = queuedOp(collection, tenantId);
  for (const [id, doc] of next) {
    const before = b.get(id);
    if (!before || JSON.stringify(before) !== JSON.stringify(doc)) {
      op.upserts = op.upserts.filter((d) => d.id !== id);
      op.upserts.push(doc);
      op.deletes = op.deletes.filter((d) => d !== id);
    }
  }
  for (const id of b.keys()) {
    if (!next.has(id)) {
      op.deletes.push(id);
      op.upserts = op.upserts.filter((d) => d.id !== id);
    }
  }
  cache.set(cacheKey(collection, tenantId), next);
  if (op.upserts.length || op.deletes.length) scheduleFlush();
}

function queuedOp(collection: string, tenantId: string): PendingOp {
  const key = cacheKey(collection, tenantId);
  let op = queue.get(key);
  if (!op) {
    op = { t: tenantId, c: collection, upserts: [], deletes: [] };
    queue.set(key, op);
  }
  return op;
}

function setPending(pending: boolean) {
  for (const fn of pendingListeners) fn(pending);
}

function scheduleFlush() {
  if (flushScheduled) return;
  flushScheduled = true;
  setPending(true);
  // Group every write made in the same tick into one request
  queueMicrotask(() => {
    flushScheduled = false;
    void flush();
  });
}

let errorHandler: (error: unknown) => void = (err) =>
  console.error("Garage: no se pudo guardar", err);

/** Called when the server rejects or cannot receive a change. */
export function onSaveError(handler: (error: unknown) => void) {
  errorHandler = handler;
}

export function onPendingChange(listener: (pending: boolean) => void) {
  pendingListeners.add(listener);
  return () => pendingListeners.delete(listener);
}

/** Sends queued changes. Concurrent calls wait for the one in flight. */
export async function flush(): Promise<void> {
  if (flushing) {
    await flushing;
    if (queue.size && !retryTimer) return flush();
    return;
  }
  if (!queue.size || !persister) {
    if (!queue.size) setPending(false);
    return;
  }
  const ops = [...queue.values()].filter((op) => op.upserts.length || op.deletes.length);
  queue = new Map();
  flushing = (async () => {
    try {
      const saved = await persister!(ops);
      // The server may have changed documents (images become /files URLs)
      for (const doc of saved) {
        const b = bucket(doc.c, doc.t, true)!;
        if (b.has(doc.id)) b.set(doc.id, doc.data);
      }
    } catch (err) {
      if ((err as { retry?: boolean }).retry) {
        // Connection problem: put the changes back (newer edits win) and try again
        for (const op of ops) {
          const current = queuedOp(op.c, op.t);
          for (const doc of op.upserts) {
            if (
              !current.upserts.some((d) => d.id === doc.id) &&
              !current.deletes.includes(doc.id as string)
            ) {
              current.upserts.push(doc);
            }
          }
          for (const id of op.deletes) {
            if (!current.deletes.includes(id) && !current.upserts.some((d) => d.id === id))
              current.deletes.push(id);
          }
        }
        retryTimer ??= setTimeout(() => {
          retryTimer = null;
          void flush();
        }, 3000);
      }
      errorHandler(err);
    } finally {
      flushing = null;
    }
  })();
  await flushing;
  // Writes made meanwhile already scheduled their own flush
  if (!queue.size) setPending(false);
}

export function setPersister(fn: Persister | null) {
  persister = fn;
  if (fn && queue.size) scheduleFlush();
}

/** Replaces the cache with what the server says the user may see. */
export function hydrate(docs: StoredDoc[]) {
  cache.clear();
  queue = new Map();
  mergeDocs(docs);
}

/** Adds documents to the cache (e.g. a customer page opened while logged in). */
export function mergeDocs(docs: StoredDoc[]) {
  for (const doc of docs) bucket(doc.c, doc.t, true)!.set(doc.id, doc.data);
}

/** Small per-browser preferences (not shared, not on the server). */
export function readRaw(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(`${PREFIX}:${key}`);
  } catch {
    return null;
  }
}

export function writeRaw(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(`${PREFIX}:${key}`, value);
  } catch {
    // Private browsing or storage disabled: preferences are optional
  }
}

/** Forgets everything in memory (used when logging out). */
export function clearAll(): void {
  cache.clear();
  queue = new Map();
}

/** Every tenant id present in the cache for a collection (used to scan across tenants). */
export function listTenantIdsWithCollection(collection: string): string[] {
  const ids: string[] = [];
  for (const key of cache.keys()) {
    const sep = key.lastIndexOf(":");
    if (key.slice(sep + 1) === collection) ids.push(key.slice(0, sep));
  }
  return ids;
}

export function uid(prefix = "id"): string {
  // Random enough to never clash, even across browsers saving at the same time
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 16)
      : `${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
  return `${prefix}_${random}`;
}
