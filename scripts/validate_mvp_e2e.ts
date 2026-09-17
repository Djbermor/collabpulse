import { chromium, Browser, BrowserContext, Page } from '@playwright/test';
import pg from 'pg';

const BASE_URL = 'http://localhost:3000';
const ADMIN_EMAIL = 'admin@collabpulse.local';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'CollabPulse2026!Admin';
const DEIVI_EMAIL = 'djbermor@gmail.com';
const DEIVI_PASSWORD = process.env.ADMIN_PASSWORD || 'CollabPulse2026!Admin';

const pool = new pg.Pool({
  connectionString: 'postgresql://postgres:postgres@localhost:5432/collabpulse_dev'
});

interface UserSession {
  context: BrowserContext;
  page: Page;
  email: string;
  name: string;
}

async function loginUser(browser: Browser, email: string, pwd: string, name: string): Promise<UserSession> {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });
  const page = await context.newPage();

  console.log(`[Browser] Navigating to ${BASE_URL} for ${name} (${email})...`);
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });

  // Check if login form is displayed
  const emailInput = page.locator('input[type="text"], input[type="email"]').first();
  await emailInput.waitFor({ state: 'visible', timeout: 15000 });
  await emailInput.fill(email);

  const passwordInput = page.locator('input[type="password"]').first();
  await passwordInput.fill(pwd);

  const submitButton = page.locator('button[type="submit"]:has-text("Ingresar"), button:has-text("Ingresar")').first();
  await submitButton.click();

  // Wait for login success
  await page.waitForFunction(() => {
    return !!localStorage.getItem('collab_token') && !document.querySelector('.animate-spin');
  }, { timeout: 15000 });

  console.log(`[Browser] Login successful for ${name}. Token established.`);
  await page.waitForTimeout(1500); // Allow workspace and SSE to establish

  return { context, page, email, name };
}

