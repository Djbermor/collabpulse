import dotenv from 'dotenv';
dotenv.config();
import { pool } from '../src/db/index';

async function run() {
  console.log('=== TARGET USERS ===');
  const targetUsers = await pool.query(`
    SELECT id, email, user_name, display_name, role, tenant_id, created_at 
    FROM users 
    WHERE display_name ILIKE '%admin%' 
       OR display_name ILIKE '%deivi%' 
       OR email ILIKE '%admin%' 
       OR email ILIKE '%deivi%'
       OR user_name ILIKE '%deivi%'
       OR user_name ILIKE '%admin%'
  `);
  console.log(JSON.stringify(targetUsers.rows, null, 2));

  console.log('=== CONVERSATION conv-1789512870297 DETAILS ===');
  const conv = await pool.query('SELECT * FROM conversations WHERE id = $1', ['conv-1789512870297']);
  console.log('Conv:', conv.rows);

  const members = await pool.query(`
    SELECT cm.*, u.display_name, u.email, u.user_name
    FROM conversation_members cm
    JOIN users u ON cm.user_id = u.id
    WHERE cm.conversation_id = $1
  `, ['conv-1789512870297']);
  console.log('Members:', members.rows);

  console.log('=== MESSAGES TABLE COLUMNS ===');
  const msgCols = await pool.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'messages'
  `);
  console.log(msgCols.rows.map(r => r.column_name));

  const msgs = await pool.query(`
    SELECT * FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC
  `, ['conv-1789512870297']);
  console.log(`MESSAGES IN CONVERSATION (${msgs.rowCount}):`);
  for (const m of msgs.rows) {
    console.log(`[${m.created_at}] User(${m.user_id}): ${m.content}`);
  }

  await pool.end();
}

run().catch(console.error);
