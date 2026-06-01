//=============================
//CONNECTING TO DB
//=============================

//====================================
//VARIABLE CONNECTING TO .ENV FILE
//====================================

require('@dotenvx/dotenvx').config();
const { Pool } = require('pg');
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database:process.env.DB_DATABASE,
  password:process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000
});

//============================
//TESTING DB CONNECTION
//============================

(async () => {
  try {
    const client = await pool.connect();
    console.log('Connected to the database successfully!');
    client.release(); 
  } catch (err) {
    console.error('Error connecting to the database:', err.stack);
  }
})();

module.exports = pool ;