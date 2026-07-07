const crypto = require('crypto');
const pool = require('../config/db');

const BASE62 = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

class HashService {
  // ─────────────────────────────────────────────────
  // PRIMARY STRATEGY: Postgres sequence → Base62 encode
  //
  // Pros:  Collision-free by design (sequence is monotonically increasing).
  //        O(1) — no DB lookup needed to verify uniqueness.
  //        Produces short, predictable-length codes.
  // Cons:  Requires a DB round-trip to get the next sequence value.
  //        Sequential codes are slightly guessable (enumerable).
  // ─────────────────────────────────────────────────

  /**
   * Encodes a given integer ID into a Base62 string.
   * @param {number} num
   * @returns {string}
   */
  static encode(num) {
    if (num === 0) return BASE62[0];
    let str = '';
    while (num > 0) {
      str = BASE62[num % 62] + str;
      num = Math.floor(num / 62);
    }
    return str;
  }

  /**
   * Decodes a Base62 string back to an integer ID.
   * @param {string} str
   * @returns {number}
   */
  static decode(str) {
    let num = 0;
    for (let i = 0; i < str.length; i++) {
      num = num * 62 + BASE62.indexOf(str[i]);
    }
    return num;
  }

  /**
   * Primary strategy: get the next sequence value from Postgres and encode it.
   * @returns {Promise<string>}
   */
  static async generateFromSequence() {
    const result = await pool.query("SELECT nextval('short_code_seq') AS id");
    return HashService.encode(parseInt(result.rows[0].id, 10));
  }

  // ─────────────────────────────────────────────────
  // FALLBACK STRATEGY: SHA256 truncated + collision retry
  //
  // How it works:
  //   1. SHA256-hash the original URL.
  //   2. Take the first 7 characters of the hex digest.
  //   3. Re-encode those bytes into Base62 to keep codes short.
  //   4. If that code already exists in Postgres, append a salt and retry.
  //
  // Pros:  Deterministic for the same URL (same long URL → same short code).
  //        No dependency on a DB sequence; can be computed offline.
  //        Non-enumerable / less guessable codes.
  // Cons:  Collisions ARE possible (rare but non-zero), requiring retry logic.
  //        Each retry costs an extra DB read — worst-case O(k) retries.
  //        Two different URLs can produce the same hash prefix (birthday problem).
  //
  // INTERVIEW TALKING POINT:
  //   The sequence strategy trades guessability for collision-freedom.
  //   The hash strategy trades collision-freedom for URL determinism.
  //   In a real system you'd pick based on whether deduplication matters
  //   (hash) or throughput/simplicity matters (sequence).
  // ─────────────────────────────────────────────────

  /**
   * Fallback strategy: SHA256(url + salt) truncated to Base62, with collision retry.
   * @param {string} originalUrl
   * @param {string} [existingShortCode] - pass any previously generated code to skip it
   * @returns {Promise<string>}
   */
  static async generateFromHash(originalUrl, existingShortCode = null) {
    const MAX_RETRIES = 5;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const salt = attempt === 0 ? '' : `-salt${attempt}`;
      const hash = crypto
        .createHash('sha256')
        .update(originalUrl + salt)
        .digest('hex'); // full 64-char hex string

      // Take first 7 hex chars → convert to integer → encode to Base62
      const truncated = parseInt(hash.slice(0, 7), 16);
      const shortCode = HashService.encode(truncated);

      // Check for collision in Postgres
      const { rows } = await pool.query(
        'SELECT id FROM links WHERE short_code = $1',
        [shortCode]
      );

      if (rows.length === 0) {
        return shortCode; // No collision — use this code
      }
      // Collision found — loop and retry with a salt
      console.warn(`Hash collision on attempt ${attempt + 1} for code "${shortCode}", retrying...`);
    }

    throw new Error(`Could not generate a unique hash-based short code after ${MAX_RETRIES} attempts.`);
  }
}

module.exports = HashService;
