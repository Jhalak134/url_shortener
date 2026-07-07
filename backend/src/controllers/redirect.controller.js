const pool = require('../config/db');
const CacheService = require('../services/cache.service');
const clickQueue = require('../queues/click.queue');

const handleRedirect = async (req, res) => {
  const { shortCode } = req.params;

  try {
    // Cache stores JSON with both originalUrl and linkId to avoid an extra DB round-trip on cache hits
    const cached = await CacheService.getUrl(shortCode);
    let originalUrl = null;
    let linkId = null;

    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        originalUrl = parsed.originalUrl;
        linkId = parsed.linkId;
      } catch {
        // Legacy plain-string cache entry — treat as URL only
        originalUrl = cached;
      }
    } else {
      // Cache miss — hit the database
      const result = await pool.query('SELECT id, original_url FROM links WHERE short_code = $1', [shortCode]);

      if (result.rows.length === 0) {
        return res.status(404).send('URL not found');
      }

      originalUrl = result.rows[0].original_url;
      linkId = result.rows[0].id;

      // Populate cache with both fields as JSON
      await CacheService.setUrl(shortCode, JSON.stringify({ originalUrl, linkId }));
    }

    if (!originalUrl) {
       return res.status(404).send('URL not found');
    }

    // Redirect the user immediately
    res.redirect(originalUrl);

    // ── Post-redirect async work (non-blocking) ──────────────────────────
    if (linkId) {
      // 1. Increment the fast Redis click counter immediately (O(1), atomic)
      CacheService.incrementClickCount(shortCode).catch((err) =>
        console.error('Failed to increment Redis click count:', err)
      );

      // 2. Queue full analytics processing (geo, UA parsing, Postgres write) via BullMQ
      const clickData = {
        linkId,
        shortCode,
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.headers['user-agent'] || '',
        referer: req.headers['referer'] || req.headers['referrer'] || '',
        timestamp: new Date().toISOString(),
      };

      clickQueue.add('processClick', clickData, {
        removeOnComplete: true,
        removeOnFail: false,
      }).catch((err) => console.error('Failed to queue click event:', err));
    }

  } catch (error) {
    console.error('Error handling redirect:', error);
    res.status(500).send('Internal Server Error');
  }
};

module.exports = {
  handleRedirect
};
