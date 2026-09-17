import dotenv from 'dotenv';
dotenv.config();
import { pool } from '../src/db/index';

async function run() {
  const chs = await pool.query(`SELECT * FROM channels WHERE workspace_id = 'ws-mu36yjdt'`);
  console.log('CHANNELS for ws-mu36yjdt:');
  console.table(chs.rows);

  const allChs = await pool.query(`SELECT id, name, workspace_id, tenant_id FROM channels`);
  console.log('ALL CHANNELS:');
  console.table(allChs.rows);

  await pool.end();
}

run().catch(console.error);
