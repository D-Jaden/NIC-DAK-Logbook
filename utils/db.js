//=============================
//CONNECTING TO DB
//=============================

//====================================
//VARIABLE CONNECTING TO .ENV FILE
//====================================

require('@dotenvx/dotenvx').config();
const { Pool } = require('pg');
const logger = require('./logger');
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
    logger.info('Connected to the database successfully!');
    client.release(); 
  } catch (err) {
    logger.error(err, 'Error connecting to the database');
  }
})();

module.exports = pool ;