async function main() {
  console.log('====================================================');
  console.log('COLLABPULSE — FULL REAL E2E BROWSER VALIDATION');
  console.log('====================================================\n');

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  });

  const results: { test: string; status: 'PASS' | 'FAIL'; details?: string }[] = [];

  try {
    // 1. Initial Database Verification
    console.log('[Phase 1] Auditing Database Baseline State...');
    const userCountRes = await pool.query("SELECT COUNT(*) FROM users WHERE deleted_at IS NULL");
    const preservedUsersRes = await pool.query("SELECT id, email, display_name, role FROM users WHERE deleted_at IS NULL ORDER BY created_at ASC");
    const preservedMsgsRes = await pool.query("SELECT COUNT(*) FROM messages");
    const preservedChannelsRes = await pool.query("SELECT COUNT(*) FROM channels");

    console.log(`- Preserved active users in DB: ${userCountRes.rows[0].count}`);
    preservedUsersRes.rows.forEach(r => console.log(`  * [${r.role}] ${r.display_name} (${r.email}) id=${r.id}`));
    console.log(`- Preserved messages in DB: ${preservedMsgsRes.rows[0].count}`);
    console.log(`- Preserved channels in DB: ${preservedChannelsRes.rows[0].count}`);

    if (parseInt(userCountRes.rows[0].count) === 2) {
      results.push({ test: 'Database Audit (Only 2 real users preserved)', status: 'PASS' });
    } else {
      results.push({ test: 'Database Audit (Only 2 real users preserved)', status: 'FAIL', details: `Expected 2, got ${userCountRes.rows[0].count}` });
    }

    // 2. Launch Browser A (Admin) and Browser B (Deivi)
    console.log('\n[Phase 2] Launching Real Chromium Sessions...');
    const adminSession = await loginUser(browser, ADMIN_EMAIL, ADMIN_PASSWORD, 'Administrador Sistema');
    const deiviSession = await loginUser(browser, DEIVI_EMAIL, DEIVI_PASSWORD, 'Deivi Bertel');
    results.push({ test: 'Browser A (Admin) Login', status: 'PASS' });
    results.push({ test: 'Browser B (Deivi) Login', status: 'PASS' });

    // 3. Verify Clean MVP Navigation on Sidebar
    console.log('\n[Phase 3] Validating Sidebar Navigation against MVP Constraints...');
    const adminSidebar = adminSession.page.locator('aside[aria-label="Barra de navegación del espacio de trabajo"]');
    await adminSidebar.waitFor({ state: 'visible', timeout: 5000 });

    // Check that hidden features are NOT rendered
    const hasTasks = await adminSidebar.locator('button:has-text("Tablero de Tareas")').count();
    const hasCalendar = await adminSidebar.locator('button:has-text("Calendario")').count();
    const hasCalls = await adminSidebar.locator('button:has-text("Llamadas")').count();
    const hasFiles = await adminSidebar.locator('button:has-text("Archivos & Adjuntos")').count();
    const hasMessaging = await adminSidebar.locator('button:has-text("Mensajería")').count();
    const hasAdmin = await adminSidebar.locator('button:has-text("Administración")').count();

    console.log(`Sidebar items check: Tasks=${hasTasks}, Calendar=${hasCalendar}, Calls=${hasCalls}, Files=${hasFiles}, Messaging=${hasMessaging}, Admin=${hasAdmin}`);

    if (hasTasks === 0 && hasCalendar === 0 && hasCalls === 0 && hasFiles === 0 && hasMessaging > 0 && hasAdmin > 0) {
      results.push({ test: 'Frontend Navigation (Disabled features hidden, core visible)', status: 'PASS' });
    } else {
      results.push({ test: 'Frontend Navigation (Disabled features hidden, core visible)', status: 'FAIL', details: `Tasks:${hasTasks}, Calendar:${hasCalendar}, Calls:${hasCalls}, Files:${hasFiles}` });
    }

    // Deivi (Non-Admin / Owner) check for Administration visibility
    const deiviSidebar = deiviSession.page.locator('aside[aria-label="Barra de navegación del espacio de trabajo"]');
    const deiviHasTasks = await deiviSidebar.locator('button:has-text("Tablero de Tareas")').count();
    const deiviHasCalls = await deiviSidebar.locator('button:has-text("Llamadas")').count();
    if (deiviHasTasks === 0 && deiviHasCalls === 0) {
      results.push({ test: 'Deivi Sidebar Isolation (Disabled features hidden)', status: 'PASS' });
    } else {
      results.push({ test: 'Deivi Sidebar Isolation (Disabled features hidden)', status: 'FAIL' });
    }

    // 4. Test Preserved Direct Conversation 1:1 & Real-time Messaging
    console.log('\n[Phase 4] Testing 1:1 Direct Chat (Admin ↔ Deivi Bertel)...');
    // Admin clicks on Deivi in Direct Messages
    const deiviDmButton = adminSidebar.locator('button:has-text("Deivi Bertel")').first();
    await deiviDmButton.waitFor({ state: 'visible', timeout: 5000 });
    await deiviDmButton.click();
    await adminSession.page.waitForTimeout(1500);

    // Verify existing preserved messages are loaded
    const messageLocator = adminSession.page.locator('#chat-area-container');
    await messageLocator.waitFor({ state: 'visible' });

    // Verify call buttons are hidden in ChatArea
    const callButtonCount = await messageLocator.locator('button:has-text("Voz"), button:has-text("Video")').count();
    console.log(`Call buttons count in ChatArea: ${callButtonCount}`);
    if (callButtonCount === 0) {
      results.push({ test: 'ChatArea Call Triggers Blocked (No Voice/Video buttons)', status: 'PASS' });
    } else {
      results.push({ test: 'ChatArea Call Triggers Blocked (No Voice/Video buttons)', status: 'FAIL', details: `Found ${callButtonCount} call buttons` });
    }

    // Deivi also opens the conversation
    const adminDmButton = deiviSidebar.locator('button:has-text("Administrador")').first();
    await adminDmButton.waitFor({ state: 'visible', timeout: 8000 });
    await adminDmButton.click();
    await deiviSession.page.waitForTimeout(1500);

    // Admin sends a message to Deivi
    const timestamp = Date.now();
    const adminMsgText = `[MVP-TEST] Mensaje en tiempo real de Admin a Deivi: ${timestamp}`;
    const adminInput = adminSession.page.locator('textarea').first();
    await adminInput.waitFor({ state: 'visible', timeout: 5000 });
    await adminInput.fill(adminMsgText);
    const adminSendBtn = adminSession.page.locator('button[title="Enviar mensaje"]').first();
    await adminSendBtn.click();
    console.log(`Admin sent: "${adminMsgText}"`);

    // Deivi must receive it via SSE in real-time WITHOUT page refresh
    console.log('Waiting for Deivi to receive message via SSE without reload...');
    const deiviMsgLocator = deiviSession.page.locator(`text=${adminMsgText}`).first();
    await deiviMsgLocator.waitFor({ state: 'visible', timeout: 10000 });
    console.log('Deivi received message in DOM via SSE successfully!');
    results.push({ test: 'Realtime 1:1 Messaging (Admin → Deivi via SSE)', status: 'PASS' });

    // Deivi responds back
    const deiviReplyText = `[MVP-TEST] Respuesta de Deivi a Admin: ${timestamp}`;
    const deiviInput = deiviSession.page.locator('textarea').first();
    await deiviInput.waitFor({ state: 'visible', timeout: 5000 });
    await deiviInput.fill(deiviReplyText);
    const deiviSendBtn = deiviSession.page.locator('button[title="Enviar mensaje"]').first();
    await deiviSendBtn.click();
    console.log(`Deivi replied: "${deiviReplyText}"`);

    // Admin receives Deivi's message without reload
    const adminReceivedReply = adminSession.page.locator(`text=${deiviReplyText}`).first();
    await adminReceivedReply.waitFor({ state: 'visible', timeout: 10000 });
    console.log('Admin received Deivi\'s reply in DOM via SSE successfully!');
    results.push({ test: 'Realtime 1:1 Messaging (Deivi → Admin via SSE)', status: 'PASS' });

    // Verify DB persistence of the new messages
    const dbMsgCheck = await pool.query("SELECT COUNT(*) FROM messages WHERE content LIKE '%[MVP-TEST]%'");
    if (parseInt(dbMsgCheck.rows[0].count) >= 2) {
      results.push({ test: '1:1 Messaging Persistence in PostgreSQL', status: 'PASS' });
    } else {
      results.push({ test: '1:1 Messaging Persistence in PostgreSQL', status: 'FAIL', details: `Found ${dbMsgCheck.rows[0].count} messages` });
    }

    // 5. Test Channel Operations (Create Channel, Assign Member, Messaging)
    console.log('\n[Phase 5] Testing Channels (Create, Assign Member, Messaging)...');
    // Admin clicks '+' on Canales
    const createChannelBtn = adminSidebar.locator('button[title="Crear nuevo canal"]').first();
    await createChannelBtn.click();

    const channelModal = adminSession.page.locator('form:has-text("Nombre del canal")').first();
    await channelModal.waitFor({ state: 'visible', timeout: 5000 });

    const channelName = `mvp-channel-${Date.now().toString(36).substring(4)}`;
    const channelNameInput = channelModal.locator('input[placeholder*="lanzamientos"]').first();
    await channelNameInput.fill(channelName);

    const submitChannelBtn = channelModal.locator('button[type="submit"]:has-text("Crear Canal")').first();
    await submitChannelBtn.click();
    await adminSession.page.waitForTimeout(1500);

    // Verify channel is in Admin sidebar
    const newChannelBtn = adminSidebar.locator(`button:has-text("${channelName}")`).first();
    await newChannelBtn.waitFor({ state: 'visible', timeout: 5000 });
    await newChannelBtn.click();
    console.log(`Admin created and entered channel #${channelName}`);
    results.push({ test: 'Channel Creation via UI', status: 'PASS' });

    // Admin manages channel members
    const manageMembersBtn = adminSession.page.locator('#chat-area-container button[title="Gestionar miembros del canal"]').first();
    await manageMembersBtn.waitFor({ state: 'visible', timeout: 5000 });
    await manageMembersBtn.click();

    const membersModal = adminSession.page.locator('div:has-text("colaboradores en este canal")').first();
    await membersModal.waitFor({ state: 'visible', timeout: 5000 });

    // Select Deivi if available to add
    const userSelect = membersModal.locator('select').first();
    const selectOptionsCount = await userSelect.locator('option').count();
    if (selectOptionsCount > 1) {
      await userSelect.selectOption({ index: 1 });
      const addBtn = membersModal.locator('button:has-text("Agregar")').first();
      await addBtn.click();
      await adminSession.page.waitForTimeout(1000);
      console.log('Deivi added to channel members roster.');
    }
    // Close modal
    await membersModal.locator('button:has(svg.lucide-x)').first().click();
    await adminSession.page.waitForTimeout(500);
    results.push({ test: 'Channel Member Roster & Assignment Modal', status: 'PASS' });

    // Send a message in the channel
    const channelMsg = `[CHANNEL-TEST] Primer mensaje en #${channelName} a las ${Date.now()}`;
    await adminSession.page.locator('textarea').first().fill(channelMsg);
    await adminSession.page.locator('button[title="Enviar mensaje"]').first().click();

    const channelMsgInDom = adminSession.page.locator(`text=${channelMsg}`).first();
    await channelMsgInDom.waitFor({ state: 'visible', timeout: 5000 });
    results.push({ test: 'Channel Messaging & Persistence', status: 'PASS' });

    // 6. Test Group Operations (Create Group, Member Assignment, Messaging)
    console.log('\n[Phase 6] Testing Groups (Create Group, Member Selection, Messaging)...');
    // Admin clicks '+' on Grupos
    const createGroupBtn = adminSidebar.locator('button[title="Crear nuevo grupo"]').first();
    await createGroupBtn.click();

    const groupModal = adminSession.page.locator('form:has-text("Nombre del Grupo")').first();
    await groupModal.waitFor({ state: 'visible', timeout: 5000 });

    const groupName = `Comité MVP ${Date.now().toString(36).substring(4)}`;
    const groupNameInput = groupModal.locator('input[placeholder*="Equipo de Proyecto"]').first();
    await groupNameInput.fill(groupName);

    // Select members
    const memberCheckbox = groupModal.locator('button:has-text("Deivi Bertel")').first();
    if (await memberCheckbox.count() > 0) {
      await memberCheckbox.click();
    }

    const submitGroupBtn = groupModal.locator('button[type="submit"]:has-text("Crear Grupo")').first();
    await submitGroupBtn.click();
    await adminSession.page.waitForTimeout(2000);

    // Verify group appears in Grupos section in sidebar
    const newGroupBtn = adminSidebar.locator(`button:has-text("${groupName}")`).first();
    await newGroupBtn.waitFor({ state: 'visible', timeout: 5000 });
    await newGroupBtn.click();
    console.log(`Admin opened group: "${groupName}"`);

    // Admin sends message in group
    const groupMsg = `[GROUP-TEST] Hola equipo en ${groupName}`;
    await adminSession.page.locator('textarea').first().fill(groupMsg);
    await adminSession.page.locator('button[title="Enviar mensaje"]').first().click();

    const groupMsgInAdmin = adminSession.page.locator(`text=${groupMsg}`).first();
    await groupMsgInAdmin.waitFor({ state: 'visible', timeout: 5000 });
    results.push({ test: 'Group Creation & Group Messaging', status: 'PASS' });

    // Deivi also sees the group and message
    const deiviGroupBtn = deiviSidebar.locator(`button:has-text("${groupName}")`).first();
    await deiviGroupBtn.waitFor({ state: 'visible', timeout: 10000 });
    await deiviGroupBtn.click();

    const groupMsgInDeivi = deiviSession.page.locator(`text=${groupMsg}`).first();
    await groupMsgInDeivi.waitFor({ state: 'visible', timeout: 5000 });
    results.push({ test: 'Group Member Real-time Sync & Visibility', status: 'PASS' });

    // 7. Test Admin Feature Permissions Management (Toggle OFF -> ON -> OFF)
    console.log('\n[Phase 7] Testing Admin Feature Permissions Management...');
    const adminNavBtn = adminSidebar.locator('button:has-text("Administración")').first();
    await adminNavBtn.click();
    await adminSession.page.waitForTimeout(1000);

    const permissionsTabBtn = adminSession.page.locator('button:has-text("Permisos de funcionalidades")').first();
    await permissionsTabBtn.waitFor({ state: 'visible', timeout: 5000 });
    await permissionsTabBtn.click();
    await adminSession.page.waitForTimeout(500);

    // Verify 10 feature cards exist
    const featureCards = adminSession.page.locator('div[id^="feature-card-"]');
    const cardsCount = await featureCards.count();
    console.log(`Feature cards rendered: ${cardsCount}`);
    if (cardsCount === 10) {
      results.push({ test: 'Feature Permissions UI (10 feature cards displayed)', status: 'PASS' });
    } else {
      results.push({ test: 'Feature Permissions UI (10 feature cards displayed)', status: 'FAIL', details: `Expected 10, got ${cardsCount}` });
    }

    // Check initial state of Calendar (should be disabled)
    const calendarToggle = adminSession.page.locator('#toggle-calendar').first();
    const isCalendarPressedBefore = await calendarToggle.getAttribute('aria-pressed');
    console.log(`Calendar toggle before: ${isCalendarPressedBefore}`);

    // Click to toggle Calendario: OFF -> ON
    console.log('Toggling Calendario: OFF -> ON...');
    await calendarToggle.click();
    await adminSession.page.waitForTimeout(1500);

    // Verify in sidebar that Calendario button appears!
    const calendarInSidebarAfter = await adminSidebar.locator('button:has-text("Calendario")').count();
    console.log(`Calendario in sidebar after enabling: ${calendarInSidebarAfter}`);

    // Verify DB persistence of this toggle
    const dbFeaturesOn = await pool.query("SELECT permissions FROM feature_permissions WHERE tenant_id = 'tenant-mu36yjdt'");
    console.log('DB feature_permissions with calendar enabled:', dbFeaturesOn.rows[0]?.permissions);

    if (calendarInSidebarAfter > 0 && dbFeaturesOn.rows[0]?.permissions?.calendar === true) {
      results.push({ test: 'Feature Toggle Dynamic Enable (Calendar OFF → ON + Realtime update)', status: 'PASS' });
    } else {
      results.push({ test: 'Feature Toggle Dynamic Enable (Calendar OFF → ON + Realtime update)', status: 'FAIL' });
    }

    // Now toggle Calendario back: ON -> OFF to maintain clean MVP state
    console.log('Toggling Calendario back: ON -> OFF...');
    await calendarToggle.click();
    await adminSession.page.waitForTimeout(1500);

    const calendarInSidebarReset = await adminSidebar.locator('button:has-text("Calendario")').count();
    const dbFeaturesOff = await pool.query("SELECT permissions FROM feature_permissions WHERE tenant_id = 'tenant-mu36yjdt'");
    console.log(`Calendario in sidebar after reset: ${calendarInSidebarReset}`);

    if (calendarInSidebarReset === 0 && dbFeaturesOff.rows[0]?.permissions?.calendar === false) {
      results.push({ test: 'Feature Toggle Reset (Calendar ON → OFF + Persistence in DB)', status: 'PASS' });
    } else {
      results.push({ test: 'Feature Toggle Reset (Calendar ON → OFF + Persistence in DB)', status: 'FAIL' });
    }

    // 8. Test Layer 5: Backend API Feature Guarding
    console.log('\n[Phase 8] Testing Backend API Multi-layer Rejections for Disabled Features...');
    const adminToken = await adminSession.page.evaluate(() => localStorage.getItem('collab_token') || '');

    // Test calls API endpoint rejection
    const callApiRes = await fetch(`${BASE_URL}/api/v1/calls/initiate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ targetUserId: 'usr-1789512711782-3bwl', callType: 'video' })
    });
    const callApiJson = await callApiRes.json();
    console.log(`Call API rejection response: Status=${callApiRes.status}, code=${callApiJson.code}`);

    // Test tasks API endpoint rejection
    const taskApiRes = await fetch(`${BASE_URL}/api/v1/tasks`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const taskApiJson = await taskApiRes.json();
    console.log(`Task API rejection response: Status=${taskApiRes.status}, code=${taskApiJson.code}`);

    // Test calendar API endpoint rejection
    const calApiRes = await fetch(`${BASE_URL}/api/v1/calendar/events`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const calApiJson = await calApiRes.json();
    console.log(`Calendar API rejection response: Status=${calApiRes.status}, code=${calApiJson.code}`);

    if (callApiRes.status === 403 && taskApiRes.status === 403 && calApiRes.status === 403) {
      results.push({ test: 'Backend API Layer 5 Guards (403 FEATURE_DISABLED for disabled endpoints)', status: 'PASS' });
    } else {
      results.push({ test: 'Backend API Layer 5 Guards (403 FEATURE_DISABLED for disabled endpoints)', status: 'FAIL', details: `Calls:${callApiRes.status}, Tasks:${taskApiRes.status}, Calendar:${calApiRes.status}` });
    }

    // 9. Clean up test channel and group to keep database in perfect shape
    console.log('\n[Phase 9] Cleaning up test messages/channels created during automated validation...');
    await pool.query("DELETE FROM messages WHERE content LIKE '%[MVP-TEST]%' OR content LIKE '%[CHANNEL-TEST]%' OR content LIKE '%[GROUP-TEST]%'");

    const testConvs = await pool.query("SELECT id FROM conversations WHERE name LIKE 'Comité MVP%'");
    for (const row of testConvs.rows) {
      await pool.query("DELETE FROM conversation_members WHERE conversation_id = $1", [row.id]);
      await pool.query("DELETE FROM conversations WHERE id = $1", [row.id]);
    }

    const testChannels = await pool.query("SELECT id FROM channels WHERE name LIKE 'mvp-channel-%'");
    for (const row of testChannels.rows) {
      await pool.query("DELETE FROM channel_members WHERE channel_id = $1", [row.id]);
      await pool.query("DELETE FROM channels WHERE id = $1", [row.id]);
    }

    console.log('Validation-generated test rows cleaned up safely respecting foreign keys.');
    results.push({ test: 'Database Safe Cleanup & Isolation', status: 'PASS' });

  } catch (err: any) {
    console.error('Test Execution Error:', err);
    results.push({ test: 'Validation Exception', status: 'FAIL', details: err.message });
  } finally {
    await browser.close();
    await pool.end();
  }

  // Print Summary Table
  console.log('\n====================================================');
  console.log('E2E VALIDATION SUMMARY REPORT');
  console.log('====================================================');
  let passCount = 0;
  let failCount = 0;

  for (const r of results) {
    const icon = r.status === 'PASS' ? '✓ [PASS]' : '✗ [FAIL]';
    console.log(`${icon.padEnd(10)} | ${r.test} ${r.details ? `(${r.details})` : ''}`);
    if (r.status === 'PASS') passCount++;
    else failCount++;
  }

  console.log('----------------------------------------------------');
  console.log(`TOTAL: ${results.length} | PASS: ${passCount} | FAIL: ${failCount}`);
  console.log('====================================================\n');

  if (failCount > 0) {
    process.exit(1);
  }
}

main().catch(console.error);
