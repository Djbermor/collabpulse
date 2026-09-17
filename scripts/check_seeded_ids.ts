import { pool } from '../src/db/index';

async function check() {
  const res = await pool.query("SELECT id, email, display_name, tenant_id FROM users WHERE email IN ('admin@collabpulse.local', 'user.b@collabpulse.local', 'user.c@collabpulse.local', 'user.b1@isolated.local')");
  console.log(res.rows);
  await pool.end();
}
check();
