import pg from 'pg';
import dotenv from 'dotenv';
import { hashPassword, normalizeEmail } from '../server/security';

dotenv.config();

async function main() {
  const pool = new pg.Pool({
    connectionString: 'postgresql://postgres:postgres@localhost:5432/collabpulse_dev'
  });

  const pwd = process.env.ADMIN_PASSWORD;
  if (!pwd) {
    throw new Error('ADMIN_PASSWORD not set in environment');
  }

  const email = 'analistalider.ctg@gestionsaludips.com';
  const firstName = 'Deivi Jose';
  const lastName = 'Bertel Morelo';
  const displayName = `${firstName} ${lastName}`;
  const jobTitle = 'Analista de sistema';
  const pwdHash = hashPassword(pwd);

  const res = await pool.query(
    `UPDATE users 
     SET email = $1,
         normalized_email = $2,
         first_name = $3,
         last_name = $4,
         display_name = $5,
         job_title = $6,
         password_hash = $7,
         updated_at = NOW()
     WHERE id = 'usr-admin-mu36yjdt' OR user_name = 'admin' OR email = 'admin@collabpulse.local'
     RETURNING id, email, display_name, job_title, role`,
    [email, normalizeEmail(email), firstName, lastName, displayName, jobTitle, pwdHash]
  );

  console.log('Administrator profile updated successfully in PostgreSQL:');
  console.log(res.rows[0]);

  await pool.end();
}

main().catch(console.error);
