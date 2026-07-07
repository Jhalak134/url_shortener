const { Worker } = require('bullmq');
const geoip = require('geoip-lite');
const UAParser = require('ua-parser-js');
const pool = require('../config/db');
const redisClient = require('../config/redis');

const worker = new Worker('click-events', async (job) => {
  const { linkId, ipAddress, userAgent, referer, timestamp } = job.data;

  try {
    // 1. Parse User Agent
    const parser = new UAParser(userAgent);
    const browser = parser.getBrowser().name || 'Unknown';
    const os = parser.getOS().name || 'Unknown';
    const deviceType = parser.getDevice().type || 'desktop';

    // 2. Parse IP (GeoIP)
    // Note: geoip-lite returns null for localhost/private IPs (127.x, 192.168.x, ::1)
    const geo = geoip.lookup(ipAddress) || {};
    const country = geo.country || null;   // VARCHAR(2) — must be ISO code or NULL
    const region = geo.region || null;
    const city = geo.city || null;

    // 3. Update total clicks count in links table
    await pool.query('UPDATE links SET clicks_count = clicks_count + 1 WHERE id = $1', [linkId]);

    // 4. Insert detailed analytics record
    const insertQuery = `
      INSERT INTO clicks (
        link_id, ip_address, user_agent, referer, 
        country, region, city, device_type, browser, os, clicked_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    `;

    await pool.query(insertQuery, [
      linkId, ipAddress, userAgent, referer,
      country, region, city, deviceType, browser, os, timestamp
    ]);

    console.log(`Processed click for linkId: ${linkId}`);
  } catch (error) {
    console.error('Error processing click event:', error);
    throw error;
  }
}, { connection: redisClient });

worker.on('failed', (job, err) => {
  console.error(`Job ${job.id} failed with error ${err.message}`);
});

console.log('Click processor worker started');
