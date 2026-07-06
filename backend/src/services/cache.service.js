const redisClient = require('../config/redis');

class CacheService {
  /**
   * Set a URL mapping in cache
   * @param {string} shortCode 
   * @param {string} originalUrl 
   */
  static async setUrl(shortCode, originalUrl) {
    try {
      // Cache for 24 hours (86400 seconds)
      await redisClient.set(`url:${shortCode}`, originalUrl, 'EX', 86400);
    } catch (error) {
      console.error('Redis setUrl error:', error);
    }
  }

  /**
   * Get a URL mapping from cache
   * @param {string} shortCode 
   * @returns {Promise<string|null>}
   */
  static async getUrl(shortCode) {
    try {
      return await redisClient.get(`url:${shortCode}`);
    } catch (error) {
      console.error('Redis getUrl error:', error);
      return null;
    }
  }

  /**
   * Remove a URL mapping from cache
   * @param {string} shortCode 
   */
  static async removeUrl(shortCode) {
    try {
      await redisClient.del(`url:${shortCode}`);
    } catch (error) {
      console.error('Redis removeUrl error:', error);
    }
  }
}

module.exports = CacheService;
