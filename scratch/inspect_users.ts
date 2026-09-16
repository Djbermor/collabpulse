import { pool } from '../src/db/index';

async function listUsers() {
  const res = await pool.query('SELECT id, email, user_name, role, tenant_id FROM users WHERE deleted_at IS NULL');
  console.log('ACTIVE USERS:');
  res.rows.forEach(u => console.log(`- ID: ${u.id} | Email: ${u.email} | UserName: ${u.user_name} | Role: ${u.role} | Tenant: ${u.tenant_id}`));
  await pool.end();
}

listUsers().catch(console.error);
