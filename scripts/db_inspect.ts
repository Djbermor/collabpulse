import { pool } from '../src/db/index.ts';

async function main() {
  const tables = await pool.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
  );
  console.log('PostgreSQL Tables (' + tables.rows.length + '):');
  console.log(tables.rows.map(r => r.table_name));
  await pool.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
