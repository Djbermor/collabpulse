import dotenv from 'dotenv';
dotenv.config();
import { pool } from '../src/db/index';
import { DEFAULT_MVP_FEATURES } from '../src/types/index';

async function cleanup() {
  console.log('====================================================');
  console.log('--- COLLABPULSE MVP: PURGE & DATABASE CLEANUP ---');
  console.log('====================================================\n');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 0. Ensure feature_permissions table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS feature_permissions (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL UNIQUE,
        permissions JSONB NOT NULL,
        updated_by TEXT,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
      );
    `);

    // 1. Audit before cleanup
    const preUsers = await client.query('SELECT COUNT(*)::int as count FROM users');
    const preConvs = await client.query('SELECT COUNT(*)::int as count FROM conversations');
    const preMsgs = await client.query('SELECT COUNT(*)::int as count FROM messages');
    const preChannels = await client.query('SELECT COUNT(*)::int as count FROM channels');
    const preCalls = await client.query('SELECT COUNT(*)::int as count FROM calls');
    const preGroupCalls = await client.query('SELECT COUNT(*)::int as count FROM group_calls');
    const preTasks = await client.query('SELECT COUNT(*)::int as count FROM tasks');
    const preEvents = await client.query('SELECT COUNT(*)::int as count FROM calendar_events');
    const preFiles = await client.query('SELECT COUNT(*)::int as count FROM files');

    console.log('PRE-CLEANUP COUNTS:');
    console.log(`- Users: ${preUsers.rows[0].count}`);
    console.log(`- Conversations: ${preConvs.rows[0].count}`);
    console.log(`- Messages: ${preMsgs.rows[0].count}`);
    console.log(`- Channels: ${preChannels.rows[0].count}`);
    console.log(`- Calls: ${preCalls.rows[0].count}`);
    console.log(`- Group Calls: ${preGroupCalls.rows[0].count}`);
    console.log(`- Tasks: ${preTasks.rows[0].count}`);
    console.log(`- Calendar Events: ${preEvents.rows[0].count}`);
    console.log(`- Files: ${preFiles.rows[0].count}`);

    const KEEP_USER_IDS = ['usr-admin-mu36yjdt', 'usr-1789512711782-3bwl'];
    const KEEP_CONV_ID = 'conv-1789512870297';
    const KEEP_WS_ID = 'ws-mu36yjdt';
    const KEEP_TENANT_ID = 'tenant-mu36yjdt';
    const KEEP_CHANNEL_IDS = ['ch-general-ws-mu36yjdt', 'ch-random-ws-mu36yjdt'];

    // Verify preserved users exist
    const checkUsers = await client.query(
      'SELECT id, display_name, email FROM users WHERE id = ANY($1::text[])',
      [KEEP_USER_IDS]
    );
    if (checkUsers.rowCount !== 2) {
      throw new Error(`CRITICAL: Expected 2 users to preserve, but found ${checkUsers.rowCount}. Aborting cleanup.`);
    }
    console.log('\nPRESERVED USERS CONFIRMED:');
    console.table(checkUsers.rows);

    // Verify preserved conversation exists
    const checkConv = await client.query(
      'SELECT id, type, tenant_id FROM conversations WHERE id = $1',
      [KEEP_CONV_ID]
    );
    if (checkConv.rowCount !== 1) {
      throw new Error(`CRITICAL: Preserved conversation ${KEEP_CONV_ID} not found. Aborting.`);
    }
    const checkConvMsgs = await client.query(
      'SELECT COUNT(*)::int as count FROM messages WHERE conversation_id = $1',
      [KEEP_CONV_ID]
    );
    console.log(`\nPRESERVED CONVERSATION CONFIRMED: ${KEEP_CONV_ID} (${checkConvMsgs.rows[0].count} messages)`);

    // 2. Clean mock data for disabled features
    // Tasks & Task Comments
    const delTaskComments = await client.query('DELETE FROM task_comments');
    const delTasks = await client.query('DELETE FROM tasks');
    console.log(`- Deleted task comments: ${delTaskComments.rowCount}, tasks: ${delTasks.rowCount}`);

    // Calendar Events
    const delEvents = await client.query('DELETE FROM calendar_events');
    console.log(`- Deleted calendar events: ${delEvents.rowCount}`);

    // Calls & Group Calls (History, Participants, Events)
    const delGroupCallEvents = await client.query('DELETE FROM group_call_events');
    const delGroupCallParticipants = await client.query('DELETE FROM group_call_participants');
    const delGroupCalls = await client.query('DELETE FROM group_calls');
    const delCallHistory = await client.query('DELETE FROM call_history');
    const delCallParticipants = await client.query('DELETE FROM call_participants');
    const delCalls = await client.query('DELETE FROM calls');
    console.log(`- Deleted call records: ${delCalls.rowCount} calls, ${delCallParticipants.rowCount} participants, ${delCallHistory.rowCount} history, ${delGroupCalls.rowCount} group calls, ${delGroupCallParticipants.rowCount} group participants, ${delGroupCallEvents.rowCount} group events`);

    // Meetings
    const delMeetings = await client.query('DELETE FROM meetings');
    console.log(`- Deleted meetings: ${delMeetings.rowCount}`);

    // Files & Attachments
    const delFiles = await client.query('DELETE FROM files');
    const delAttachments = await client.query('DELETE FROM message_attachments');
    console.log(`- Deleted files: ${delFiles.rowCount}, attachments: ${delAttachments.rowCount}`);

    // Notifications
    const delNotifs = await client.query('DELETE FROM notifications');
    console.log(`- Deleted notifications: ${delNotifs.rowCount}`);

    // Message Receipts / Reactions not belonging to preserved conversation or preserved channels
    await client.query(`
      DELETE FROM message_reactions 
      WHERE message_id NOT IN (
        SELECT id FROM messages 
        WHERE conversation_id = $1 OR channel_id = ANY($2::text[])
      )
    `, [KEEP_CONV_ID, KEEP_CHANNEL_IDS]);

    await client.query(`
      DELETE FROM message_reads 
      WHERE message_id NOT IN (
        SELECT id FROM messages 
        WHERE conversation_id = $1 OR channel_id = ANY($2::text[])
      )
    `, [KEEP_CONV_ID, KEEP_CHANNEL_IDS]);

    await client.query(`
      DELETE FROM message_deliveries 
      WHERE message_id NOT IN (
        SELECT id FROM messages 
        WHERE conversation_id = $1 OR channel_id = ANY($2::text[])
      )
    `, [KEEP_CONV_ID, KEEP_CHANNEL_IDS]);

    await client.query('DELETE FROM pinned_messages');
    await client.query('DELETE FROM saved_messages');

    // Messages
    const delMsgs = await client.query(`
      DELETE FROM messages 
      WHERE (conversation_id IS NULL OR conversation_id != $1)
        AND (channel_id IS NULL OR channel_id != ALL($2::text[]))
    `, [KEEP_CONV_ID, KEEP_CHANNEL_IDS]);
    console.log(`- Deleted test messages: ${delMsgs.rowCount}`);

    // Conversations & Conversation Members
    const delConvMembers = await client.query('DELETE FROM conversation_members WHERE conversation_id != $1', [KEEP_CONV_ID]);
    const delConvs = await client.query('DELETE FROM conversations WHERE id != $1', [KEEP_CONV_ID]);
    console.log(`- Deleted test conversations: ${delConvs.rowCount}, members: ${delConvMembers.rowCount}`);

    // Channels & Channel Members
    const delChanMembers = await client.query('DELETE FROM channel_members WHERE channel_id != ALL($1::text[])', [KEEP_CHANNEL_IDS]);
    const delChans = await client.query('DELETE FROM channels WHERE id != ALL($1::text[])', [KEEP_CHANNEL_IDS]);
    console.log(`- Deleted test channels: ${delChans.rowCount}, channel members: ${delChanMembers.rowCount}`);

    // Workspace members & workspaces
    await client.query('DELETE FROM workspace_invitations');
    const delWsMembers = await client.query(`
      DELETE FROM workspace_members 
      WHERE user_id != ALL($1::text[]) OR workspace_id != $2
    `, [KEEP_USER_IDS, KEEP_WS_ID]);
    const delWs = await client.query('DELETE FROM workspaces WHERE id != $1', [KEEP_WS_ID]);
    console.log(`- Deleted test workspaces: ${delWs.rowCount}, workspace members: ${delWsMembers.rowCount}`);

    // Organization members, domains, settings, organizations
    const delOrgMembers = await client.query(`
      DELETE FROM organization_members 
      WHERE user_id != ALL($1::text[]) OR organization_id != $2
    `, [KEEP_USER_IDS, KEEP_TENANT_ID]);
    await client.query('DELETE FROM organization_domains WHERE organization_id != $1', [KEEP_TENANT_ID]);
    await client.query('DELETE FROM organization_settings WHERE organization_id != $1', [KEEP_TENANT_ID]);
    const delOrgs = await client.query('DELETE FROM organizations WHERE id != $1', [KEEP_TENANT_ID]);
    console.log(`- Deleted test organizations: ${delOrgs.rowCount}, organization members: ${delOrgMembers.rowCount}`);

    // User sessions & audit logs
    const delSessions = await client.query(`
      DELETE FROM user_sessions 
      WHERE tenant_id != $1 OR user_id != ALL($2::text[])
    `, [KEEP_TENANT_ID, KEEP_USER_IDS]);
    const delAudit = await client.query(`
      DELETE FROM audit_logs 
      WHERE tenant_id != $1 OR user_id != ALL($2::text[])
    `, [KEEP_TENANT_ID, KEEP_USER_IDS]);
    await client.query('DELETE FROM email_verification_tokens');
    await client.query('DELETE FROM password_reset_tokens');
    console.log(`- Deleted test sessions: ${delSessions.rowCount}, test audit logs: ${delAudit.rowCount}`);

    // Users
    const delUsers = await client.query('DELETE FROM users WHERE id != ALL($1::text[])', [KEEP_USER_IDS]);
    console.log(`- Deleted test users: ${delUsers.rowCount}`);

    // Tenants
    const delTenants = await client.query('DELETE FROM tenants WHERE id != $1', [KEEP_TENANT_ID]);
    console.log(`- Deleted test tenants: ${delTenants.rowCount}`);

    // 3. Seed / Ensure Feature Permissions for KEEP_TENANT_ID
    await client.query(`
      INSERT INTO feature_permissions (id, tenant_id, permissions, updated_by, updated_at)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (tenant_id) DO UPDATE 
      SET permissions = EXCLUDED.permissions,
          updated_at = NOW();
    `, [
      `fp-${KEEP_TENANT_ID}`,
      KEEP_TENANT_ID,
      JSON.stringify(DEFAULT_MVP_FEATURES),
      'usr-admin-mu36yjdt'
    ]);
    console.log(`\nFEATURE PERMISSIONS CONFIGURED FOR ${KEEP_TENANT_ID}:`);
    console.log(JSON.stringify(DEFAULT_MVP_FEATURES, null, 2));

    await client.query('COMMIT');
    console.log('\nTRANSACTION COMMITTED SUCCESSFULLY!');

    // 4. Verification queries
    console.log('\n====================================================');
    console.log('--- POST-CLEANUP VERIFICATION (FINAL DATABASE STATS) ---');
    console.log('====================================================');

    const postUsers = await client.query('SELECT id, email, user_name, display_name, role, tenant_id FROM users');
    console.log(`\nUsuarios reales conservados: ${postUsers.rowCount}`);
    console.table(postUsers.rows);

    const postConvs = await client.query('SELECT id, type, name, tenant_id FROM conversations');
    console.log(`\nConversaciones conservadas: ${postConvs.rowCount}`);
    console.table(postConvs.rows);

    const postMsgs = await client.query('SELECT conversation_id, channel_id, count(id) FROM messages GROUP BY conversation_id, channel_id');
    console.log('\nMensajes conservados por destino:');
    console.table(postMsgs.rows);

    const totalMsgs = await client.query('SELECT COUNT(*)::int as count FROM messages');
    console.log(`Total mensajes conservados: ${totalMsgs.rows[0].count}`);

    const postChannels = await client.query('SELECT id, name, type, workspace_id FROM channels');
    console.log(`\nCanales conservados: ${postChannels.rowCount}`);
    console.table(postChannels.rows);

    const postGroups = await client.query("SELECT id, name, type FROM conversations WHERE type = 'Group'");
    console.log(`\nGrupos conservados: ${postGroups.rowCount}`);

    const postFp = await client.query('SELECT * FROM feature_permissions');
    console.log('\nPermisos de funcionalidades en DB:');
    console.log(postFp.rows);

    console.log('\n--- LIMPIEZA FINALIZADA CON ÉXITO ---');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('ERROR DURING CLEANUP (ROLLED BACK):', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

cleanup().catch(err => {
  console.error(err);
  process.exit(1);
});
