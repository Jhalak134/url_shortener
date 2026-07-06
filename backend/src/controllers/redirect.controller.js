const pool = require('../config/db');
const CacheService = require('../services/cache.service');
const clickQueue = require('../queues/click.queue');

const handleRedirect = async (req, res) => {
  const { shortCode } = req.params;

  try {
    let originalUrl = await CacheService.getUrl(shortCode);
    let linkId = null;

    if (originalUrl) {
      // Background query to get link_id for analytics if we only stored originalUrl in cache
      // A better approach is to store { originalUrl, linkId } in cache, but for now we'll do this.
      const result = await pool.query('SELECT id FROM links WHERE short_code = $1', [shortCode]);
      if (result.rows.length > 0) linkId = result.rows[0].id;
    } else {
      // Cache miss, hit the database
      const result = await pool.query('SELECT id, original_url FROM links WHERE short_code = $1', [shortCode]);
      
      if (result.rows.length === 0) {
        return res.status(404).send('URL not found');
      }

      originalUrl = result.rows[0].original_url;
      linkId = result.rows[0].id;

      // Update cache
      await CacheService.setUrl(shortCode, originalUrl);
    }

    if (!originalUrl) {
       return res.status(404).send('URL not found');
    }

    // Redirect the user immediately
    res.redirect(originalUrl);

    // After response is sent, queue analytics processing (Async)
    if (linkId) {
      const clickData = {
        linkId,
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.headers['user-agent'] || '',
        referer: req.headers['referer'] || req.headers['referrer'] || '',
        timestamp: new Date().toISOString()
      };

      await clickQueue.add('processClick', clickData, {
        removeOnComplete: true,
        removeOnFail: false
      });
    }

  } catch (error) {
    console.error('Error handling redirect:', error);
    res.status(500).send('Internal Server Error');
  }
};

module.exports = {
  handleRedirect
};
