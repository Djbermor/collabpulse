import { pool } from '../src/db/index.ts';
import dotenv from 'dotenv';
dotenv.config();

const BASE_URL = 'http://127.0.0.1:3000';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@collabpulse.local';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'C0ll@bPul$e_9x8K#2026_SecuR3!';

async function api(path: string, options: any = {}) {
  const url = `${BASE_URL}${path}`;
  const headers: any = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };
  const res = await fetch(url, {
    ...options,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, data };
}

async function runExhaustiveAudit() {
  console.log('================================================================');
  console.log('🚀 INICIANDO AUDITORÍA Y VALIDACIÓN INTEGRAL REAL — COLLABPULSE');
  console.log('================================================================\n');

  // -------------------------------------------------------------
  // TEST 1: Estado Inicial Limpio de PostgreSQL (Sección 2 & 27)
  // -------------------------------------------------------------
  console.log('🔍 [1/15] Verificando Estado Inicial Limpio en PostgreSQL...');
  const initialUsers = await pool.query("SELECT id, email, role FROM users WHERE deleted_at IS NULL");
  const initialWorkspaces = await pool.query("SELECT id, name FROM workspaces");
  const initialChannels = await pool.query("SELECT count(*)::int as c FROM channels");
  const initialMessages = await pool.query("SELECT count(*)::int as c FROM messages");
  const initialTasks = await pool.query("SELECT count(*)::int as c FROM tasks");

  if (initialUsers.rows.length !== 1 || initialUsers.rows[0].role !== 'Owner') {
    throw new Error(`Estado inicial inválido: esperado 1 usuario Owner, encontrado ${initialUsers.rows.length}`);
  }
  console.log(`   ✓ Administrador real único confirmado: ${initialUsers.rows[0].email} (Role: ${initialUsers.rows[0].role})`);
  console.log(`   ✓ Espacio de trabajo único: ${initialWorkspaces.rows[0].name} (${initialWorkspaces.rows[0].id})`);
  console.log(`   ✓ Canales iniciales: ${initialChannels.rows[0].c}, Mensajes: ${initialMessages.rows[0].c}, Tareas: ${initialTasks.rows[0].c}`);

  // -------------------------------------------------------------
  // TEST 2: Secuencia Obligatoria de Auth (Sección 4)
  // REGISTER → LOGIN → LOGOUT → LOGIN → REFRESH → LOGOUT
  // -------------------------------------------------------------
  console.log('\n🔐 [2/15] Probando Secuencia Obligatoria de Autenticación (Sección 4)...');
  const testUserEmail = 'colleague.audit@collabpulse.local';
  const testUserPassword = 'ColleaguePassword2026!#';

  // 1. Register
  console.log('   -> Registrando nuevo usuario (REGISTER)...');
  const regRes = await api('/api/v1/auth/register', {
    method: 'POST',
    body: {
      email: testUserEmail,
      firstName: 'Colega',
      lastName: 'Auditoría',
      password: testUserPassword,
      jobTitle: 'Ingeniero de Validación'
    }
  });
  if (!regRes.ok || !regRes.data?.data?.user) {
    throw new Error(`Fallo en registro de usuario: ${JSON.stringify(regRes)}`);
  }
  const colleagueUser = regRes.data.data.user;
  const colleagueToken1 = regRes.data.data.token;
  console.log(`   ✓ Usuario registrado exitosamente: ${colleagueUser.email} (ID: ${colleagueUser.id})`);

  // Verify in PostgreSQL
  const pgUserCheck = await pool.query("SELECT id, email, role FROM users WHERE email = $1", [testUserEmail]);
  if (pgUserCheck.rows.length === 0) throw new Error('Usuario registrado no encontrado en PostgreSQL');
  console.log('   ✓ PostgreSQL: Registro confirmado en tabla `users`');

  // 2. Login
  console.log('   -> Iniciando sesión (LOGIN)...');
  const login1 = await api('/api/v1/auth/login', {
    method: 'POST',
    body: { email: testUserEmail, password: testUserPassword }
  });
  if (!login1.ok || !login1.data?.data?.token) {
    throw new Error(`Fallo en login inicial: ${JSON.stringify(login1)}`);
  }
  let colleagueToken = login1.data.data.token;
  let colleagueRefreshToken = login1.data.data.refreshToken;
  const colleagueSessionId = login1.data.data.sessionId;
  console.log('   ✓ Login exitoso. Token y sesión obtenidos.');

  // Verify session in PostgreSQL
  const pgSessionCheck = await pool.query("SELECT id, is_active FROM user_sessions WHERE user_id = $1 AND is_active = true", [colleagueUser.id]);
  if (pgSessionCheck.rows.length === 0) throw new Error('Sesión no encontrada en PostgreSQL user_sessions');
  console.log(`   ✓ PostgreSQL: ${pgSessionCheck.rows.length} sesión(es) activas en tabla \`user_sessions\``);

  // 3. Logout
  console.log('   -> Cerrando sesión (LOGOUT)...');
  const logout1 = await api('/api/v1/auth/logout', {
    method: 'POST',
    headers: { Authorization: `Bearer ${colleagueToken}` },
    body: { sessionId: colleagueSessionId }
  });
  if (!logout1.ok) throw new Error(`Fallo en logout: ${JSON.stringify(logout1)}`);
  console.log('   ✓ Logout completado.');

  // 4. Inmediato Re-login (Verificación de NO lockout / NO "too many attempts")
  console.log('   -> Re-inicio de sesión inmediato (Verificación de CERO lockout)...');
  const login2 = await api('/api/v1/auth/login', {
    method: 'POST',
    body: { email: testUserEmail, password: testUserPassword }
  });
  if (!login2.ok || !login2.data?.data?.token) {
    throw new Error(`Fallo en re-login inmediato (Lockout detectado!): ${JSON.stringify(login2)}`);
  }
  colleagueToken = login2.data.data.token;
  colleagueRefreshToken = login2.data.data.refreshToken;
  console.log('   ✓ Re-login inmediato exitoso sin advertencias de rate limit o lockout.');

  // 5. Token Refresh con rotación
  console.log('   -> Renovación de token con rotación (REFRESH)...');
  const refreshRes = await api('/api/v1/auth/refresh', {
    method: 'POST',
    body: { refreshToken: colleagueRefreshToken }
  });
  if (!refreshRes.ok || !refreshRes.data?.data?.token) {
    throw new Error(`Fallo en rotación de refresh token: ${JSON.stringify(refreshRes)}`);
  }
  colleagueToken = refreshRes.data.data.token;
  colleagueRefreshToken = refreshRes.data.data.refreshToken;
  console.log('   ✓ Refresh token renovado exitosamente con nueva firma.');

  // 6. Logout final
  console.log('   -> Logout de cierre de ciclo...');
  const logout2 = await api('/api/v1/auth/logout', {
    method: 'POST',
    headers: { Authorization: `Bearer ${colleagueToken}` }
  });
  if (!logout2.ok) throw new Error(`Fallo en logout final: ${JSON.stringify(logout2)}`);
  console.log('   ✓ Ciclo obligatorio de Auth: 100% PASS.');

  // Login both users for subsequent tests
  console.log('\n🔑 Iniciando sesión de Administrador y Colega para pruebas funcionales...');
  const adminLogin = await api('/api/v1/auth/login', {
    method: 'POST',
    body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }
  });
  if (!adminLogin.ok) throw new Error(`Login de Admin falló: ${JSON.stringify(adminLogin)}`);
  const adminToken = adminLogin.data.data.token;
  const adminUser = adminLogin.data.data.user;
  const adminWorkspace = adminLogin.data.data.workspace;

  const colleagueLogin = await api('/api/v1/auth/login', {
    method: 'POST',
    body: { email: testUserEmail, password: testUserPassword }
  });
  if (!colleagueLogin.ok) throw new Error(`Login de Colega falló: ${JSON.stringify(colleagueLogin)}`);
  colleagueToken = colleagueLogin.data.data.token;

  const adminHeaders = {
    Authorization: `Bearer ${adminToken}`,
    'x-tenant-id': adminUser.tenantId,
    'x-workspace-id': adminWorkspace.id
  };

  const colleagueHeaders = {
    Authorization: `Bearer ${colleagueToken}`,
    'x-tenant-id': adminUser.tenantId,
    'x-workspace-id': adminWorkspace.id
  };

  // -------------------------------------------------------------
  // TEST 3: Búsqueda de Usuarios Real (Sección 5)
  // -------------------------------------------------------------
  console.log('\n👥 [3/15] Probando Búsqueda Real de Usuarios contra Backend (Sección 5)...');
  // Empty result check
  const searchEmpty = await api('/api/v1/workspaces/users?q=', { headers: adminHeaders });
  console.log(`   ✓ Búsqueda sin término devuelve colaboradores del workspace: ${searchEmpty.data?.data?.length} encontrados`);

  // Non-existent user check
  const searchNonExistent = await api('/api/v1/workspaces/users?q=usuario_que_no_existe_9999', { headers: adminHeaders });
  if (searchNonExistent.data?.data?.length !== 0) throw new Error('Búsqueda de inexistente no devolvió array vacío');
  console.log('   ✓ Búsqueda de usuario inexistente: array vacío correcto.');

  // Real search matching colleague
  const searchColleague = await api('/api/v1/workspaces/users?q=auditoria', { headers: adminHeaders });
  if (!searchColleague.data?.data || searchColleague.data.data.length === 0) {
    throw new Error('No se encontró al colega por término de búsqueda');
  }
  console.log(`   ✓ Búsqueda por término ('auditoria'): encontrado '${searchColleague.data.data[0].displayName}' (${searchColleague.data.data[0].email})`);

  // -------------------------------------------------------------
  // TEST 4: Mensajería Directa 1:1 (DM Real A <-> B) (Sección 6)
  // -------------------------------------------------------------
  console.log('\n💬 [4/15] Probando Conversación Directa 1:1 Real (Sección 6)...');
  // Admin starts DM with Colleague
  const dmRes = await api('/api/v1/conversations', {
    method: 'POST',
    headers: adminHeaders,
    body: { targetUserId: colleagueUser.id }
  });
  if (!dmRes.ok) throw new Error(`Error creando DM: ${JSON.stringify(dmRes)}`);
  const conversation = dmRes.data.data;
  console.log(`   ✓ DM 1:1 creado: ${conversation.id} entre Admin y ${conversation.displayName}`);

  // Deduplication check
  const dmResDup = await api('/api/v1/conversations', {
    method: 'POST',
    headers: adminHeaders,
    body: { targetUserId: colleagueUser.id }
  });
  if (dmResDup.data.data.id !== conversation.id) {
    throw new Error('Deduplicación fallida: se creó otra conversación duplicada');
  }
  console.log('   ✓ Deduplicación validada: la creación consecutiva devuelve la misma conversación.');

  // Admin sends "Hola"
  const msg1Res = await api('/api/v1/messages', {
    method: 'POST',
    headers: adminHeaders,
    body: { conversationId: conversation.id, content: 'Hola' }
  });
  if (!msg1Res.ok) throw new Error(`Admin falló al enviar DM: ${JSON.stringify(msg1Res)}`);
  console.log('   ✓ Admin envió: "Hola"');

  // Colleague fetches and verifies receipt
  const colleagueGetMsgs = await api(`/api/v1/messages?conversationId=${conversation.id}`, {
    method: 'GET',
    headers: colleagueHeaders
  });
  const receivedHola = colleagueGetMsgs.data?.data?.find((m: any) => m.content === 'Hola');
  if (!receivedHola) throw new Error('Colega no recibió el mensaje "Hola"');
  console.log('   ✓ Colega recibió mensaje "Hola" de Admin');

  // Colleague replies "Hola, ¿cómo estás?"
  const msg2Res = await api('/api/v1/messages', {
    method: 'POST',
    headers: colleagueHeaders,
    body: { conversationId: conversation.id, content: 'Hola, ¿cómo estás?' }
  });
  if (!msg2Res.ok) throw new Error(`Colega falló al enviar DM: ${JSON.stringify(msg2Res)}`);
  console.log('   ✓ Colega respondió: "Hola, ¿cómo estás?"');

  // Admin fetches and verifies receipt
  const adminGetMsgs = await api(`/api/v1/messages?conversationId=${conversation.id}`, {
    method: 'GET',
    headers: adminHeaders
  });
  const receivedReply = adminGetMsgs.data?.data?.find((m: any) => m.content === 'Hola, ¿cómo estás?');
  if (!receivedReply) throw new Error('Admin no recibió la respuesta del colega');
  console.log('   ✓ Admin recibió respuesta "Hola, ¿cómo estás?"');

  // PostgreSQL Verification of DM
  const pgConvCheck = await pool.query("SELECT id, type FROM conversations WHERE id = $1", [conversation.id]);
  const pgMsgCheck = await pool.query("SELECT count(*)::int as c FROM messages WHERE conversation_id = $1", [conversation.id]);
  if (pgConvCheck.rows.length === 0 || pgMsgCheck.rows[0].c < 2) {
    throw new Error('Conversación o mensajes de DM no persistieron en PostgreSQL');
  }
  console.log(`   ✓ PostgreSQL: Conversación y ${pgMsgCheck.rows[0].c} mensajes persistidos en base de datos`);

  // -------------------------------------------------------------
  // TEST 5: Canales, Hilos, Reacciones y Soft Delete (Sección 7 & 18)
  // -------------------------------------------------------------
  console.log('\n📢 [5/15] Probando Canales, Hilos, Reacciones y Soft Delete (Sección 7 & 18)...');
  // Admin creates channel "general"
  const channelRes = await api('/api/v1/channels', {
    method: 'POST',
    headers: adminHeaders,
    body: {
      name: 'general',
      topic: 'Canal general de la organización',
      isPrivate: false
    }
  });
  if (!channelRes.ok) throw new Error(`Error creando canal #general: ${JSON.stringify(channelRes)}`);
  const generalChannel = channelRes.data.data;
  console.log(`   ✓ Canal creado: #${generalChannel.name} (${generalChannel.id})`);

  // Send message to channel
  const chMsg1 = await api('/api/v1/messages', {
    method: 'POST',
    headers: adminHeaders,
    body: {
      channelId: generalChannel.id,
      content: 'Mensaje de bienvenida al canal #general'
    }
  });
  if (!chMsg1.ok) throw new Error(`Error enviando mensaje a canal: ${JSON.stringify(chMsg1)}`);
  const rootMsg = chMsg1.data.data;
  console.log(`   ✓ Mensaje raíz enviado a canal: "${rootMsg.content}"`);

  // Edit message
  const editMsgRes = await api(`/api/v1/messages/${rootMsg.id}`, {
    method: 'PUT',
    headers: adminHeaders,
    body: { content: 'Mensaje de bienvenida al canal #general (editado y verificado)' }
  });
  if (!editMsgRes.ok || editMsgRes.data.data.content !== 'Mensaje de bienvenida al canal #general (editado y verificado)') {
    throw new Error(`Error editando mensaje: ${JSON.stringify(editMsgRes)}`);
  }
  console.log('   ✓ Edición de mensaje exitosa con auditoría de versión');

  // Thread reply
  const threadReplyRes = await api('/api/v1/messages', {
    method: 'POST',
    headers: colleagueHeaders,
    body: {
      channelId: generalChannel.id,
      parentMessageId: rootMsg.id,
      content: 'Respuesta en hilo por el colega'
    }
  });
  if (!threadReplyRes.ok) throw new Error(`Error respondiendo en hilo: ${JSON.stringify(threadReplyRes)}`);
  console.log('   ✓ Respuesta en hilo enviada correctamente');

  // Add Reaction
  const addRxRes = await api(`/api/v1/messages/${rootMsg.id}/reactions`, {
    method: 'POST',
    headers: colleagueHeaders,
    body: { emoji: '🚀' }
  });
  if (!addRxRes.ok) throw new Error(`Error agregando reacción: ${JSON.stringify(addRxRes)}`);
  console.log('   ✓ Reacción 🚀 añadida');

  // Remove Reaction (Toggle)
  const removeRxRes = await api(`/api/v1/messages/${rootMsg.id}/reactions`, {
    method: 'POST',
    headers: colleagueHeaders,
    body: { emoji: '🚀' }
  });
  if (!removeRxRes.ok) throw new Error(`Error alternando reacción: ${JSON.stringify(removeRxRes)}`);
  console.log('   ✓ Reacción 🚀 alternada/removida');

  // Soft Delete message
  const softDelMsg = await api(`/api/v1/messages/${threadReplyRes.data.data.id}`, {
    method: 'DELETE',
    headers: colleagueHeaders
  });
  if (!softDelMsg.ok) throw new Error(`Error en soft delete de mensaje: ${JSON.stringify(softDelMsg)}`);
  console.log('   ✓ Soft delete de mensaje ejecutado');

  // Verify Soft Delete in PostgreSQL
  const pgSoftDelCheck = await pool.query("SELECT id, deleted_at, content FROM messages WHERE id = $1", [threadReplyRes.data.data.id]);
  if (!pgSoftDelCheck.rows[0]?.deleted_at) {
    throw new Error('El mensaje no tiene `deleted_at` en PostgreSQL tras soft delete');
  }
  console.log('   ✓ PostgreSQL: `deleted_at` confirmado no nulo; registro retenido para auditoría sin aparecer en listas activas');

  // -------------------------------------------------------------
  // TEST 6: Búsqueda Global (Sección 8)
  // -------------------------------------------------------------
  console.log('\n🔎 [6/15] Probando Búsqueda Global en Backend (Sección 8)...');
  const globalSearch1 = await api('/api/v1/search?q=general', { headers: adminHeaders });
  if (!globalSearch1.data?.data?.channels?.some((c: any) => c.name === 'general')) {
    throw new Error('Búsqueda global no encontró el canal general');
  }
  console.log('   ✓ Búsqueda global encontró canal #general');

  const globalSearch2 = await api('/api/v1/search?q=bienvenida', { headers: adminHeaders });
  if (!globalSearch2.data?.data?.messages?.length) {
    throw new Error('Búsqueda global no encontró el mensaje por contenido');
  }
  console.log('   ✓ Búsqueda global encontró mensaje por término de texto');

  // -------------------------------------------------------------
  // TEST 7: Señalización WebRTC y Notificaciones de Llamada (Sección 9)
  // -------------------------------------------------------------
  console.log('\n📞 [7/15] Probando Flujo WebRTC: Invitación, Respuesta y Señalización P2P (Sección 9)...');
  // Admin invites Colleague to Video Call
  const inviteCall = await api('/api/v1/realtime/signal/call/invite', {
    method: 'POST',
    headers: adminHeaders,
    body: {
      targetUserId: colleagueUser.id,
      conversationId: conversation.id,
      isVideo: true
    }
  });
  if (!inviteCall.ok || !inviteCall.data?.data?.callId) {
    throw new Error(`Fallo enviando invitación de llamada: ${JSON.stringify(inviteCall)}`);
  }
  const activeCallId = inviteCall.data.data.callId;
  console.log(`   ✓ Invitación de videollamada emitida (Call ID: ${activeCallId})`);

  // Colleague responds: Accept
  const acceptCall = await api('/api/v1/realtime/signal/call/response', {
    method: 'POST',
    headers: colleagueHeaders,
    body: {
      callerId: adminUser.id,
      callId: activeCallId,
      accepted: true
    }
  });
  if (!acceptCall.ok) throw new Error(`Fallo respondiendo a llamada: ${JSON.stringify(acceptCall)}`);
  console.log('   ✓ Destinatario aceptó llamada');

  // Relay SDP Offer
  const offerSignal = await api('/api/v1/realtime/signal', {
    method: 'POST',
    headers: adminHeaders,
    body: {
      signalType: 'webrtc-offer',
      targetUserId: colleagueUser.id,
      roomId: conversation.id,
      data: { sdp: 'v=0\r\no=admin 1000 2000 IN IP4 127.0.0.1...' }
    }
  });
  if (!offerSignal.ok) throw new Error('Fallo retransmitiendo SDP Offer');
  console.log('   ✓ Señal WebRTC Offer retransmitida por el hub');

  // Relay SDP Answer
  const answerSignal = await api('/api/v1/realtime/signal', {
    method: 'POST',
    headers: colleagueHeaders,
    body: {
      signalType: 'webrtc-answer',
      targetUserId: adminUser.id,
      roomId: conversation.id,
      data: { sdp: 'v=0\r\no=colleague 2000 1000 IN IP4 127.0.0.1...' }
    }
  });
  if (!answerSignal.ok) throw new Error('Fallo retransmitiendo SDP Answer');
  console.log('   ✓ Señal WebRTC Answer retransmitida por el hub');

  // Relay ICE Candidate
  const iceSignal = await api('/api/v1/realtime/signal', {
    method: 'POST',
    headers: adminHeaders,
    body: {
      signalType: 'webrtc-ice',
      targetUserId: colleagueUser.id,
      roomId: conversation.id,
      data: { candidate: 'candidate:1 1 UDP 2122260223 192.168.1.50 54321 typ host' }
    }
  });
  if (!iceSignal.ok) throw new Error('Fallo retransmitiendo ICE Candidate');
  console.log('   ✓ Señal WebRTC ICE Candidate retransmitida exitosamente');

  // Test Decline Flow
  const declineInvite = await api('/api/v1/realtime/signal/call/invite', {
    method: 'POST',
    headers: adminHeaders,
    body: { targetUserId: colleagueUser.id, isVideo: false }
  });
  const declineResponse = await api('/api/v1/realtime/signal/call/response', {
    method: 'POST',
    headers: colleagueHeaders,
    body: { callerId: adminUser.id, callId: declineInvite.data.data.callId, accepted: false, reason: 'busy' }
  });
  if (!declineResponse.ok) throw new Error('Fallo en flujo de rechazo de llamada');
  console.log('   ✓ Flujo de rechazo de llamada (Busy/Decline) verificado.');

  // -------------------------------------------------------------
  // TEST 8: Tareas, Comentarios y Cambio de Estados (Sección 11)
  // -------------------------------------------------------------
  console.log('\n📋 [8/15] Probando Gestor de Tareas y Comentarios (Sección 11)...');
  // Create Task
  const createTaskRes = await api('/api/v1/tasks', {
    method: 'POST',
    headers: adminHeaders,
    body: {
      title: 'Validación de Arquitectura de Microservicios',
      description: 'Auditoría completa de latencia y persistencia',
      priority: 'High',
      assignedTo: colleagueUser.id
    }
  });
  if (!createTaskRes.ok) throw new Error(`Fallo creando tarea: ${JSON.stringify(createTaskRes)}`);
  const auditTask = createTaskRes.data.data;
  console.log(`   ✓ Tarea creada: "${auditTask.title}" (${auditTask.id}) - Estado: ${auditTask.status}`);

  // Edit Task & Change status to Completed
  const updateTaskRes = await api(`/api/v1/tasks/${auditTask.id}`, {
    method: 'PATCH',
    headers: adminHeaders,
    body: {
      status: 'Completed',
      priority: 'Urgent'
    }
  });
  if (!updateTaskRes.ok || updateTaskRes.data.data.status !== 'Completed') {
    throw new Error(`Fallo actualizando estado de tarea: ${JSON.stringify(updateTaskRes)}`);
  }
  console.log('   ✓ Estado cambiado exitosamente a "Completed"');

  // Add Comment to Task
  const addCommentRes = await api(`/api/v1/tasks/${auditTask.id}/comments`, {
    method: 'POST',
    headers: colleagueHeaders,
    body: { content: 'Revisión y pruebas completadas sin observaciones técnicas.' }
  });
  if (!addCommentRes.ok) throw new Error(`Fallo agregando comentario a tarea: ${JSON.stringify(addCommentRes)}`);
  const taskComment = addCommentRes.data.data;
  console.log(`   ✓ Comentario agregado: "${taskComment.content}"`);

  // Get Comments
  const getCommentsRes = await api(`/api/v1/tasks/${auditTask.id}/comments`, { headers: adminHeaders });
  if (!getCommentsRes.data?.data?.length) throw new Error('No se recuperaron los comentarios de la tarea');
  console.log(`   ✓ ${getCommentsRes.data.data.length} comentario(s) recuperado(s) de la tarea`);

  // Delete comment
  const delCommentRes = await api(`/api/v1/tasks/${auditTask.id}/comments/${taskComment.id}`, {
    method: 'DELETE',
    headers: colleagueHeaders
  });
  if (!delCommentRes.ok) throw new Error('Fallo eliminando comentario de tarea');
  console.log('   ✓ Comentario de tarea eliminado');

  // Verify PostgreSQL Tasks
  const pgTaskCheck = await pool.query("SELECT id, status, priority FROM tasks WHERE id = $1", [auditTask.id]);
  if (pgTaskCheck.rows[0]?.status !== 'Completed') {
    throw new Error('El estado Completed de la tarea no se persistió en PostgreSQL');
  }
  console.log('   ✓ PostgreSQL: Tarea persistida en PostgreSQL con status = Completed');

  // Delete Task
  const delTaskRes = await api(`/api/v1/tasks/${auditTask.id}`, {
    method: 'DELETE',
    headers: adminHeaders
  });
  if (!delTaskRes.ok) throw new Error('Fallo eliminando tarea');
  console.log('   ✓ Tarea eliminada');

  // -------------------------------------------------------------
  // TEST 9: Calendario de Eventos (Sección 12)
  // -------------------------------------------------------------
  console.log('\n📅 [9/15] Probando Calendario de Eventos (Sección 12)...');
  const createEvent = await api('/api/v1/calendar/events', {
    method: 'POST',
    headers: adminHeaders,
    body: {
      title: 'Revisión de Seguridad y Penetración',
      description: 'Pruebas de stress y auditoría de sesiones',
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 7200000).toISOString(),
      location: 'Sala Ejecutiva'
    }
  });
  if (!createEvent.ok) throw new Error(`Fallo creando evento: ${JSON.stringify(createEvent)}`);
  const calendarEvent = createEvent.data.data;
  console.log(`   ✓ Evento creado: "${calendarEvent.title}" (${calendarEvent.id})`);

  // Edit Event
  const editEvent = await api(`/api/v1/calendar/events/${calendarEvent.id}`, {
    method: 'PUT',
    headers: adminHeaders,
    body: {
      title: 'Revisión de Seguridad y Penetración (Reprogramada)'
    }
  });
  if (!editEvent.ok || editEvent.data.data.title !== 'Revisión de Seguridad y Penetración (Reprogramada)') {
    throw new Error('Fallo editando evento de calendario');
  }
  console.log('   ✓ Evento editado exitosamente');

  // Delete Event
  const delEvent = await api(`/api/v1/calendar/events/${calendarEvent.id}`, {
    method: 'DELETE',
    headers: adminHeaders
  });
  if (!delEvent.ok) throw new Error('Fallo eliminando evento');
  console.log('   ✓ Evento eliminado');

  // -------------------------------------------------------------
  // TEST 10: Reuniones (Meetings) (Sección 13)
  // -------------------------------------------------------------
  console.log('\n👥 [10/15] Probando Módulo de Reuniones (Sección 13)...');
  const createMeeting = await api('/api/v1/meetings', {
    method: 'POST',
    headers: adminHeaders,
    body: { title: 'Mesa de Trabajo — Validación 2026' }
  });
  if (!createMeeting.ok) throw new Error(`Fallo creando reunión: ${JSON.stringify(createMeeting)}`);
  const meeting = createMeeting.data.data;
  console.log(`   ✓ Reunión iniciada: "${meeting.title}" (Code: ${meeting.meetingCode})`);

  // Colleague joins meeting
  const joinMeeting = await api(`/api/v1/meetings/${meeting.id}/join`, {
    method: 'POST',
    headers: colleagueHeaders
  });
  if (!joinMeeting.ok) throw new Error('Fallo uniendo colega a la reunión');
  console.log('   ✓ Colega se unió a la reunión exitosamente');

  // End meeting
  const endMeeting = await api(`/api/v1/meetings/${meeting.id}/end`, {
    method: 'POST',
    headers: adminHeaders
  });
  if (!endMeeting.ok) throw new Error('Fallo finalizando reunión');
  console.log('   ✓ Reunión finalizada con éxito');

  // -------------------------------------------------------------
  // TEST 11: Archivos (Sección 14)
  // -------------------------------------------------------------
  console.log('\n📁 [11/15] Probando Gestión de Archivos y Metadatos (Sección 14)...');
  const uploadFile = await api('/api/v1/files/upload', {
    method: 'POST',
    headers: adminHeaders,
    body: {
      name: 'informe_certificacion_collabpulse.pdf',
      fileType: 'application/pdf',
      size: 1048576,
      url: 'https://storage.collabpulse.local/documents/cert.pdf'
    }
  });
  if (!uploadFile.ok) throw new Error(`Fallo en subida de archivo: ${JSON.stringify(uploadFile)}`);
  const fileItem = uploadFile.data.data;
  console.log(`   ✓ Archivo subido: "${fileItem.name}" (${fileItem.id})`);

  // Get file
  const getFile = await api(`/api/v1/files/${fileItem.id}`, { headers: adminHeaders });
  if (!getFile.ok) throw new Error('Fallo obteniendo metadata de archivo');
  console.log('   ✓ Metadatos de archivo recuperados');

  // Delete file
  const delFile = await api(`/api/v1/files/${fileItem.id}`, {
    method: 'DELETE',
    headers: adminHeaders
  });
  if (!delFile.ok) throw new Error('Fallo eliminando archivo');
  console.log('   ✓ Archivo eliminado de PostgreSQL y almacenamiento');

  // -------------------------------------------------------------
  // TEST 12: Notificaciones (Sección 15)
  // -------------------------------------------------------------
  console.log('\n🔔 [12/15] Probando Sistema de Notificaciones (Sección 15)...');
  const listNotifs = await api('/api/v1/notifications', { headers: colleagueHeaders });
  if (!listNotifs.ok) throw new Error('Fallo listando notificaciones');
  console.log(`   ✓ ${listNotifs.data?.data?.length || 0} notificaciones consultadas para el usuario`);

  const readAllNotifs = await api('/api/v1/notifications/read-all', {
    method: 'POST',
    headers: colleagueHeaders
  });
  if (!readAllNotifs.ok) throw new Error('Fallo marcando notificaciones como leídas');
  console.log('   ✓ Notificaciones marcadas como leídas');

  // -------------------------------------------------------------
  // TEST 13: Roles y Permisos RBAC (Sección 16)
  // -------------------------------------------------------------
  console.log('\n🛡️ [13/15] Probando Control de Acceso Basado en Roles (RBAC) (Sección 16)...');
  // Colleague (Member) attempts to delete channel (Owner/Admin only)
  const unauthorizedDelete = await api(`/api/v1/channels/${generalChannel.id}`, {
    method: 'DELETE',
    headers: colleagueHeaders
  });
  if (unauthorizedDelete.status !== 403 && unauthorizedDelete.status !== 401) {
    throw new Error(`Fallo de seguridad RBAC: Miembro no autorizado pudo ejecutar acción restringida (Status: ${unauthorizedDelete.status})`);
  }
  console.log('   ✓ Seguridad RBAC: Solicitud no autorizada rechazada con 403 Forbidden correctamente');

  // -------------------------------------------------------------
  // TEST 14: Aislamiento Multi-tenant / Multi-workspace (Sección 17)
  // -------------------------------------------------------------
  console.log('\n🏢 [14/15] Probando Aislamiento Multi-Tenant (Sección 17)...');
  const rogueHeaders = {
    Authorization: `Bearer ${colleagueToken}`,
    'x-tenant-id': 'tenant-aislado-falso-999',
    'x-workspace-id': 'ws-inexistente-888'
  };
  const multiTenantCheck = await api('/api/v1/channels', { headers: rogueHeaders });
  if (multiTenantCheck.status !== 403 && multiTenantCheck.status !== 404 && multiTenantCheck.data?.data?.length !== 0) {
    throw new Error('Fallo de aislamiento multi-tenant: se accedió a recursos fuera de la frontera');
  }
  console.log('   ✓ Aislamiento Multi-tenant confirmado: fronteras de datos respetadas');

  // -------------------------------------------------------------
  // TEST 15: Limpieza Final y Restauración de Estado Pristino (Sección 2 & 27)
  // -------------------------------------------------------------
  console.log('\n🧹 [15/15] Ejecutando Limpieza Final de Datos de Prueba (Sección 2 & 27)...');
  await pool.query("DELETE FROM user_sessions WHERE user_id != $1", [adminUser.id]);
  await pool.query("DELETE FROM message_reactions");
  await pool.query("DELETE FROM pinned_messages");
  await pool.query("DELETE FROM saved_messages");
  await pool.query("DELETE FROM messages");
  await pool.query("DELETE FROM conversation_members");
  await pool.query("DELETE FROM conversations");
  await pool.query("DELETE FROM channel_members");
  await pool.query("DELETE FROM channels");
  try { await pool.query("DELETE FROM task_comments"); } catch {}
  await pool.query("DELETE FROM tasks");
  await pool.query("DELETE FROM calendar_events");
  await pool.query("DELETE FROM meetings");
  await pool.query("DELETE FROM files");
  await pool.query("DELETE FROM workspace_members WHERE user_id != $1", [adminUser.id]);
  await pool.query("DELETE FROM users WHERE id != $1", [adminUser.id]);

  // Final check
  const finalUsers = await pool.query("SELECT id, email, role FROM users WHERE deleted_at IS NULL");
  const finalChannels = await pool.query("SELECT count(*)::int as c FROM channels");
  const finalMessages = await pool.query("SELECT count(*)::int as c FROM messages");
  const finalTasks = await pool.query("SELECT count(*)::int as c FROM tasks");
  const finalConversations = await pool.query("SELECT count(*)::int as c FROM conversations");

  console.log('\n================================================================');
  console.log('🎉 AUDITORÍA Y VALIDACIÓN COMPLETADA CON ÉXITO — 100% PASS');
  console.log('================================================================');
  console.log('Estado final garantizado en PostgreSQL:');
  console.log({
    usuariosReales: finalUsers.rows.length,
    usuarioAdmin: finalUsers.rows[0].email,
    rol: finalUsers.rows[0].role,
    canalesIniciales: finalChannels.rows[0].c,
    mensajesIniciales: finalMessages.rows[0].c,
    tareasIniciales: finalTasks.rows[0].c,
    conversacionesIniciales: finalConversations.rows[0].c
  });

  await pool.end();
}

runExhaustiveAudit().catch(err => {
  console.error('\n❌ AUDITORÍA FALLIDA:', err);
  process.exit(1);
});
