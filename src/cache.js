class TTLCache {
  constructor(defaultTtlMs = 6 * 60 * 60 * 1000) {
    this.defaultTtlMs = defaultTtlMs;
    this.entries = new Map();
  }

  get(key) {
    const entry = this.entries.get(key);

    if (!entry) {
      return undefined;
    }

    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return undefined;
    }

    return entry.value;
  }

  set(key, value, ttlMs = this.defaultTtlMs) {
    this.entries.set(key, {
      value,
      expiresAt: Date.now() + ttlMs
    });

    return value;
  }

  async getOrCreate(key, factory, ttlMs = this.defaultTtlMs) {
    const cached = this.get(key);

    if (cached !== undefined) {
      return cached;
    }

    const pending = Promise.resolve().then(factory);
    this.set(key, pending, ttlMs);

    try {
      const resolved = await pending;
      this.set(key, resolved, ttlMs);
      return resolved;
    } catch (error) {
      this.entries.delete(key);
      throw error;
    }
  }
}

module.exports = {
  TTLCache
};
