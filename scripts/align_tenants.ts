import { pool } from '../src/db/index';

async function alignTenants() {
  console.log('[Align] Aligning all CollabPulse Tenant A users...');

  // Ensure tenant-collab-a and ws-collab-a exist
  await pool.query(`
    INSERT INTO tenants (id, name, slug, domain, plan, created_at, updated_at)
    VALUES ('tenant-collab-a', 'CollabPulse Tenant A', 'collab-a', 'collabpulse.local', 'Enterprise', NOW(), NOW())
    ON CONFLICT (id) DO NOTHING
  `);

  await pool.query(`
    INSERT INTO workspaces (id, name, slug, tenant_id, created_at, updated_at)
    VALUES ('ws-collab-a', 'Workspace A', 'workspace-a', 'tenant-collab-a', NOW(), NOW())
    ON CONFLICT (id) DO NOTHING
  `);

  // Update admin user to tenant-collab-a
  await pool.query(`
    UPDATE users 
    SET tenant_id = 'tenant-collab-a' 
    WHERE email = 'admin@collabpulse.local'
  `);

  // Update workspace members
  await pool.query(`
    INSERT INTO workspace_members (id, workspace_id, tenant_id, user_id, role, status, joined_at)
    VALUES ('wsm-admin-a', 'ws-collab-a', 'tenant-collab-a', 'usr-admin-mu36yjdt', 'Admin', 'Active', NOW())
    ON CONFLICT (id) DO UPDATE SET workspace_id = 'ws-collab-a', tenant_id = 'tenant-collab-a'
  `);

  // Also ensure default channels exist in ws-collab-a
  await pool.query(`
    INSERT INTO channels (id, tenant_id, workspace_id, name, type, created_by, created_at, updated_at)
    VALUES 
      ('ch-general-a', 'tenant-collab-a', 'ws-collab-a', 'general', 'Public', 'usr-admin-mu36yjdt', NOW(), NOW()),
      ('ch-random-a', 'tenant-collab-a', 'ws-collab-a', 'random', 'Public', 'usr-admin-mu36yjdt', NOW(), NOW())
    ON CONFLICT (id) DO NOTHING
  `);

  // Check
  const res = await pool.query(`
    SELECT id, email, tenant_id FROM users 
    WHERE email IN ('admin@collabpulse.local', 'user.b@collabpulse.local', 'user.c@collabpulse.local', 'user.b1@isolated.local')
  `);
  console.log('Aligned users:', res.rows);

  console.log('[Align] Completed.');
  process.exit(0);
}

alignTenants().catch(err => {
  console.error('Error aligning tenants:', err);
  process.exit(1);
});
