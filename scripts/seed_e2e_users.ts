import { pool } from '../src/db/index';
import { hashPassword } from '../server/security';

export async function seedE2ETestUsers() {
  console.log('[Seed] Ensuring multi-tenant test fixtures exist in database...');

  const passwordHash = hashPassword('CollabPulse2026!Admin');

  // 1. Tenant A & Organization A
  const tenantA = 'tenant-collab-a';
  const orgA = 'org-collab-a';
  const wsA = 'ws-collab-a';

  await pool.query(`
    INSERT INTO tenants (id, name, slug, domain, plan, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
    ON CONFLICT (id) DO NOTHING
  `, [tenantA, 'CollabPulse Tenant A', 'collab-a', 'collabpulse.local', 'Enterprise']);

  await pool.query(`
    INSERT INTO organizations (id, name, slug, primary_domain, created_at, updated_at)
    VALUES ($1, $2, $3, $4, NOW(), NOW())
    ON CONFLICT (id) DO NOTHING
  `, [orgA, 'CollabPulse Org A', 'collab-a', 'collabpulse.local']);

  await pool.query(`
    INSERT INTO workspaces (id, name, slug, tenant_id, created_at, updated_at)
    VALUES ($1, $2, $3, $4, NOW(), NOW())
    ON CONFLICT (id) DO NOTHING
  `, [wsA, 'Workspace A', 'workspace-a', tenantA]);

  // 2. Tenant B & Organization B (Isolated)
  const tenantB = 'tenant-isolated-b';
  const orgB = 'org-isolated-b';
  const wsB = 'ws-isolated-b';

  await pool.query(`
    INSERT INTO tenants (id, name, slug, domain, plan, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
    ON CONFLICT (id) DO NOTHING
  `, [tenantB, 'Isolated Tenant B', 'isolated-b', 'isolated.local', 'Enterprise']);

  await pool.query(`
    INSERT INTO organizations (id, name, slug, primary_domain, created_at, updated_at)
    VALUES ($1, $2, $3, $4, NOW(), NOW())
    ON CONFLICT (id) DO NOTHING
  `, [orgB, 'Isolated Org B', 'isolated-b', 'isolated.local']);

  await pool.query(`
    INSERT INTO workspaces (id, name, slug, tenant_id, created_at, updated_at)
    VALUES ($1, $2, $3, $4, NOW(), NOW())
    ON CONFLICT (id) DO NOTHING
  `, [wsB, 'Workspace B', 'workspace-b', tenantB]);

  // 3. Users in Tenant A
  const usersA = [
    {
      id: 'usr-admin-a1',
      email: 'admin@collabpulse.local',
      userName: 'admin',
      firstName: 'Admin',
      lastName: 'Primary',
      displayName: 'Admin User',
      role: 'Admin'
    },
    {
      id: 'usr-member-a2',
      email: 'user.b@collabpulse.local',
      userName: 'user_b',
      firstName: 'User',
      lastName: 'Bravo',
      displayName: 'User Bravo',
      role: 'Member'
    },
    {
      id: 'usr-member-a3',
      email: 'user.c@collabpulse.local',
      userName: 'user_c',
      firstName: 'User',
      lastName: 'Charlie',
      displayName: 'User Charlie',
      role: 'Member'
    }
  ];

  for (const u of usersA) {
    const existing = await pool.query('SELECT id FROM users WHERE email = $1 OR user_name = $2', [u.email, u.userName]);
    let realId = u.id;
    if (existing.rows.length > 0) {
      realId = existing.rows[0].id;
      await pool.query(`
        UPDATE users SET
          password_hash = $1,
          tenant_id = $2,
          role = $3,
          status = 'active',
          account_status = 'Active',
          is_active = true,
          failed_login_attempts = 0,
          lockout_until = NULL,
          updated_at = NOW()
        WHERE id = $4
      `, [passwordHash, tenantA, u.role, realId]);
    } else {
      await pool.query(`
        INSERT INTO users (
          id, email, normalized_email, user_name, normalized_user_name, password_hash,
          first_name, last_name, display_name, tenant_id, role, status, account_status,
          is_active, email_verified, created_at, updated_at
        ) VALUES ($1, $2, $2, $3, $3, $4, $5, $6, $7, $8, $9, 'active', 'Active', true, true, NOW(), NOW())
      `, [u.id, u.email, u.userName, passwordHash, u.firstName, u.lastName, u.displayName, tenantA, u.role]);
    }

    await pool.query(`
      INSERT INTO organization_members (id, organization_id, user_id, role, status, joined_at)
      VALUES ($1, $2, $3, $4, 'Active', NOW())
      ON CONFLICT (id) DO NOTHING
    `, [`mem-${realId}-${orgA}`, orgA, realId, u.role]);

    await pool.query(`
      INSERT INTO workspace_members (id, workspace_id, tenant_id, user_id, role, status, joined_at)
      VALUES ($1, $2, $3, $4, $5, 'Active', NOW())
      ON CONFLICT (id) DO NOTHING
    `, [`wsm-${realId}-${wsA}`, wsA, tenantA, realId, u.role]);
  }

  // 4. User in Tenant B (Cross-tenant)
  const userB1 = {
    id: 'usr-isolated-b1',
    email: 'user.b1@isolated.local',
    userName: 'user_b1',
    firstName: 'Isolated',
    lastName: 'User',
    displayName: 'Isolated User B1',
    role: 'Member'
  };

  const existingB1 = await pool.query('SELECT id FROM users WHERE email = $1 OR user_name = $2', [userB1.email, userB1.userName]);
  let realB1Id = userB1.id;
  if (existingB1.rows.length > 0) {
    realB1Id = existingB1.rows[0].id;
    await pool.query(`
      UPDATE users SET
        password_hash = $1,
        tenant_id = $2,
        role = $3,
        status = 'active',
        account_status = 'Active',
        is_active = true,
        failed_login_attempts = 0,
        lockout_until = NULL,
        updated_at = NOW()
      WHERE id = $4
    `, [passwordHash, tenantB, userB1.role, realB1Id]);
  } else {
    await pool.query(`
      INSERT INTO users (
        id, email, normalized_email, user_name, normalized_user_name, password_hash,
        first_name, last_name, display_name, tenant_id, role, status, account_status,
        is_active, email_verified, created_at, updated_at
      ) VALUES ($1, $2, $2, $3, $3, $4, $5, $6, $7, $8, $9, 'active', 'Active', true, true, NOW(), NOW())
    `, [userB1.id, userB1.email, userB1.userName, passwordHash, userB1.firstName, userB1.lastName, userB1.displayName, tenantB, userB1.role]);
  }

  await pool.query(`
    INSERT INTO organization_members (id, organization_id, user_id, role, status, joined_at)
    VALUES ($1, $2, $3, $4, 'Active', NOW())
    ON CONFLICT (id) DO NOTHING
  `, [`mem-${realB1Id}-${orgB}`, orgB, realB1Id, userB1.role]);

  await pool.query(`
    INSERT INTO workspace_members (id, workspace_id, tenant_id, user_id, role, status, joined_at)
    VALUES ($1, $2, $3, $4, $5, 'Active', NOW())
    ON CONFLICT (id) DO NOTHING
  `, [`wsm-${realB1Id}-${wsB}`, wsB, tenantB, realB1Id, userB1.role]);

  console.log('[Seed] Multi-tenant test users ready:');
  console.log('  Tenant A:', usersA.map(u => u.email).join(', '));
  console.log('  Tenant B:', userB1.email);
}

if (process.argv[1]?.endsWith('seed_e2e_users.ts')) {
  seedE2ETestUsers().then(() => {
    console.log('[Seed] Done.');
    process.exit(0);
  }).catch(err => {
    console.error('[Seed] Error:', err);
    process.exit(1);
  });
}
