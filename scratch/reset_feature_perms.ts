import { pool } from '../src/db/index.ts';
import { DEFAULT_MVP_FEATURES } from '../src/types/index.ts';

async function run() {
  await pool.query('UPDATE feature_permissions SET permissions = $1', [JSON.stringify(DEFAULT_MVP_FEATURES)]);
  console.log('Feature permissions updated to DEFAULT_MVP_FEATURES:', DEFAULT_MVP_FEATURES);
  await pool.end();
}

run().catch(console.error);
