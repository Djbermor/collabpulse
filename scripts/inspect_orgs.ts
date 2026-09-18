import { pool } from '../src/db/index.ts';

async function main() {
  const tenants = await pool.query('SELECT id, name FROM tenants');
  console.log(`Tenants in DB: ${tenants.rows.length}`);
  tenants.rows.forEach(r => console.log(`  - Tenant: ${r.id} | ${r.name}`));

  const orgs = await pool.query('SELECT id, name, status FROM organizations');
  console.log(`Organizations in DB: ${orgs.rows.length}`);
  orgs.rows.forEach(r => console.log(`  - Org: ${r.id} | ${r.name} | status: ${r.status}`));

  await pool.end();
}

main().catch(console.error);
