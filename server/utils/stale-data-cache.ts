export type StaleCacheValue<T> = {
  data: T;
  stale: boolean;
  fetchedAt: number;
};

export class StaleDataCache<T> {
  private cached: { data: T; fetchedAt: number } | null = null;
  private refreshPromise: Promise<T> | null = null;

  constructor(
    private readonly loader: () => Promise<T>,
    private readonly freshTtlMs: number,
    private readonly staleTtlMs: number,
    private readonly now: () => number = Date.now,
    private readonly onBackgroundError?: (error: unknown) => void,
  ) {}

  private refresh(): Promise<T> {
    if (!this.refreshPromise) {
      this.refreshPromise = this.loader()
        .then((data) => {
          this.cached = { data, fetchedAt: this.now() };
          return data;
        })
        .finally(() => {
          this.refreshPromise = null;
        });
    }
    return this.refreshPromise;
  }

  async get(): Promise<StaleCacheValue<T>> {
    const age = this.cached ? this.now() - this.cached.fetchedAt : Number.POSITIVE_INFINITY;
    if (this.cached && age <= this.freshTtlMs) {
      return { ...this.cached, stale: false };
    }
    if (this.cached && age <= this.staleTtlMs) {
      const current = { ...this.cached, stale: true };
      void this.refresh().catch((error) => this.onBackgroundError?.(error));
      return current;
    }
    const data = await this.refresh();
    return { data, fetchedAt: this.cached?.fetchedAt ?? this.now(), stale: false };
  }
}
