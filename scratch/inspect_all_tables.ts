import dotenv from 'dotenv';
dotenv.config();
import { pool } from '../src/db/index';

async function run() {
  const tablesRes = await pool.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name
  `);
  console.log('TABLES IN DB:');
  for (const r of tablesRes.rows) {
    const count = await pool.query(`SELECT COUNT(*) FROM "${r.table_name}"`);
    console.log(`- ${r.table_name}: ${count.rows[0].count} rows`);
  }
  await pool.end();
}

run().catch(console.error);
