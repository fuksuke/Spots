/**
 * LRU (Least Recently Used) Cache for Premium Spots
 *
 * Limits the number of premium spots displayed on the map to prevent
 * DOM overflow and maintain performance. When the cache is full,
 * the least recently accessed spot is evicted.
 *
 * This is particularly important because premium spots have priority
 * display and could accumulate over time, causing performance issues
 * if left unchecked.
 *
 * @example
 * ```typescript
 * const cache = new PremiumLRUCache<string, MapTileFeature>(50);
 *
 * // Add premium spots
 * premiumSpots.forEach(spot => {
 *   cache.set(spot.id, spot);
 * });
 *
 * // Get spot (updates access order)
 * const spot = cache.get('spot-123');
 *
 * // Check if spot exists
 * if (cache.has('spot-123')) {
 *   // ...
 * }
 *
 * // Get all values in LRU order
 * const spots = cache.values();
 * ```
 */

export class PremiumLRUCache<K, V> {
  private cache = new Map<K, V>();
  private accessOrder: K[] = [];
  private maxSize: number;

  /**
   * Create a new LRU cache with the specified maximum size
   *
   * @param maxSize Maximum number of items to store (default: 50)
   */
  constructor(maxSize: number = 50) {
    this.maxSize = maxSize;
  }

  /**
   * Get a value from the cache
   *
   * Updates the access order, marking this item as recently used.
   *
   * @param key The key to retrieve
   * @returns The cached value, or undefined if not found
   */
  get(key: K): V | undefined {
    const value = this.cache.get(key);

    if (value !== undefined) {
      // Update access order (move to end = most recently used)
      this.updateAccessOrder(key);
    }

    return value;
  }

  /**
   * Set a value in the cache
   *
   * If the cache is full, the least recently used item is evicted.
   * If the key already exists, updates the value and access order.
   *
   * @param key The key to store
   * @param value The value to store
   */
  set(key: K, value: V): void {
    // If key already exists, update value and access order
    if (this.cache.has(key)) {
      this.cache.set(key, value);
      this.updateAccessOrder(key);
      return;
    }

    // If cache is full, evict least recently used item
    if (this.cache.size >= this.maxSize) {
      const evicted = this.accessOrder.shift(); // Remove first item (least recently used)

      if (evicted !== undefined) {
        this.cache.delete(evicted);
      }
    }

    // Add new item
    this.cache.set(key, value);
    this.accessOrder.push(key); // Add to end (most recently used)
  }

  /**
   * Check if a key exists in the cache
   *
   * Does NOT update access order (use get() if you want to update order).
   *
   * @param key The key to check
   * @returns true if the key exists, false otherwise
   */
  has(key: K): boolean {
    return this.cache.has(key);
  }

  /**
   * Delete a key from the cache
   *
   * @param key The key to delete
   * @returns true if the key was deleted, false if it didn't exist
   */
  delete(key: K): boolean {
    const existed = this.cache.delete(key);

    if (existed) {
      // Remove from access order
      const index = this.accessOrder.indexOf(key);
      if (index > -1) {
        this.accessOrder.splice(index, 1);
      }
    }

    return existed;
  }

  /**
   * Update the access order for a key
   *
   * Moves the key to the end of the access order (most recently used).
   *
   * @param key The key to update
   */
  private updateAccessOrder(key: K): void {
    // Remove key from current position
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }

    // Add to end (most recently used)
    this.accessOrder.push(key);
  }

  /**
   * Clear all items from the cache
   */
  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
  }

  /**
   * Get the current size of the cache
   *
   * @returns The number of items in the cache
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Get the maximum size of the cache
   *
   * @returns The maximum number of items that can be stored
   */
  getMaxSize(): number {
    return this.maxSize;
  }

  /**
   * Check if the cache is full
   *
   * @returns true if the cache is at maximum capacity
   */
  isFull(): boolean {
    return this.cache.size >= this.maxSize;
  }

  /**
   * Get all keys in the cache
   *
   * Keys are returned in LRU order (least recently used first).
   *
   * @returns Array of keys
   */
  keys(): K[] {
    return [...this.accessOrder];
  }

  /**
   * Get all values in the cache
   *
   * Values are returned in LRU order (least recently used first).
   *
   * @returns Array of values
   */
  values(): V[] {
    return this.accessOrder.map(key => this.cache.get(key)!).filter(v => v !== undefined);
  }

  /**
   * Get all entries in the cache
   *
   * Entries are returned in LRU order (least recently used first).
   *
   * @returns Array of [key, value] tuples
   */
  entries(): [K, V][] {
    return this.accessOrder
      .map(key => {
        const value = this.cache.get(key);
        return value !== undefined ? ([key, value] as [K, V]) : null;
      })
      .filter((entry): entry is [K, V] => entry !== null);
  }

  /**
   * Get the least recently used key
   *
   * @returns The LRU key, or undefined if cache is empty
   */
  getLRUKey(): K | undefined {
    return this.accessOrder[0];
  }

  /**
   * Get the most recently used key
   *
   * @returns The MRU key, or undefined if cache is empty
   */
  getMRUKey(): K | undefined {
    return this.accessOrder[this.accessOrder.length - 1];
  }

  /**
   * Get cache statistics for debugging/monitoring
   *
   * @returns Object containing cache statistics
   */
  getStats(): {
    size: number;
    maxSize: number;
    utilizationPercent: number;
    isFull: boolean;
  } {
    return {
      size: this.size(),
      maxSize: this.maxSize,
      utilizationPercent: (this.size() / this.maxSize) * 100,
      isFull: this.isFull()
    };
  }
}
