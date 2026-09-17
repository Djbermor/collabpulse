import pg from 'pg';

async function main() {
  const p = new pg.Pool({ connectionString: 'postgresql://postgres:postgres@localhost:5432/collabpulse_dev' });
  const tables = ['organizations', 'organization_members', 'users', 'channels', 'channel_members', 'conversations', 'conversation_members', 'audit_logs', 'tenants', 'workspaces'];

  for (const t of tables) {
    const cols = await p.query(
      "SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position",
      [t]
    );
    console.log(`\n=== Table: ${t} ===`);
    cols.rows.forEach(c => {
      console.log(`  - ${c.column_name}: ${c.data_type} (null: ${c.is_nullable}, default: ${c.column_default})`);
    });

    const fks = await p.query(`
      SELECT
        tc.constraint_name, 
        kcu.column_name, 
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name 
      FROM information_schema.table_constraints AS tc 
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name = $1
    `, [t]);
    if (fks.rows.length > 0) {
      console.log(`  Foreign Keys:`);
      fks.rows.forEach(fk => {
        console.log(`    * ${fk.column_name} -> ${fk.foreign_table_name}(${fk.foreign_column_name})`);
      });
    }
  }

  await p.end();
}

main().catch(console.error);
