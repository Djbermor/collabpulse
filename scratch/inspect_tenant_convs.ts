import dotenv from 'dotenv';
dotenv.config();
import { pool } from '../src/db/index';

async function run() {
  const convs = await pool.query(`
    SELECT c.*, array_agg(u.display_name) as member_names
    FROM conversations c
    LEFT JOIN conversation_members cm ON c.id = cm.conversation_id
    LEFT JOIN users u ON cm.user_id = u.id
    WHERE c.tenant_id = 'tenant-mu36yjdt'
    GROUP BY c.id
  `);
  console.log('Conversations in tenant-mu36yjdt:');
  console.table(convs.rows);
  await pool.end();
}

run().catch(console.error);
