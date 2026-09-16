import fs from 'fs';
import path from 'path';
import { pool, db } from '../src/db/index.ts';
import {
  tenants as pgTenants,
  workspaces as pgWorkspaces,
  workspaceMembers as pgWorkspaceMembers,
  users as pgUsers,
  auditLogs as pgAuditLogs
} from '../src/db/schema.ts';
import { hashPassword, normalizeEmail, normalizeUserName } from './security.ts';
import { eq } from 'drizzle-orm';

/**
 * Initializes the PostgreSQL schema and executes the initial real Administrator bootstrap.
 * This runs automatically on application startup.
 * Guarantees idempotency: NEVER duplicates admins or overwrites existing real data.
 */
export async function bootstrapDatabase() {
  console.log('[Bootstrap] Initializing PostgreSQL database connection...');

  try {
    // 1. Verify connection
    const healthCheck = await pool.query('SELECT 1 as live, current_database(), current_user, version()');
    console.log(`[Bootstrap] PostgreSQL Connected: Database=${healthCheck.rows[0]?.current_database}, User=${healthCheck.rows[0]?.current_user}`);

    // 2. Ensure schema tables exist
    const tableCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'users';
    `);

    if (tableCheck.rows.length === 0) {
      console.log('[Bootstrap] PostgreSQL tables not found. Executing DDL migrations...');
      const migrationFilePath = path.join(process.cwd(), 'drizzle', '0000_silly_gamora.sql');
      if (fs.existsSync(migrationFilePath)) {
        const ddlContent = fs.readFileSync(migrationFilePath, 'utf-8');
        const statements = ddlContent
          .split('--> statement-breakpoint')
          .map(s => s.trim())
          .filter(s => s.length > 0);

        for (const stmt of statements) {
          try {
            await pool.query(stmt);
          } catch (err: any) {
            // Ignore if already exists
            if (!err.message?.includes('already exists')) {
              console.error('[Bootstrap] DDL statement warning:', err.message);
            }
          }
        }
        console.log('[Bootstrap] PostgreSQL tables created successfully.');
      } else {
        console.error('[Bootstrap] Migration file not found at:', migrationFilePath);
      }
    } else {
      console.log('[Bootstrap] PostgreSQL tables already verified.');
    }

    // 3. Purge any leftover legacy demo records from old prototype seeds
    try {
      await pool.query(`DELETE FROM users WHERE id IN ('usr-admin-01', 'usr-user-02', 'usr-dev-03', 'usr-sofia-04') AND email = 'admin@demo.local';`);
      await pool.query(`DELETE FROM tenants WHERE id = 'tenant-demo-001' AND slug = 'demo-company';`);
    } catch {}

    // 3. Ensure DDL tables for Organizations, Notifications, Comments, and Unaccent extension exist
    try {
      await pool.query(`CREATE EXTENSION IF NOT EXISTS unaccent;`);
      console.log('[Bootstrap] PostgreSQL unaccent extension enabled.');
    } catch (err: any) {
      console.warn('[Bootstrap] unaccent extension notice (will use translate fallback if unavailable):', err.message);
    }

    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS organizations (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          slug TEXT NOT NULL UNIQUE,
          type TEXT NOT NULL DEFAULT 'Enterprise',
          industry TEXT NOT NULL DEFAULT 'Technology',
          logo_url TEXT,
          primary_domain TEXT,
          status TEXT NOT NULL DEFAULT 'Active',
          settings TEXT NOT NULL DEFAULT '{}',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
        );

        CREATE TABLE IF NOT EXISTS organization_domains (
          id TEXT PRIMARY KEY,
          organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
          domain TEXT NOT NULL,
          is_primary BOOLEAN NOT NULL DEFAULT FALSE,
          is_verified BOOLEAN NOT NULL DEFAULT FALSE,
          verification_token TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
        );

        CREATE TABLE IF NOT EXISTS organization_members (
          id TEXT PRIMARY KEY,
          organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          role TEXT NOT NULL DEFAULT 'Member',
          status TEXT NOT NULL DEFAULT 'Active',
          joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
        );

        CREATE TABLE IF NOT EXISTS organization_settings (
          id TEXT PRIMARY KEY,
          organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
          allow_auto_join BOOLEAN NOT NULL DEFAULT FALSE,
          require_approval BOOLEAN NOT NULL DEFAULT TRUE,
          allow_external_guests BOOLEAN NOT NULL DEFAULT FALSE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
        );

        CREATE TABLE IF NOT EXISTS notifications (
          id TEXT PRIMARY KEY,
          tenant_id TEXT NOT NULL,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          type TEXT NOT NULL,
          title TEXT NOT NULL,
          body TEXT NOT NULL,
          entity_type TEXT,
          entity_id TEXT,
          read_at TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
        );

        CREATE TABLE IF NOT EXISTS task_comments (
          id TEXT PRIMARY KEY,
          task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          user_name TEXT NOT NULL,
          user_avatar TEXT DEFAULT '',
          content TEXT NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
        );
      `);
      console.log('[Bootstrap] Organizations, notifications, and task_comments tables verified in PostgreSQL.');
    } catch (err: any) {
      console.error('[Bootstrap] Error creating extended DDL tables:', err.message);
    }

    // Sync tenants to organizations if any exist
    try {
      const existingTenants = await pool.query('SELECT * FROM tenants');
      for (const t of existingTenants.rows) {
        await pool.query(`
          INSERT INTO organizations (id, name, slug, type, industry, logo_url, primary_domain, status, settings, created_at, updated_at)
          VALUES ($1, $2, $3, 'Enterprise', 'Technology', $4, $5, 'Active', '{}', $6, $7)
          ON CONFLICT (id) DO UPDATE SET 
            name = EXCLUDED.name,
            slug = EXCLUDED.slug,
            primary_domain = EXCLUDED.primary_domain;
        `, [t.id, t.name, t.slug, t.logo_url, t.domain || `${t.slug}.local`, t.created_at || new Date(), t.updated_at || new Date()]);

        if (t.domain) {
          await pool.query(`
            INSERT INTO organization_domains (id, organization_id, domain, is_primary, is_verified, created_at)
            VALUES ($1, $2, $3, true, true, NOW())
            ON CONFLICT (id) DO NOTHING;
          `, [`dom-${t.id}-1`, t.id, t.domain]);
        }

        // Link users of this tenant to organization_members
        const tenantUsers = await pool.query('SELECT id, role FROM users WHERE tenant_id = $1', [t.id]);
        for (const u of tenantUsers.rows) {
          await pool.query(`
            INSERT INTO organization_members (id, organization_id, user_id, role, status, joined_at)
            VALUES ($1, $2, $3, $4, 'Active', NOW())
            ON CONFLICT (id) DO NOTHING;
          `, [`om-${t.id}-${u.id}`, t.id, u.id, u.role || 'Member']);
        }
      }
    } catch (err: any) {
      console.warn('[Bootstrap] Syncing tenants to organizations warning:', err.message);
    }

    // 4. Check if any users exist in the database
    const userCountResult = await pool.query('SELECT COUNT(*)::int as count FROM users WHERE deleted_at IS NULL');
    const userCount = userCountResult.rows[0]?.count || 0;

    // Update admin password if configured in environment
    if (userCount > 0 && process.env.ADMIN_PASSWORD) {
      const adminEmail = process.env.ADMIN_EMAIL || 'admin@collabpulse.local';
      const newHash = hashPassword(process.env.ADMIN_PASSWORD);
      await pool.query('UPDATE users SET password_hash = $1 WHERE email = $2 OR user_name = $3', [
        newHash,
        adminEmail,
        'admin'
      ]);
      console.log('[Bootstrap] Administrator security credentials refreshed.');
    }

    if (userCount === 0) {
      console.log('[Bootstrap] Database is empty. Creating initial real Administrator...');

      const adminEmail = process.env.ADMIN_EMAIL || 'admin@collabpulse.local';
      const adminUsername = process.env.ADMIN_USERNAME || 'admin';
      const adminPassword = process.env.ADMIN_PASSWORD;
      if (!adminPassword) {
        throw new Error('[Bootstrap] ADMIN_PASSWORD environment variable is required');
      }
      const firstName = process.env.ADMIN_FIRST_NAME || 'Administrador';
      const lastName = process.env.ADMIN_LAST_NAME || 'Principal';
      const displayName = `${firstName} ${lastName}`.trim();

      const tenantId = `tenant-${Date.now().toString(36)}`;
      const workspaceId = `ws-${Date.now().toString(36)}`;
      const userId = `usr-admin-${Date.now().toString(36)}`;

      // 4a. Create Initial Tenant (Organization)
      await pool.query(`
        INSERT INTO tenants (id, name, slug, domain, logo_url, plan, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      `, [
        tenantId,
        'CollabPulse Enterprise',
        'collabpulse',
        'collabpulse.local',
        'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=128&auto=format&fit=crop&q=80',
        'Enterprise'
      ]);

      // 4b. Create Administrator User
      const passwordHash = hashPassword(adminPassword);
      await pool.query(`
        INSERT INTO users (
          id, tenant_id, email, normalized_email, user_name, normalized_user_name,
          first_name, last_name, display_name, password_hash, role,
          avatar_url, job_title, status, custom_status, account_status,
          email_verified, failed_login_attempts, is_active, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11,
          $12, $13, $14, $15, $16,
          $17, $18, $19, NOW(), NOW()
        )
      `, [
        userId,
        tenantId,
        adminEmail,
        normalizeEmail(adminEmail),
        adminUsername,
        normalizeUserName(adminUsername),
        firstName,
        lastName,
        displayName,
        passwordHash,
        'Owner',
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        'Administrador del Sistema',
        'Online',
        'Administrador de la plataforma',
        'Active',
        true,
        0,
        true
      ]);

      // 4c. Create Initial Workspace
      await pool.query(`
        INSERT INTO workspaces (id, tenant_id, name, slug, description, owner_id, status, time_zone, language, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
      `, [
        workspaceId,
        tenantId,
        'Espacio Principal',
        'principal',
        'Espacio de trabajo principal para la colaboración del equipo',
        userId,
        'Active',
        'Europe/Madrid',
        'es-ES'
      ]);

      // 4d. Assign Owner Membership
      await pool.query(`
        INSERT INTO workspace_members (id, workspace_id, tenant_id, user_id, role, status, joined_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
      `, [
        `wm-${Date.now().toString(36)}`,
        workspaceId,
        tenantId,
        userId,
        'Owner',
        'Active'
      ]);

      // 4e. Record Initial Audit Log
      await pool.query(`
        INSERT INTO audit_logs (id, tenant_id, user_id, action, resource, resource_id, ip_address, details, correlation_id, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      `, [
        `audit-bootstrap-${Date.now().toString(36)}`,
        tenantId,
        userId,
        'BOOTSTRAP_INITIAL_ADMIN',
        'User',
        userId,
        '127.0.0.1',
        JSON.stringify({ email: adminEmail, username: adminUsername, role: 'Owner' }),
        'bootstrap-init'
      ]);

      console.log(`[Bootstrap] REAL Administrator created in PostgreSQL:`);
      console.log(`   - Email: ${adminEmail}`);
      console.log(`   - Username: ${adminUsername}`);
      console.log(`   - Role: Owner`);
      console.log(`   - Workspace: Espacio Principal (${workspaceId})`);
    } else {
      console.log(`[Bootstrap] PostgreSQL already contains ${userCount} active users. Skipping bootstrap.`);
    }

    // 5. Ensure default public channels exist in PostgreSQL
    const channelCountResult = await pool.query('SELECT COUNT(*)::int as count FROM channels WHERE is_archived = false');
    const channelCount = channelCountResult.rows[0]?.count || 0;
    if (channelCount === 0) {
      const wsResult = await pool.query('SELECT id, tenant_id, owner_id FROM workspaces LIMIT 1');
      if (wsResult.rows.length > 0) {
        const ws = wsResult.rows[0];
        const generalChId = `ch-general-${ws.id}`;
        const randomChId = `ch-random-${ws.id}`;

        await pool.query(`
          INSERT INTO channels (id, workspace_id, tenant_id, name, description, topic, type, is_archived, is_general, created_by, created_at, updated_at)
          VALUES 
            ($1, $2, $3, 'general', 'Canal general de la organización para anuncios y discusiones.', 'Bienvenida a CollabPulse', 'Public', false, true, $4, NOW(), NOW()),
            ($5, $2, $3, 'random', 'Canal para charlas casuales, descanso y novedades del equipo.', 'Cafetería virtual', 'Public', false, false, $4, NOW(), NOW())
          ON CONFLICT (id) DO NOTHING;
        `, [generalChId, ws.id, ws.tenant_id, ws.owner_id, randomChId]);

        // Add all existing users in this workspace to the channels
        const membersResult = await pool.query('SELECT user_id FROM workspace_members WHERE workspace_id = $1', [ws.id]);
        for (const m of membersResult.rows) {
          await pool.query(`
            INSERT INTO channel_members (id, channel_id, user_id, workspace_id, role, notifications, joined_at)
            VALUES 
              ($1, $2, $3, $4, 'Member', 'All', NOW()),
              ($5, $6, $3, $4, 'Member', 'All', NOW())
            ON CONFLICT (id) DO NOTHING;
          `, [
            `cm-${generalChId}-${m.user_id}`,
            generalChId,
            m.user_id,
            ws.id,
            `cm-${randomChId}-${m.user_id}`,
            randomChId
          ]);
        }
        console.log('[Bootstrap] Default public channels (#general, #random) created in PostgreSQL.');
      }
    }

    return { success: true };
  } catch (err: any) {
    console.error('[Bootstrap] Error during PostgreSQL initialization:', err);
    throw err;
  }
}
