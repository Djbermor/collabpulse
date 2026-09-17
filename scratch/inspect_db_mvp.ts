import dotenv from 'dotenv';
dotenv.config();
import { pool } from '../src/db/index';

async function run() {
  console.log('=== USERS MATCHING ADMIN OR DEIVI ===');
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
  console.log(targetUsers.rows);

  console.log('\n=== ALL CONVERSATIONS WITH THEIR MEMBERS ===');
  const convs = await pool.query(`
    SELECT c.id, c.type, c.name, c.tenant_id, c.created_at,
           ARRAY_AGG(u.display_name || ' (' || u.id || ')') as members
    FROM conversations c
    LEFT JOIN conversation_members cm ON c.id = cm.conversation_id
    LEFT JOIN users u ON cm.user_id = u.id
    GROUP BY c.id, c.type, c.name, c.tenant_id, c.created_at
  `);
  console.log(convs.rows);

  console.log('\n=== CONVERSATIONS WITH MESSAGES ===');
  const msgConvs = await pool.query(`
    SELECT m.conversation_id, c.name, c.type, count(m.id) as message_count
    FROM messages m
    LEFT JOIN conversations c ON m.conversation_id = c.id
    GROUP BY m.conversation_id, c.name, c.type
  `);
  console.log(msgConvs.rows);

  console.log('\n=== SAMPLE MESSAGES BETWEEN ADMIN AND DEIVI IF ANY ===');
  const msgs = await pool.query(`
    SELECT m.id, m.conversation_id, m.sender_id, u.display_name as sender_name, m.content, m.created_at
    FROM messages m
    JOIN users u ON m.sender_id = u.id
    ORDER BY m.created_at DESC
    LIMIT 20
  `);
  console.log(msgs.rows);

  await pool.end();
}

run().catch(console.error);
