const redisClient = require('../config/redis');

// Key prefixes to keep Redis namespace clean
const URL_KEY = (shortCode) => `url:${shortCode}`;
const CLICK_KEY = (shortCode) => `clicks:${shortCode}`;
const URL_TTL_SECONDS = 86400; // 24 hours

class CacheService {
  // ─────────────────────────────────────────────────
  // CACHE-ASIDE PATTERN: short_code → long_url
  //
  // The application code (not Redis) is responsible for loading data
  // into the cache on a miss (read-through) and invalidating on update.
  // Redis is the fast path; Postgres is the source of truth.
  // ─────────────────────────────────────────────────

  /**
   * Store a short_code → original_url mapping in Redis with TTL.
   * @param {string} shortCode
   * @param {string} originalUrl
   */
  static async setUrl(shortCode, originalUrl) {
    try {
      await redisClient.set(URL_KEY(shortCode), originalUrl, 'EX', URL_TTL_SECONDS);
    } catch (error) {
      console.error('CacheService.setUrl error:', error);
    }
  }

  /**
   * Retrieve the original URL for a short code from Redis.
   * Returns null on a cache miss or Redis error.
   * @param {string} shortCode
   * @returns {Promise<string|null>}
   */
  static async getUrl(shortCode) {
    try {
      return await redisClient.get(URL_KEY(shortCode));
    } catch (error) {
      console.error('CacheService.getUrl error:', error);
      return null;
    }
  }

  /**
   * Remove a short_code → URL mapping from cache (call on link deletion/update).
   * @param {string} shortCode
   */
  static async removeUrl(shortCode) {
    try {
      await redisClient.del(URL_KEY(shortCode));
    } catch (error) {
      console.error('CacheService.removeUrl error:', error);
    }
  }

  // ─────────────────────────────────────────────────
  // FAST CLICK COUNTER: Redis INCR-based
  //
  // Why two counters?
  //   - Postgres `links.clicks_count` is the AUTHORITATIVE count, but it is
  //     updated asynchronously by the BullMQ worker (not on the hot redirect path).
  //   - This Redis counter is incremented IMMEDIATELY on every redirect, giving
  //     a near-real-time count suitable for dashboards without hitting Postgres.
  //   - Periodically (or on link delete) the Redis count can be flushed to Postgres.
  //
  // Redis INCR is atomic and O(1), making it safe under high concurrency.
  // ─────────────────────────────────────────────────

  /**
   * Atomically increment the fast click counter for a short code.
   * @param {string} shortCode
   * @returns {Promise<number>} new counter value
   */
  static async incrementClickCount(shortCode) {
    try {
      return await redisClient.incr(CLICK_KEY(shortCode));
    } catch (error) {
      console.error('CacheService.incrementClickCount error:', error);
      return null;
    }
  }

  /**
   * Get the current fast click count from Redis.
   * Returns null if not set (no clicks yet or key expired).
   * @param {string} shortCode
   * @returns {Promise<number|null>}
   */
  static async getClickCount(shortCode) {
    try {
      const val = await redisClient.get(CLICK_KEY(shortCode));
      return val !== null ? parseInt(val, 10) : null;
    } catch (error) {
      console.error('CacheService.getClickCount error:', error);
      return null;
    }
  }

  /**
   * Reset the Redis click counter (e.g., after flushing to Postgres).
   * @param {string} shortCode
   */
  static async resetClickCount(shortCode) {
    try {
      await redisClient.del(CLICK_KEY(shortCode));
    } catch (error) {
      console.error('CacheService.resetClickCount error:', error);
    }
  }
}

module.exports = CacheService;
