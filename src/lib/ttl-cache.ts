/**
 * Tiny in-memory TTL cache that also de-duplicates in-flight loads: if 200 requests land on one server instance
 * in the same second, only the first hits Firestore and the rest share its promise. Failed loads are not cached.
 */
export function ttlCache<T>(ttlMs: number) {
  const store = new Map<string, { exp: number; value: Promise<T> }>();
  return {
    get(key: string, load: () => Promise<T>): Promise<T> {
      const now = Date.now();
      const hit = store.get(key);
      if (hit && hit.exp > now) return hit.value;
      const value: Promise<T> = load().catch((e) => {
        if (store.get(key)?.value === value) store.delete(key);
        throw e;
      });
      store.set(key, { exp: now + ttlMs, value });
      return value;
    },
    delete(key: string) {
      store.delete(key);
    },
  };
}
