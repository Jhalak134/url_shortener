const fs = require('fs');
const path = require('path');
const pool = require('../config/db');

async function initDB() {
  try {
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    console.log('Running database schema...');
    await pool.query(schema);
    console.log('Database schema executed successfully.');
  } catch (err) {
    console.error('Error executing database schema:', err);
  } finally {
    pool.end();
  }
}

initDB();
