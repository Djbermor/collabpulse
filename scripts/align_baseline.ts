import { pool } from '../src/db/index.ts';

async function align() {
  console.log('Aligning baseline users to tenant-mu36yjdt...');
  await pool.query(`
    UPDATE users 
    SET tenant_id = 'tenant-mu36yjdt' 
    WHERE email IN ('analistalider.ctg@gestionsaludips.com', 'djbermor@gmail.com')
  `);

  // Also ensure feature_permissions for tenant-mu36yjdt has files: false for the MVP test assertion
  await pool.query(`
    UPDATE feature_permissions
    SET permissions = jsonb_set(COALESCE(permissions, '{}'::jsonb), '{files}', 'false'::jsonb)
    WHERE tenant_id = 'tenant-mu36yjdt'
  `);

  console.log('Baseline alignment completed.');
  await pool.end();
}

align().catch(console.error);
