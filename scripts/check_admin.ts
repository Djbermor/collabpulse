import { pool } from '../src/db/index.ts';
import { verifyPassword, hashPassword } from '../server/security.ts';
import dotenv from 'dotenv';
dotenv.config();

async function checkAdmin() {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@collabpulse.local';
  const adminPassword = process.env.ADMIN_PASSWORD || '';
  
  const res = await pool.query('SELECT id, email, user_name, role, password_hash, failed_login_attempts FROM users WHERE email = $1', [adminEmail]);
  if (res.rows.length === 0) {
    console.log('No user found with email:', adminEmail);
    await pool.end();
    return;
  }
  
  const user = res.rows[0];
  console.log('User in DB:', {
    id: user.id,
    email: user.email,
    username: user.user_name,
    role: user.role,
    failedAttempts: user.failed_login_attempts
  });
  
  const matches = verifyPassword(adminPassword, user.password_hash);
  console.log('Password match result:', matches);

  // Also test API login
  const loginRes = await fetch('http://localhost:3000/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: adminEmail, password: adminPassword })
  });
  const loginData = await loginRes.json();
  console.log('API login response:', { status: loginRes.status, ok: loginRes.ok, loginData });

  await pool.end();
}

checkAdmin().catch(console.error);
