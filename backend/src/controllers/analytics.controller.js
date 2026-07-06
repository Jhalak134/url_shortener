const pool = require('../config/db');

const getLinkAnalytics = async (req, res) => {
  const { shortCode } = req.params;
  const userId = req.user.id;

  try {
    // 1. Get the link ID and verify ownership
    const linkResult = await pool.query(
      'SELECT id, clicks_count, created_at FROM links WHERE short_code = $1 AND user_id = $2', 
      [shortCode, userId]
    );

    if (linkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Link not found or unauthorized' });
    }

    const linkId = linkResult.rows[0].id;
    const totalClicks = linkResult.rows[0].clicks_count;

    // 2. Aggregate Data: Top Countries
    const topCountries = await pool.query(`
      SELECT country, COUNT(*) as count 
      FROM clicks 
      WHERE link_id = $1 
      GROUP BY country 
      ORDER BY count DESC 
      LIMIT 10
    `, [linkId]);

    // 3. Aggregate Data: Browsers
    const browsers = await pool.query(`
      SELECT browser, COUNT(*) as count 
      FROM clicks 
      WHERE link_id = $1 
      GROUP BY browser 
      ORDER BY count DESC
    `, [linkId]);

    // 4. Aggregate Data: Device Types
    const devices = await pool.query(`
      SELECT device_type, COUNT(*) as count 
      FROM clicks 
      WHERE link_id = $1 
      GROUP BY device_type 
      ORDER BY count DESC
    `, [linkId]);

    // 5. Time series data (last 30 days)
    const timeSeries = await pool.query(`
      SELECT DATE(clicked_at) as date, COUNT(*) as count
      FROM clicks
      WHERE link_id = $1 AND clicked_at > CURRENT_DATE - INTERVAL '30 days'
      GROUP BY DATE(clicked_at)
      ORDER BY date ASC
    `, [linkId]);

    res.json({
      totalClicks,
      topCountries: topCountries.rows,
      browsers: browsers.rows,
      devices: devices.rows,
      timeSeries: timeSeries.rows
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  getLinkAnalytics
};
