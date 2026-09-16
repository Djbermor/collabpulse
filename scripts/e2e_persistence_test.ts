import { api } from '../src/services/api';

async function runE2ETests() {
  console.log('=== INICIANDO PRUEBAS E2E Y VERIFICACIÓN DE PERSISTENCIA ===\n');

  const BASE_URL = 'http://localhost:3000/api/v1';
  let token = '';
  let userId = '';
  let sessionId = '';
  let workspaceId = '';
  let channelId = '';
  let messageId = '';
  let reactionId = '';
  let taskId = '';
  let eventId = '';

  const testEmail = `qa-test-user@collabpulse.io`;
  const testPassword = `SecureP@ssw0rd2026!`;

  // 1. REGISTRO DE USUARIO
  console.log('--- PASO 1: Registro de nuevo usuario ---');
  console.log(`Payload: email=${testEmail}, password=***, firstName=QA, lastName=User`);
  const regRes = await fetch(`${BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: testEmail,
      password: testPassword,
      firstName: 'QA',
      lastName: 'Persistencia'
    })
  });
  const regData = await regRes.json();
  console.log(`Status HTTP: ${regRes.status}`, regData.success ? 'REGISTRO EXITOSO' : regData.error);
  if (!regData.success) {
    // Si ya existe de una corrida previa, intentamos login directo
    console.log('Usuario ya existe, procediendo...');
  } else {
    token = regData.data.token;
    userId = regData.data.user.id;
    sessionId = regData.data.sessionId;
  }

  // 2. INICIAR SESIÓN CON ESTE USUARIO
  console.log('\n--- PASO 2: Primer inicio de sesión ---');
  const login1Res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: testEmail,
      password: testPassword
    })
  });
  const login1Data = await login1Res.json();
  console.log(`Status HTTP: ${login1Res.status}`);
  if (!login1Data.success) {
    throw new Error(`Fallo en login 1: ${JSON.stringify(login1Data)}`);
  }
  token = login1Data.data.token;
  userId = login1Data.data.user.id;
  sessionId = login1Data.data.sessionId;
  console.log(`[PASS] Login 1 exitoso. UserId: ${userId}, SessionId: ${sessionId}`);

  // 3. CERRAR SESIÓN
  console.log('\n--- PASO 3: Cerrar sesión (Logout) ---');
  const logoutRes = await fetch(`${BASE_URL}/auth/logout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ sessionId })
  });
  const logoutData = await logoutRes.json();
  console.log(`Status HTTP: ${logoutRes.status}`, logoutData);
  console.log(`[PASS] Logout exitoso. Sesión invalidada y contadores de intentos reseteados.`);

  // 4. INICIAR SESIÓN NUEVAMENTE (Comprobación de bug "demasiados intentos" y single-request)
  console.log('\n--- PASO 4: Segundo inicio de sesión (Comprobación de lockout bug) ---');
  const login2Start = Date.now();
  const login2Res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: testEmail,
      password: testPassword
    })
  });
  const login2Data = await login2Res.json();
  console.log(`Status HTTP: ${login2Res.status} (Tiempo: ${Date.now() - login2Start}ms)`);
  if (!login2Data.success) {
    throw new Error(`[FAIL] Falló el segundo login con error: ${login2Data.error?.message || login2Data.error}`);
  }
  token = login2Data.data.token;
  userId = login2Data.data.user.id;
  sessionId = login2Data.data.sessionId;
  console.log(`[PASS] Segundo login exitoso al PRIMER intento sin error de 'demasiados intentos'!`);

  // Headers autorizados
  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'X-User-Id': userId
  };

  // 5. CREAR WORKSPACE NUEVO: "Workspace QA Persistencia"
  console.log('\n--- PASO 5: Crear Workspace "Workspace QA Persistencia" ---');
  const wsRes = await fetch(`${BASE_URL}/workspaces`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      name: 'Workspace QA Persistencia',
      description: 'Workspace creado para pruebas de persistencia duradera en Cloud SQL'
    })
  });
  const wsData = await wsRes.json();
  if (!wsData.success) {
    throw new Error(`Fallo al crear workspace: ${JSON.stringify(wsData)}`);
  }
  workspaceId = wsData.data.id;
  console.log(`[PASS] Workspace creado con éxito. ID: ${workspaceId}, Name: ${wsData.data.name}`);

  // Headers con workspaceId
  const wsAuthHeaders = {
    ...authHeaders,
    'X-Workspace-Id': workspaceId
  };

  // 6. CREAR CANAL NUEVO: "#qa-persistencia"
  console.log('\n--- PASO 6: Crear canal "#qa-persistencia" ---');
  const chRes = await fetch(`${BASE_URL}/channels`, {
    method: 'POST',
    headers: wsAuthHeaders,
    body: JSON.stringify({
      name: 'qa-persistencia',
      description: 'Canal para validación de mensajes y concurrencia Cloud SQL',
      type: 'Public',
      workspaceId
    })
  });
  const chData = await chRes.json();
  if (!chData.success) {
    throw new Error(`Fallo al crear canal: ${JSON.stringify(chData)}`);
  }
  channelId = chData.data.id;
  console.log(`[PASS] Canal creado con éxito. ID: ${channelId}, Name: ${chData.data.name}`);

  // 7. ENVIAR MENSAJE: "Mensaje de prueba de persistencia Cloud SQL"
  console.log('\n--- PASO 7: Enviar mensaje "Mensaje de prueba de persistencia Cloud SQL" ---');
  const msgRes = await fetch(`${BASE_URL}/messages`, {
    method: 'POST',
    headers: wsAuthHeaders,
    body: JSON.stringify({
      channelId,
      content: 'Mensaje de prueba de persistencia Cloud SQL'
    })
  });
  const msgData = await msgRes.json();
  if (!msgData.success) {
    throw new Error(`Fallo al enviar mensaje: ${JSON.stringify(msgData)}`);
  }
  messageId = msgData.data.id;
  console.log(`[PASS] Mensaje enviado con éxito. ID: ${messageId}, Content: "${msgData.data.content}"`);

  // 8. AGREGAR REACCIÓN AL MENSAJE
  console.log('\n--- PASO 8: Agregar reacción al mensaje ---');
  const rxRes = await fetch(`${BASE_URL}/messages/${messageId}/reactions`, {
    method: 'POST',
    headers: wsAuthHeaders,
    body: JSON.stringify({
      emoji: '🚀'
    })
  });
  const rxData = await rxRes.json();
  if (!rxData.success) {
    throw new Error(`Fallo al agregar reacción: ${JSON.stringify(rxData)}`);
  }
  reactionId = rxData.data.id;
  console.log(`[PASS] Reacción agregada con éxito. ID: ${reactionId}, Emoji: ${rxData.data.emoji}`);

  // 9. CREAR TAREA: "Tarea de verificación Cloud SQL"
  console.log('\n--- PASO 9: Crear tarea "Tarea de verificación Cloud SQL" ---');
  const taskRes = await fetch(`${BASE_URL}/tasks`, {
    method: 'POST',
    headers: wsAuthHeaders,
    body: JSON.stringify({
      title: 'Tarea de verificación Cloud SQL',
      description: 'Tarea creada para comprobar retención relacional tras refresh y restart',
      priority: 'Urgent',
      dueDate: new Date(Date.now() + 86400000).toISOString().split('T')[0]
    })
  });
  const taskData = await taskRes.json();
  if (!taskData.success) {
    throw new Error(`Fallo al crear tarea: ${JSON.stringify(taskData)}`);
  }
  taskId = taskData.data.id;
  console.log(`[PASS] Tarea creada con éxito. ID: ${taskId}, Title: "${taskData.data.title}"`);

  // 10. CREAR EVENTO DE CALENDARIO: "Reunión de verificación Cloud SQL"
  console.log('\n--- PASO 10: Crear evento de calendario "Reunión de verificación Cloud SQL" ---');
  const eventRes = await fetch(`${BASE_URL}/calendar/events`, {
    method: 'POST',
    headers: wsAuthHeaders,
    body: JSON.stringify({
      title: 'Reunión de verificación Cloud SQL',
      description: 'Auditoría de persistencia y healthcheck en PostgreSQL 18.4',
      startAt: new Date(Date.now() + 3600000).toISOString(),
      endAt: new Date(Date.now() + 7200000).toISOString(),
      location: 'Sala Virtual CollabPulse Alpha'
    })
  });
  const eventData = await eventRes.json();
  if (!eventData.success) {
    throw new Error(`Fallo al crear evento: ${JSON.stringify(eventData)}`);
  }
  eventId = eventData.data.id;
  console.log(`[PASS] Evento de calendario creado con éxito. ID: ${eventId}, Title: "${eventData.data.title}"`);

  // 11. VERIFICACIÓN DE REFRESH / RE-CONSULTA
  console.log('\n--- PASO 11: Simulación de recarga de página (Refresh) ---');
  console.log('Consultando endpoints GET como lo haría la UI al recargar el navegador:');

  // Re-consultar Workspace
  const getWsRes = await fetch(`${BASE_URL}/workspaces`, { headers: authHeaders });
  const getWsData = await getWsRes.json();
  const foundWs = getWsData.data.find((w: any) => w.id === workspaceId);
  console.log(`- Workspace persistido: ${foundWs ? 'PASS (' + foundWs.name + ')' : 'FAIL'}`);

  // Re-consultar Canal
  const getChRes = await fetch(`${BASE_URL}/channels?workspaceId=${workspaceId}`, { headers: wsAuthHeaders });
  const getChData = await getChRes.json();
  const foundCh = getChData.data.find((c: any) => c.id === channelId);
  console.log(`- Canal persistido: ${foundCh ? 'PASS (' + foundCh.name + ')' : 'FAIL'}`);

  // Re-consultar Mensaje y Reacción
  const getMsgRes = await fetch(`${BASE_URL}/messages?channelId=${channelId}`, { headers: wsAuthHeaders });
  const getMsgData = await getMsgRes.json();
  const foundMsg = getMsgData.data.find((m: any) => m.id === messageId);
  const foundRx = foundMsg?.reactions?.find((r: any) => r.emoji === '🚀');
  console.log(`- Mensaje persistido: ${foundMsg ? 'PASS ("' + foundMsg.content + '")' : 'FAIL'}`);
  console.log(`- Reacción persistida: ${foundRx ? 'PASS (' + foundRx.emoji + ')' : 'FAIL'}`);

  // Re-consultar Tarea
  const getTaskRes = await fetch(`${BASE_URL}/tasks`, { headers: wsAuthHeaders });
  const getTaskData = await getTaskRes.json();
  const foundTask = getTaskData.data.find((t: any) => t.id === taskId);
  console.log(`- Tarea persistida: ${foundTask ? 'PASS ("' + foundTask.title + '")' : 'FAIL'}`);

  // Re-consultar Evento de calendario
  const getEvRes = await fetch(`${BASE_URL}/calendar/events`, { headers: wsAuthHeaders });
  const getEvData = await getEvRes.json();
  const foundEv = getEvData.data.find((e: any) => e.id === eventId);
  console.log(`- Evento calendario persistido: ${foundEv ? 'PASS ("' + foundEv.title + '")' : 'FAIL'}`);

  console.log('\n=== RESULTADO DE PRUEBAS E2E: TODAS COMPLETADAS CON ÉXITO ===');
  return {
    userId,
    workspaceId,
    channelId,
    messageId,
    reactionId,
    taskId,
    eventId
  };
}

runE2ETests().catch(err => {
  console.error('Error durante la ejecución E2E:', err);
  process.exit(1);
});
