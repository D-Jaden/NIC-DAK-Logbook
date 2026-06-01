const pool = require('./utils/db.js');
async function test() {
    const res = await pool.query('SELECT acquired_on_date, acquired_date FROM acquired LIMIT 5');
    console.log("Acquired:", res.rows);
    const res2 = await pool.query('SELECT despatch_date FROM despatch LIMIT 5');
    console.log("Despatch:", res2.rows);
    process.exit(0);
}
test();
