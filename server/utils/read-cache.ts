/** Small bounded cache with single-flight loading and explicit invalidation on writes. */
export class ReadCache<T> {
  private values = new Map<string, { value: T; expires: number }>();
  private pending = new Map<string, Promise<T>>();
  private generation = 0;
  constructor(private ttlMs: number, private maxEntries = 32) {}
  clear() {
    this.generation++;
    this.values.clear();
    this.pending.clear();
  }
  async get(key: string, loader: () => Promise<T>): Promise<T> {
    const cached = this.values.get(key);
    if (cached && cached.expires > Date.now()) return cached.value;
    const existing = this.pending.get(key);
    if (existing) return existing;
    const generation = this.generation;
    const pending = Promise.resolve().then(loader).then(value => {
      if (this.generation === generation) {
        if (this.values.size >= this.maxEntries) this.values.delete(this.values.keys().next().value!);
        this.values.set(key, { value, expires: Date.now() + this.ttlMs });
      }
      return value;
    }).finally(() => { if (this.pending.get(key) === pending) this.pending.delete(key); });
    this.pending.set(key, pending);
    return pending;
  }
}
