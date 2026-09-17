import dotenv from 'dotenv';
dotenv.config();
import { pool } from '../src/db/index';

async function run() {
  const chs = await pool.query(`SELECT * FROM channels WHERE workspace_id = 'ws-mu36yjdt' OR tenant_id = 'tenant-mu36yjdt'`);
  console.log('CHANNELS for ws-mu36yjdt:');
  console.table(chs.rows);

  const orgs = await pool.query(`SELECT * FROM organizations`);
  console.log('ALL ORGANIZATIONS:');
  console.table(orgs.rows);

  const orgMembers = await pool.query(`SELECT * FROM organization_members WHERE user_id IN ('usr-admin-mu36yjdt', 'usr-1789512711782-3bwl')`);
  console.log('ORG MEMBERS FOR ADMIN & DEIVI:');
  console.table(orgMembers.rows);

  const wsMembers = await pool.query(`SELECT * FROM workspace_members WHERE user_id IN ('usr-admin-mu36yjdt', 'usr-1789512711782-3bwl')`);
  console.log('WS MEMBERS FOR ADMIN & DEIVI:');
  console.table(wsMembers.rows);

  await pool.end();
}

run().catch(console.error);
