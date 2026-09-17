import pg from 'pg';
import { hashPassword } from '../server/security';

async function main() {
  const pool = new pg.Pool({
    connectionString: 'postgresql://postgres:postgres@localhost:5432/collabpulse_dev'
  });

  const pwd = process.env.ADMIN_PASSWORD || 'CollabPulse2026!Admin';
  const hash = hashPassword(pwd);

  await pool.query('UPDATE users SET password_hash = $1 WHERE email = $2', [hash, 'djbermor@gmail.com']);
  console.log(`Updated password for djbermor@gmail.com to match ${pwd}`);
  await pool.end();
}

main().catch(console.error);
