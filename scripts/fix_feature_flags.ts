import { pool } from '../src/db/index';

async function main() {
  const res = await pool.query(
    "UPDATE feature_permissions SET permissions = jsonb_set(permissions, '{files}', 'false'::jsonb)"
  );
  console.log('Updated feature_permissions rows:', res.rowCount);
  const rows = await pool.query("SELECT * FROM feature_permissions");
  console.log('Current feature_permissions:', rows.rows);
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
