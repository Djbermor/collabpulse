import { pool } from '../src/db/index.ts';

export async function migratePhase3() {
  console.log('[MigratePhase3] Running additive DDL for Organizations and Organization Members...');
  await pool.query(`
    -- Add columns to organizations
    ALTER TABLE organizations ADD COLUMN IF NOT EXISTS created_by TEXT;
    ALTER TABLE organizations ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMP WITH TIME ZONE;
    ALTER TABLE organizations ADD COLUMN IF NOT EXISTS deactivated_by TEXT;

    -- Add columns to organization_members
    ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS created_by TEXT;
    ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMP WITH TIME ZONE;
    ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS deactivated_by TEXT;

    -- Ensure unique active membership
    CREATE UNIQUE INDEX IF NOT EXISTS idx_org_members_active_unique ON organization_members(organization_id, user_id) 
    WHERE status = 'Active' OR status = 'ACTIVE';

    CREATE INDEX IF NOT EXISTS idx_org_members_user_id ON organization_members(user_id);
    CREATE INDEX IF NOT EXISTS idx_org_members_org_id ON organization_members(organization_id);
    CREATE INDEX IF NOT EXISTS idx_organizations_status ON organizations(status);
  `);

  // Ensure default organization is active and named for Nexora enterprise
  await pool.query(`
    UPDATE organizations 
    SET status = 'ACTIVE' 
    WHERE id = 'tenant-mu36yjdt' AND (status = 'Active' OR status = 'ACTIVE');
  `);

  console.log('[MigratePhase3] Additive DDL completed successfully.');
}

if (import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/')) || process.argv[1].endsWith('migrate_phase_3.ts')) {
  migratePhase3().then(() => pool.end()).catch(err => {
    console.error('[MigratePhase3] Error:', err);
    process.exit(1);
  });
}
