require('/home/jaden-d-syiem/DAK Register /node_modules/@dotenvx/dotenvx').config();
const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

async function checkAcquired() {
    try {
        const res = await pool.query('SELECT * FROM acquired ORDER BY created_at DESC LIMIT 5');
        console.log("LATEST 5 ROWS:", res.rows);
    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}

checkAcquired();
