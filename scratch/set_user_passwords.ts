import { pool } from '../src/db/index';
import { hashPassword } from '../server/security';

async function setPasswords() {
  const hash = hashPassword('CollabPulse2026!Admin');
  await pool.query('UPDATE users SET password_hash = $1 WHERE email = $2', [hash, 'maria.santos@collabpulse.local']);
  console.log('Updated password for maria.santos@collabpulse.local');
  await pool.end();
}

setPasswords().catch(console.error);
