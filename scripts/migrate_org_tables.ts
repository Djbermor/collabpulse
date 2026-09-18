import { pool } from '../src/db/index.ts';

async function migrate() {
  console.log('Running DDL migrations for organizations and members...');

  await pool.query(`
    ALTER TABLE organizations ADD COLUMN IF NOT EXISTS created_by TEXT;
    ALTER TABLE organizations ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMP WITH TIME ZONE;
    ALTER TABLE organizations ADD COLUMN IF NOT EXISTS deactivated_by TEXT;
    ALTER TABLE organizations ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

    ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMP WITH TIME ZONE;
    ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS deactivated_by TEXT;
    ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS created_by TEXT;
    ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

    -- Ensure active healthcare organizations for >10 orgs scroll catalog
    UPDATE organizations 
    SET status = 'Active', is_active = true 
    WHERE id IN (
      'tenant-mu36yjdt',
      'org-mu5x6v61-a0dq',
      'org-mu5x6v7h-82n3',
      'org-mu5x6v8t-pr6f',
      'org-mu5x9fn2-4ts1',
      'org-mu5x9fo0-mrul',
      'org-mu5xalyn-bct5',
      'org-mu5xalzj-lmlx',
      'org-mu5xiow0-xcaw',
      'org-mu5xiowy-yz7z',
      'org-mu5yyrlv-ykso',
      'org-mu62kmzj-m4vg'
    );
  `);

  console.log('Migration completed successfully.');
  await pool.end();
}

migrate().catch(console.error);
