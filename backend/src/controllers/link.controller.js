const pool = require('../config/db');
const CacheService = require('../services/cache.service');
const HashService = require('../services/hash.service');

const createLink = async (req, res) => {
  const { originalUrl } = req.body;
  const userId = req.user ? req.user.id : null; // Optional user

  if (!originalUrl) {
    return res.status(400).json({ error: 'originalUrl is required' });
  }

  try {
    // 1. Get next ID from sequence
    const seqResult = await pool.query("SELECT nextval('short_code_seq') AS id");
    const id = seqResult.rows[0].id;

    // 2. Encode to base62
    const shortCode = HashService.encode(parseInt(id, 10));

    // 3. Insert into DB
    const insertQuery = `
      INSERT INTO links (user_id, original_url, short_code) 
      VALUES ($1, $2, $3) 
      RETURNING *
    `;
    const result = await pool.query(insertQuery, [userId, originalUrl, shortCode]);
    const newLink = result.rows[0];

    // 4. Cache in Redis
    await CacheService.setUrl(shortCode, originalUrl);

    res.status(201).json(newLink);
  } catch (error) {
    console.error('Error creating link:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getLinks = async (req, res) => {
  const userId = req.user.id; // Protected route, user is guaranteed
  
  try {
    const result = await pool.query(
      'SELECT * FROM links WHERE user_id = $1 ORDER BY created_at DESC', 
      [userId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching links:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  createLink,
  getLinks
};
