import { pool } from '../src/db/index.ts';

async function run() {
  await pool.query("UPDATE channels SET topic = 'Bienvenida a Nexora' WHERE topic ILIKE '%CollabPulse%'");
  const r = await pool.query('SELECT name, topic FROM channels');
  console.log('Channels topic updated:', JSON.stringify(r.rows, null, 2));
  await pool.end();
}

run().catch(console.error);
