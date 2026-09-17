import dotenv from 'dotenv';
dotenv.config();
import { pool } from '../src/db/index';

async function run() {
  const ws = await pool.query(`SELECT * FROM workspaces WHERE tenant_id = 'tenant-mu36yjdt'`);
  console.log('WORKSPACES for tenant-mu36yjdt:');
  console.table(ws.rows);

  const org = await pool.query(`SELECT * FROM organizations WHERE tenant_id = 'tenant-mu36yjdt'`);
  console.log('ORGANIZATIONS for tenant-mu36yjdt:');
  console.table(org.rows);

  const chs = await pool.query(`SELECT * FROM channels WHERE tenant_id = 'tenant-mu36yjdt'`);
  console.log('CHANNELS for tenant-mu36yjdt:');
  console.table(chs.rows);

  const groups = await pool.query(`SELECT * FROM conversations WHERE tenant_id = 'tenant-mu36yjdt' AND type = 'Group'`);
  console.log('GROUPS for tenant-mu36yjdt:');
  console.table(groups.rows);

  await pool.end();
}

run().catch(console.error);
