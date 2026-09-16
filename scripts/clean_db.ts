import { pool } from '../src/db/index.ts';
import { hashPassword } from '../server/security.ts';
import dotenv from 'dotenv';
dotenv.config();

async function cleanDatabase() {
  console.log('[CleanDB] Starting full database cleanup of all test/demo entities...');

  // 1. Delete all non-admin users and cascade references
  await pool.query("DELETE FROM user_sessions WHERE user_id NOT IN (SELECT id FROM users WHERE role = 'Owner')");
  await pool.query("DELETE FROM message_reactions");
  await pool.query("DELETE FROM pinned_messages");
  await pool.query("DELETE FROM saved_messages");
  await pool.query("DELETE FROM messages");
  await pool.query("DELETE FROM conversation_members");
  await pool.query("DELETE FROM conversations");
  await pool.query("DELETE FROM channel_members");
  await pool.query("DELETE FROM channels");
  try {
    await pool.query("DELETE FROM task_comments");
  } catch {}
  await pool.query("DELETE FROM tasks");
  await pool.query("DELETE FROM calendar_events");
  await pool.query("DELETE FROM meetings");
  await pool.query("DELETE FROM files");
  await pool.query("DELETE FROM workspace_members WHERE user_id NOT IN (SELECT id FROM users WHERE role = 'Owner')");
  await pool.query("DELETE FROM users WHERE role != 'Owner'");

  // 2. Refresh Administrator password to new secure credential
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) throw new Error('ADMIN_PASSWORD env var is required');
  const newHash = hashPassword(adminPassword);
  await pool.query("UPDATE users SET password_hash = $1, failed_login_attempts = 0, status = 'Offline' WHERE role = 'Owner'", [newHash]);

  // 3. Verify counts
  const usersRes = await pool.query("SELECT id, email, role FROM users");
  const wsRes = await pool.query("SELECT id, name FROM workspaces");
  const wmRes = await pool.query("SELECT id, user_id FROM workspace_members");
  const chRes = await pool.query("SELECT COUNT(*)::int as c FROM channels");
  const msgRes = await pool.query("SELECT COUNT(*)::int as c FROM messages");
  const taskRes = await pool.query("SELECT COUNT(*)::int as c FROM tasks");
  const evtRes = await pool.query("SELECT COUNT(*)::int as c FROM calendar_events");
  const convRes = await pool.query("SELECT COUNT(*)::int as c FROM conversations");

  console.log('[CleanDB] Cleanup Complete. Database State:');
  console.log({
    usersCount: usersRes.rows.length,
    users: usersRes.rows,
    workspacesCount: wsRes.rows.length,
    workspaceMembersCount: wmRes.rows.length,
    channelsCount: chRes.rows[0].c,
    messagesCount: msgRes.rows[0].c,
    tasksCount: taskRes.rows[0].c,
    eventsCount: evtRes.rows[0].c,
    conversationsCount: convRes.rows[0].c
  });

  await pool.end();
}

cleanDatabase().catch(err => {
  console.error('[CleanDB] Error during cleanup:', err);
  process.exit(1);
});
