const pool = require('../config/db');
const CacheService = require('../services/cache.service');
const clickQueue = require('../queues/click.queue');

const handleRedirect = async (req, res) => {
  const { shortCode } = req.params;
  console.log(`[REDIRECT] Incoming request for shortCode: ${shortCode}`);

  try {
    const cached = await CacheService.getUrl(shortCode);
    let originalUrl = null;
    let linkId = null;

    if (cached) {
      console.log(`[REDIRECT] Cache HIT for ${shortCode}:`, cached);
      try {
        const parsed = JSON.parse(cached);
        originalUrl = parsed.originalUrl;
        linkId = parsed.linkId;
      } catch {
        // Legacy plain-string cache entry — treat as URL only
        originalUrl = cached;
      }
    } else {
      console.log(`[REDIRECT] Cache MISS for ${shortCode} — querying DB`);
      const result = await pool.query('SELECT id, original_url FROM links WHERE short_code = $1', [shortCode]);

      if (result.rows.length === 0) {
        console.log(`[REDIRECT] Short code not found in DB: ${shortCode}`);
        return res.status(404).send('URL not found');
      }

      originalUrl = result.rows[0].original_url;
      linkId = result.rows[0].id;
      console.log(`[REDIRECT] Found in DB — linkId: ${linkId}, url: ${originalUrl}`);

      await CacheService.setUrl(shortCode, JSON.stringify({ originalUrl, linkId }));
      console.log(`[REDIRECT] Cached successfully`);
    }

    if (!originalUrl) {
      return res.status(404).send('URL not found');
    }

    console.log(`[REDIRECT] Redirecting to: ${originalUrl}`);
    res.redirect(originalUrl);

    // ── Post-redirect async work (non-blocking) ──────────────────────────
    console.log(`[REDIRECT] Post-redirect: linkId=${linkId}, running async tasks...`);
    if (linkId) {
      // 1. Increment the fast Redis click counter immediately (O(1), atomic)
      CacheService.incrementClickCount(shortCode)
        .then((count) => console.log(`[REDIRECT] Redis click count for ${shortCode} is now: ${count}`))
        .catch((err) => console.error('[REDIRECT] Failed to increment Redis click count:', err));

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
      })
        .then(() => console.log(`[REDIRECT] Click queued for BullMQ processing`))
        .catch((err) => console.error('[REDIRECT] Failed to queue click event:', err));
    }

  } catch (error) {
    console.error('Error handling redirect:', error);
    res.status(500).send('Internal Server Error');
  }
};


module.exports = {
  handleRedirect
};
