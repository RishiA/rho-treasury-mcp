/**
 * In-memory cache with TTL support
 */

import { CacheEntry } from "../types.js";

/**
 * Simple in-memory cache with TTL
 */
class Cache {
  private store: Map<string, CacheEntry<any>> = new Map();

  /**
   * Store data with TTL (time-to-live in milliseconds)
   */
  set<T>(key: string, data: T, ttlMs: number): void {
    const now = Date.now();
    const entry: CacheEntry<T> = {
      data,
      timestamp: now,
      expiresAt: now + ttlMs,
    };

    this.store.set(key, entry);
    console.error(`[Cache] SET ${key} (TTL: ${ttlMs}ms, expires: ${new Date(entry.expiresAt).toISOString()})`);
  }

  /**
   * Retrieve data if not expired, return null if expired or not found
   */
  get<T>(key: string): T | null {
    const entry = this.store.get(key);

    if (!entry) {
      console.error(`[Cache] MISS ${key} (not found)`);
      return null;
    }

    const now = Date.now();
    if (now > entry.expiresAt) {
      console.error(`[Cache] MISS ${key} (expired at ${new Date(entry.expiresAt).toISOString()})`);
      this.store.delete(key);
      return null;
    }

    const age = Math.round((now - entry.timestamp) / 1000);
    console.error(`[Cache] HIT ${key} (age: ${age}s)`);
    return entry.data as T;
  }

  /**
   * Check if cache entry exists and is valid
   */
  has(key: string): boolean {
    return this.get(key) !== null;
  }

  /**
   * Clear specific cache entry
   */
  clear(key: string): void {
    const existed = this.store.delete(key);
    console.error(`[Cache] CLEAR ${key} (${existed ? "existed" : "not found"})`);
  }

  /**
   * Clear all cache entries
   */
  clearAll(): void {
    const count = this.store.size;
    this.store.clear();
    console.error(`[Cache] CLEAR ALL (cleared ${count} entries)`);
  }

  /**
   * Get cache statistics
   */
  stats(): { size: number; keys: string[] } {
    return {
      size: this.store.size,
      keys: Array.from(this.store.keys()),
    };
  }
}

// Export singleton instance
export const cache = new Cache();
