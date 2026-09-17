import dotenv from 'dotenv';
dotenv.config();
import { pool } from '../src/db/index';

async function run() {
  const cms = await pool.query(`
    SELECT cm.*, u.display_name, ch.name as channel_name
    FROM channel_members cm
    JOIN users u ON cm.user_id = u.id
    JOIN channels ch ON cm.channel_id = ch.id
    WHERE ch.workspace_id = 'ws-mu36yjdt'
  `);
  console.log('CHANNEL MEMBERS for ws-mu36yjdt:');
  console.table(cms.rows);

  const msgs = await pool.query(`
    SELECT m.id, m.content, m.created_at, u.display_name, ch.name as channel_name
    FROM messages m
    JOIN users u ON m.user_id = u.id
    JOIN channels ch ON m.channel_id = ch.id
    WHERE ch.workspace_id = 'ws-mu36yjdt'
  `);
  console.log(`CHANNEL MESSAGES in ws-mu36yjdt (${msgs.rowCount}):`);
  console.table(msgs.rows);

  await pool.end();
}

run().catch(console.error);
