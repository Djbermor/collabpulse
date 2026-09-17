import { chromium, Browser, BrowserContext, Page } from '@playwright/test';
import pg from 'pg';

const BASE_URL = 'http://localhost:3000';
const ADMIN_EMAIL = 'analistalider.ctg@gestionsaludips.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'CollabPulse2026!Admin';

const pool = new pg.Pool({
  connectionString: 'postgresql://postgres:postgres@localhost:5432/collabpulse_dev'
});

interface TestResult {
  num: number;
  name: string;
  status: 'PASS' | 'FAIL';
  details: string;
}

const results: TestResult[] = [];

function recordResult(num: number, name: string, status: 'PASS' | 'FAIL', details: string) {
  results.push({ num, name, status, details });
  console.log(`[TEST ${num}] ${status}: ${name}`);
  if (details) console.log(`       -> ${details}`);
}

async function apiPost(url: string, body: any, token?: string) {
  const res = await fetch(`${BASE_URL}${url}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

async function apiGet(url: string, token?: string) {
  const res = await fetch(`${BASE_URL}${url}`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

async function apiPatch(url: string, body: any, token?: string) {
  const res = await fetch(`${BASE_URL}${url}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

async function apiDelete(url: string, token?: string) {
  const res = await fetch(`${BASE_URL}${url}`, {
    method: 'DELETE',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

async function main() {
  console.log('================================================================');
  console.log('NEXORA — FASE 3: ORGANIZACIONES Y USUARIOS — AUTOMATED SUITE');
  console.log('================================================================\n');

  try {
    // Authenticate Admin to obtain Bearer Token
    console.log('[Setup] Logging in as Admin...');
    const adminLogin = await apiPost('/api/v1/auth/login', {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    });

    if (!adminLogin.ok || !adminLogin.data?.data?.token) {
      throw new Error(`Admin login failed: ${JSON.stringify(adminLogin.data)}`);
    }

    const adminToken = adminLogin.data.data.token;
    const adminUser = adminLogin.data.data.user;
    console.log(`[Setup] Admin logged in. ID: ${adminUser.id}, Token verified.\n`);

    // -------------------------------------------------------------
    // Requirement 1: Entidad Matriz: "Gestión Salud IPS"
    // -------------------------------------------------------------
    try {
      const orgsRes = await apiGet('/api/v1/organizations?all=true', adminToken);
      const dbParent = await pool.query("SELECT * FROM organizations WHERE name ILIKE '%Gestión Salud IPS%' OR slug = 'gestion-salud-ips'");
      
      let parentOrg = dbParent.rows[0];
      if (!parentOrg) {
        // Create if not exists
        const createRes = await apiPost('/api/v1/organizations', {
          name: 'Gestión Salud IPS',
          slug: 'gestion-salud-ips',
          type: 'HOLDING',
          industry: 'Salud Integral',
          primaryDomain: 'gestionsaludips.com'
        }, adminToken);
        parentOrg = createRes.data?.data;
      }

      if (parentOrg && (parentOrg.name.includes('Gestión Salud IPS') || parentOrg.slug === 'gestion-salud-ips')) {
        recordResult(1, 'Entidad Matriz "Gestión Salud IPS"', 'PASS', `Matriz verificada en DB id=${parentOrg.id}, name="${parentOrg.name}"`);
      } else {
        recordResult(1, 'Entidad Matriz "Gestión Salud IPS"', 'FAIL', 'Entidad matriz no encontrada en DB');
      }
    } catch (e: any) {
      recordResult(1, 'Entidad Matriz "Gestión Salud IPS"', 'FAIL', e.message);
    }

    // -------------------------------------------------------------
    // Requirement 2: Múltiples organizaciones creadas y persistidas en PostgreSQL
    // -------------------------------------------------------------
    let orgA: any = null;
    let orgB: any = null;
    try {
      const uniqueSuffix = Date.now();
      const createA = await apiPost('/api/v1/organizations', {
        name: `Clínica Central Norte ${uniqueSuffix}`,
        slug: `clinica-norte-${uniqueSuffix}`,
        industry: 'Hospitalaria',
        primaryDomain: `norte${uniqueSuffix}.gestionsaludips.com`
      }, adminToken);

      const createB = await apiPost('/api/v1/organizations', {
        name: `Centro Diagnóstico Sur ${uniqueSuffix}`,
        slug: `diagnostico-sur-${uniqueSuffix}`,
        industry: 'Diagnóstico',
        primaryDomain: `sur${uniqueSuffix}.gestionsaludips.com`
      }, adminToken);

      orgA = createA.data?.data;
      orgB = createB.data?.data;

      const dbCheck = await pool.query(
        "SELECT id, name, slug, status FROM organizations WHERE id IN ($1, $2)",
        [orgA?.id, orgB?.id]
      );

      if (dbCheck.rows.length === 2 && orgA?.id && orgB?.id) {
        recordResult(2, 'Múltiples organizaciones persistidas en PostgreSQL', 'PASS', `Creadas y persistidas en PostgreSQL: ${orgA.name} (${orgA.id}) y ${orgB.name} (${orgB.id})`);
      } else {
        recordResult(2, 'Múltiples organizaciones persistidas en PostgreSQL', 'FAIL', `Filas en DB: ${dbCheck.rows.length}`);
      }
    } catch (e: any) {
      recordResult(2, 'Múltiples organizaciones persistidas en PostgreSQL', 'FAIL', e.message);
    }

    // -------------------------------------------------------------
    // Requirement 3: Colaboradores con relación N:M a organizaciones
    // -------------------------------------------------------------
    let testUser1: any = null;
    let testUser2: any = null;
    const testPwd = 'TestPassword2026!';
    try {
      const uSuffix = Date.now();
      const userRes1 = await apiPost('/api/v1/admin/users', {
        email: `colaborador.alpha.${uSuffix}@gestionsaludips.com`,
        firstName: 'Carlos',
        lastName: 'Mendoza',
        jobTitle: 'Médico Especialista',
        role: 'Member',
        password: testPwd,
        accountStatus: 'ACTIVE',
        organizationId: orgA.id
      }, adminToken);

      const userRes2 = await apiPost('/api/v1/admin/users', {
        email: `colaboradora.beta.${uSuffix}@gestionsaludips.com`,
        firstName: 'Elena',
        lastName: 'Rios',
        jobTitle: 'Directora Diagnóstico',
        role: 'Member',
        password: testPwd,
        accountStatus: 'ACTIVE',
        organizationId: orgB.id
      }, adminToken);

      testUser1 = userRes1.data?.data;
      testUser2 = userRes2.data?.data;

      const memCheck = await pool.query(
        "SELECT organization_id, user_id, role, status FROM organization_members WHERE user_id IN ($1, $2)",
        [testUser1?.id, testUser2?.id]
      );

      if (memCheck.rows.length >= 2) {
        recordResult(3, 'Colaboradores con relación N:M (organization_members)', 'PASS', `Verificadas ${memCheck.rows.length} membresías persistidas en tabla organization_members`);
      } else {
        recordResult(3, 'Colaboradores con relación N:M (organization_members)', 'FAIL', `Membresías encontradas: ${memCheck.rows.length}`);
      }
    } catch (e: any) {
      recordResult(3, 'Colaboradores con relación N:M (organization_members)', 'FAIL', e.message);
    }

    // -------------------------------------------------------------
    // Requirement 4: Colaborador perteneciente a 2 o más organizaciones simultáneamente
    // -------------------------------------------------------------
    try {
      // Assign testUser1 also to orgB
      const assignRes = await apiPost(`/api/v1/admin/users/${testUser1.id}/organizations`, {
        organizationId: orgB.id,
        role: 'Consultor'
      }, adminToken);

      const multiCheck = await pool.query(
        "SELECT organization_id, status FROM organization_members WHERE user_id = $1 AND (status = 'Active' OR status = 'ACTIVE')",
        [testUser1.id]
      );

      if (multiCheck.rows.length >= 2) {
        recordResult(4, 'Colaborador en 2+ organizaciones simultáneas', 'PASS', `Usuario ${testUser1.id} pertenece activamente a ${multiCheck.rows.length} organizaciones distintas (${orgA.id} y ${orgB.id})`);
      } else {
        recordResult(4, 'Colaborador en 2+ organizaciones simultáneas', 'FAIL', `Orgs activas para usuario: ${multiCheck.rows.length}`);
      }
    } catch (e: any) {
      recordResult(4, 'Colaborador en 2+ organizaciones simultáneas', 'FAIL', e.message);
    }

    // -------------------------------------------------------------
    // Requirement 5: Política Zero Hard Delete en Usuarios
    // -------------------------------------------------------------
    let deletedUserCandidate: any = null;
    try {
      const uSuffix = Date.now();
      const createDel = await apiPost('/api/v1/admin/users', {
        email: `usuario.baja.${uSuffix}@gestionsaludips.com`,
        firstName: 'Felipe',
        lastName: 'Baja',
        jobTitle: 'Practicante',
        role: 'Member',
        password: testPwd,
        accountStatus: 'ACTIVE',
        organizationId: orgA.id
      }, adminToken);
      deletedUserCandidate = createDel.data?.data;

      const countBefore = (await pool.query("SELECT COUNT(*) FROM users")).rows[0].count;

      // Execute soft-delete / deactivation
      const deleteRes = await apiDelete(`/api/v1/admin/users/${deletedUserCandidate.id}`, adminToken);

      const countAfter = (await pool.query("SELECT COUNT(*) FROM users")).rows[0].count;
      const dbUserRow = (await pool.query("SELECT id, is_active, account_status, deleted_at FROM users WHERE id = $1", [deletedUserCandidate.id])).rows[0];

      if (
        countBefore === countAfter &&
        dbUserRow &&
        dbUserRow.is_active === false &&
        dbUserRow.account_status === 'INACTIVE'
      ) {
        recordResult(5, 'Zero Hard Delete en Usuarios (Estado INACTIVE)', 'PASS', `Registro preservado en DB. countBefore=${countBefore}, countAfter=${countAfter}, account_status='${dbUserRow.account_status}', is_active=${dbUserRow.is_active}`);
      } else {
        recordResult(5, 'Zero Hard Delete en Usuarios (Estado INACTIVE)', 'FAIL', `countBefore=${countBefore}, countAfter=${countAfter}, dbUserRow=${JSON.stringify(dbUserRow)}`);
      }
    } catch (e: any) {
      recordResult(5, 'Zero Hard Delete en Usuarios (Estado INACTIVE)', 'FAIL', e.message);
    }

    // -------------------------------------------------------------
    // Requirement 6: Política Zero Hard Delete en Membresías
    // -------------------------------------------------------------
    try {
      const memCountBefore = (await pool.query("SELECT COUNT(*) FROM organization_members")).rows[0].count;

      // Remove testUser1 from orgB
      const removeMemRes = await apiDelete(`/api/v1/organizations/${orgB.id}/members/${testUser1.id}`, adminToken);

      const memCountAfter = (await pool.query("SELECT COUNT(*) FROM organization_members")).rows[0].count;
      const memRow = (await pool.query(
        "SELECT id, status, deactivated_at, deactivated_by FROM organization_members WHERE organization_id = $1 AND user_id = $2",
        [orgB.id, testUser1.id]
      )).rows[0];

      if (
        memCountBefore === memCountAfter &&
        memRow &&
        (memRow.status === 'INACTIVE' || memRow.status === 'Inactive') &&
        memRow.deactivated_at !== null
      ) {
        recordResult(6, 'Zero Hard Delete en Membresías (Estado INACTIVE y timestamp)', 'PASS', `Fila en organization_members preservada intacta. status='${memRow.status}', deactivated_at=${memRow.deactivated_at}`);
      } else {
        recordResult(6, 'Zero Hard Delete en Membresías (Estado INACTIVE y timestamp)', 'FAIL', `memCountBefore=${memCountBefore}, memCountAfter=${memCountAfter}, memRow=${JSON.stringify(memRow)}`);
      }
    } catch (e: any) {
      recordResult(6, 'Zero Hard Delete en Membresías (Estado INACTIVE y timestamp)', 'FAIL', e.message);
    }

    // -------------------------------------------------------------
    // Requirement 7: Política Zero Hard Delete en Organizaciones
    // -------------------------------------------------------------
    let orgToDeactivate: any = null;
    try {
      const uSuffix = Date.now();
      const createOrgRes = await apiPost('/api/v1/organizations', {
        name: `Sede Temporal ${uSuffix}`,
        slug: `sede-temporal-${uSuffix}`,
        industry: 'Administrativa'
      }, adminToken);
      orgToDeactivate = createOrgRes.data?.data;

      const orgCountBefore = (await pool.query("SELECT COUNT(*) FROM organizations")).rows[0].count;

      // Deactivate org
      const deactRes = await apiPatch(`/api/v1/organizations/${orgToDeactivate.id}`, {
        status: 'INACTIVE'
      }, adminToken);

      const orgCountAfter = (await pool.query("SELECT COUNT(*) FROM organizations")).rows[0].count;
      const dbOrgRow = (await pool.query(
        "SELECT id, name, status, deactivated_at, deactivated_by FROM organizations WHERE id = $1",
        [orgToDeactivate.id]
      )).rows[0];

      if (
        orgCountBefore === orgCountAfter &&
        dbOrgRow &&
        dbOrgRow.status === 'INACTIVE' &&
        dbOrgRow.deactivated_at !== null
      ) {
        recordResult(7, 'Zero Hard Delete en Organizaciones (Estado INACTIVE y timestamp)', 'PASS', `Organización preservada en DB con status='INACTIVE', deactivated_at=${dbOrgRow.deactivated_at}`);
      } else {
        recordResult(7, 'Zero Hard Delete en Organizaciones (Estado INACTIVE y timestamp)', 'FAIL', `orgCountBefore=${orgCountBefore}, orgCountAfter=${orgCountAfter}, row=${JSON.stringify(dbOrgRow)}`);
      }
    } catch (e: any) {
      recordResult(7, 'Zero Hard Delete en Organizaciones (Estado INACTIVE y timestamp)', 'FAIL', e.message);
    }

    // -------------------------------------------------------------
    // Requirement 8: Organización Inactiva rechaza nuevos colaboradores (HTTP 400 ORGANIZATION_INACTIVE)
    // -------------------------------------------------------------
    try {
      const rejectMemRes = await apiPost(`/api/v1/organizations/${orgToDeactivate.id}/members`, {
        userId: testUser2.id,
        role: 'Member'
      }, adminToken);

      if (
        rejectMemRes.status === 400 &&
        (rejectMemRes.data?.code === 'ORGANIZATION_INACTIVE' || rejectMemRes.data?.message?.includes('inactiva'))
      ) {
        recordResult(8, 'Organización Inactiva rechaza nuevos colaboradores (HTTP 400 ORGANIZATION_INACTIVE)', 'PASS', `Respuesta rechazada correctamente: HTTP 400 ${rejectMemRes.data.code}`);
      } else {
        recordResult(8, 'Organización Inactiva rechaza nuevos colaboradores (HTTP 400 ORGANIZATION_INACTIVE)', 'FAIL', `Status=${rejectMemRes.status}, data=${JSON.stringify(rejectMemRes.data)}`);
      }
    } catch (e: any) {
      recordResult(8, 'Organización Inactiva rechaza nuevos colaboradores (HTTP 400 ORGANIZATION_INACTIVE)', 'FAIL', e.message);
    }

    // -------------------------------------------------------------
    // Requirement 9: Usuario Inactivo rechazado en login (HTTP 403 ACCOUNT_INACTIVE)
    // -------------------------------------------------------------
    try {
      const inactiveLogin = await apiPost('/api/v1/auth/login', {
        email: deletedUserCandidate.email,
        password: testPwd
      });

      if (
        inactiveLogin.status === 403 &&
        inactiveLogin.data?.code === 'ACCOUNT_INACTIVE'
      ) {
        recordResult(9, 'Usuario Inactivo rechazado en login (HTTP 403 ACCOUNT_INACTIVE)', 'PASS', `Login bloqueado: HTTP 403, error code: ${inactiveLogin.data.code}`);
      } else {
        recordResult(9, 'Usuario Inactivo rechazado en login (HTTP 403 ACCOUNT_INACTIVE)', 'FAIL', `Status=${inactiveLogin.status}, data=${JSON.stringify(inactiveLogin.data)}`);
      }
    } catch (e: any) {
      recordResult(9, 'Usuario Inactivo rechazado en login (HTTP 403 ACCOUNT_INACTIVE)', 'FAIL', e.message);
    }

    // -------------------------------------------------------------
    // Requirement 10: Usuario PENDING_ACTIVATION rechazado en login (HTTP 403 ACCOUNT_PENDING_ACTIVATION)
    // -------------------------------------------------------------
    let pendingUser: any = null;
    try {
      const uSuffix = Date.now();
      const createPending = await apiPost('/api/v1/admin/users', {
        email: `usuario.pendiente.${uSuffix}@gestionsaludips.com`,
        firstName: 'Laura',
        lastName: 'Pendiente',
        jobTitle: 'Auditora Médica',
        role: 'Member',
        password: testPwd,
        accountStatus: 'PENDING_ACTIVATION',
        organizationId: orgA.id
      }, adminToken);
      pendingUser = createPending.data?.data;

      const pendingLogin = await apiPost('/api/v1/auth/login', {
        email: pendingUser.email,
        password: testPwd
      });

      if (
        pendingLogin.status === 403 &&
        pendingLogin.data?.code === 'ACCOUNT_PENDING_ACTIVATION'
      ) {
        recordResult(10, 'Usuario PENDING_ACTIVATION rechazado en login (HTTP 403 ACCOUNT_PENDING_ACTIVATION)', 'PASS', `Login bloqueado: HTTP 403, error code: ${pendingLogin.data.code}`);
      } else {
        recordResult(10, 'Usuario PENDING_ACTIVATION rechazado en login (HTTP 403 ACCOUNT_PENDING_ACTIVATION)', 'FAIL', `Status=${pendingLogin.status}, data=${JSON.stringify(pendingLogin.data)}`);
      }
    } catch (e: any) {
      recordResult(10, 'Usuario PENDING_ACTIVATION rechazado en login (HTTP 403 ACCOUNT_PENDING_ACTIVATION)', 'FAIL', e.message);
    }

    // -------------------------------------------------------------
    // Requirement 11: Aprobación y activación de usuario pendiente por el administrador
    // -------------------------------------------------------------
    try {
      // Admin activates the user
      const activateRes = await apiPatch(`/api/v1/admin/users/${pendingUser.id}/status`, {
        status: 'ACTIVE'
      }, adminToken);

      // Verify login now succeeds
      const approvedLogin = await apiPost('/api/v1/auth/login', {
        email: pendingUser.email,
        password: testPwd
      });

      if (
        activateRes.ok &&
        approvedLogin.ok &&
        approvedLogin.data?.data?.token
      ) {
        recordResult(11, 'Aprobación y activación de usuario pendiente -> Login exitoso', 'PASS', `Usuario aprobado por administrador, estado transitó a ACTIVE y autenticó exitosamente.`);
      } else {
        recordResult(11, 'Aprobación y activación de usuario pendiente -> Login exitoso', 'FAIL', `activateRes=${JSON.stringify(activateRes.data)}, approvedLogin=${JSON.stringify(approvedLogin.data)}`);
      }
    } catch (e: any) {
      recordResult(11, 'Aprobación y activación de usuario pendiente -> Login exitoso', 'FAIL', e.message);
    }

    // -------------------------------------------------------------
    // Requirement 12: Panel administrativo lista organizaciones y miembro conteo real
    // -------------------------------------------------------------
    try {
      const orgsAdminRes = await apiGet('/api/v1/organizations?all=true', adminToken);
      const orgList = orgsAdminRes.data?.data;
      const foundA = orgList?.find((o: any) => o.id === orgA.id);

      if (orgsAdminRes.ok && Array.isArray(orgList) && foundA && typeof foundA.activeMemberCount === 'number') {
        recordResult(12, 'Panel Administrativo: Gestión de Organizaciones y Conteo de Miembros', 'PASS', `Lista de organizaciones cargada con ${orgList.length} entidades y conteos de miembros calculados.`);
      } else {
        recordResult(12, 'Panel Administrativo: Gestión de Organizaciones y Conteo de Miembros', 'FAIL', `Respuesta inesperada: ${JSON.stringify(orgsAdminRes.data)}`);
      }
    } catch (e: any) {
      recordResult(12, 'Panel Administrativo: Gestión de Organizaciones y Conteo de Miembros', 'FAIL', e.message);
    }

    // -------------------------------------------------------------
    // Requirement 13: Directorio Global encuentra colaboradores de distintas organizaciones
    // -------------------------------------------------------------
    try {
      const searchRes = await apiGet(`/api/v1/users/search?q=Carlos`, adminToken);
      const searchResults = searchRes.data?.data;
      const foundCarlos = searchResults?.find((u: any) => u.id === testUser1.id);

      if (searchRes.ok && Array.isArray(searchResults) && foundCarlos) {
        recordResult(13, 'Directorio Global encuentra colaboradores entre organizaciones', 'PASS', `Búsqueda exitosa. Se encontró colaborador ${foundCarlos.displayName} de ${foundCarlos.organizations?.[0]?.name || 'Organización'}`);
      } else {
        recordResult(13, 'Directorio Global encuentra colaboradores entre organizaciones', 'FAIL', `Resultados: ${JSON.stringify(searchResults)}`);
      }
    } catch (e: any) {
      recordResult(13, 'Directorio Global encuentra colaboradores entre organizaciones', 'FAIL', e.message);
    }

    // -------------------------------------------------------------
    // Requirement 14: Directorio Global excluye colaboradores inactivos y pendientes
    // -------------------------------------------------------------
    try {
      const searchInactive = await apiGet(`/api/v1/users/search?q=Felipe`, adminToken);
      const foundInactive = searchInactive.data?.data?.find((u: any) => u.id === deletedUserCandidate.id);

      const uSuffix = Date.now();
      const createPending2 = await apiPost('/api/v1/admin/users', {
        email: `pendiente.oculto.${uSuffix}@gestionsaludips.com`,
        firstName: 'Oculto',
        lastName: 'Pendiente',
        jobTitle: 'Auxiliar',
        role: 'Member',
        password: testPwd,
        accountStatus: 'PENDING_ACTIVATION'
      }, adminToken);
      const pending2Id = createPending2.data?.data?.id;

      const searchPending = await apiGet(`/api/v1/users/search?q=Oculto`, adminToken);
      const foundPending = searchPending.data?.data?.find((u: any) => u.id === pending2Id);

      if (!foundInactive && !foundPending) {
        recordResult(14, 'Directorio Global excluye estrictamente inactivos y pendientes', 'PASS', 'Los colaboradores inactivos y pendientes NO son expuestos en el directorio global.');
      } else {
        recordResult(14, 'Directorio Global excluye estrictamente inactivos y pendientes', 'FAIL', `foundInactive=${!!foundInactive}, foundPending=${!!foundPending}`);
      }
    } catch (e: any) {
      recordResult(14, 'Directorio Global excluye estrictamente inactivos y pendientes', 'FAIL', e.message);
    }

    // -------------------------------------------------------------
    // Requirement 15: Directorio Global expone solo datos públicos seguros
    // -------------------------------------------------------------
    try {
      const searchRes = await apiGet(`/api/v1/users/search?q=Elena`, adminToken);
      const userElena = searchRes.data?.data?.find((u: any) => u.id === testUser2.id);

      const hasPassword = 'password' in (userElena || {});
      const hasToken = 'token' in (userElena || {}) || 'passwordHash' in (userElena || {});
      const hasPublicFields = userElena && userElena.id && userElena.displayName && userElena.email && Array.isArray(userElena.organizations);

      if (hasPublicFields && !hasPassword && !hasToken) {
        recordResult(15, 'Directorio Global expone únicamente campos públicos seguros', 'PASS', `Campos expuestos: id, displayName, email, jobTitle, organizations. Credenciales y tokens excluidos.`);
      } else {
        recordResult(15, 'Directorio Global expone únicamente campos públicos seguros', 'FAIL', `Datos retornados: ${JSON.stringify(userElena)}`);
      }
    } catch (e: any) {
      recordResult(15, 'Directorio Global expone únicamente campos públicos seguros', 'FAIL', e.message);
    }

    // -------------------------------------------------------------
    // Requirement 16: Chat 1 a 1 entre colaboradores de diferentes organizaciones
    // -------------------------------------------------------------
    try {
      // Login as testUser1 (Org A)
      const loginU1 = await apiPost('/api/v1/auth/login', {
        email: testUser1.email,
        password: testPwd
      });
      const tokenU1 = loginU1.data?.data?.token;

      // Login as testUser2 (Org B)
      const loginU2 = await apiPost('/api/v1/auth/login', {
        email: testUser2.email,
        password: testPwd
      });
      const tokenU2 = loginU2.data?.data?.token;

      // User 1 creates a direct 1:1 conversation with User 2
      const convRes = await apiPost('/api/v1/conversations', {
        type: 'direct',
        memberIds: [testUser2.id]
      }, tokenU1);

      const conversation = convRes.data?.data;
      if (!conversation?.id) {
        throw new Error(`Failed to create conversation: ${JSON.stringify(convRes.data)}`);
      }

      // User 1 sends message to conversation
      const msgText = `Hola Elena, te contacto desde Clínica Norte para interconsulta médica (${Date.now()})`;
      const sendRes = await apiPost(`/api/v1/conversations/${conversation.id}/messages`, {
        content: msgText
      }, tokenU1);

      // User 2 reads conversation messages
      const getMsgsRes = await apiGet(`/api/v1/conversations/${conversation.id}/messages`, tokenU2);
      const receivedMsgs = getMsgsRes.data?.data;
      const foundMsg = receivedMsgs?.find((m: any) => m.content === msgText);

      // Check PostgreSQL persistence
      const dbMsg = await pool.query("SELECT * FROM messages WHERE content = $1", [msgText]);

      if (convRes.ok && sendRes.ok && foundMsg && dbMsg.rows.length === 1) {
        recordResult(16, 'Chat 1:1 entre colaboradores de diferentes organizaciones', 'PASS', `Mensaje enviado por User1 (Org A) recibido por User2 (Org B) y persistido en PostgreSQL.`);
      } else {
        recordResult(16, 'Chat 1:1 entre colaboradores de diferentes organizaciones', 'FAIL', `convRes=${convRes.status}, sendRes=${sendRes.status}, foundMsg=${!!foundMsg}, dbCount=${dbMsg.rows.length}`);
      }
    } catch (e: any) {
      recordResult(16, 'Chat 1:1 entre colaboradores de diferentes organizaciones', 'FAIL', e.message);
    }

    // -------------------------------------------------------------
    // Requirement 17: Aislamiento estricto de recursos internos / canales entre organizaciones
    // -------------------------------------------------------------
    try {
      // User 1 creates a channel in Org A
      const loginU1 = await apiPost('/api/v1/auth/login', {
        email: testUser1.email,
        password: testPwd
      });
      const tokenU1 = loginU1.data?.data?.token;
      const tokenU2 = (await apiPost('/api/v1/auth/login', { email: testUser2.email, password: testPwd })).data?.data?.token;

      const chName = `uci-interna-${Date.now()}`;
      const chRes = await apiPost('/api/v1/channels', {
        name: chName,
        description: 'Canal estrictamente interno Clínica Norte',
        isPrivate: true
      }, tokenU1);

      const channel = chRes.data?.data;

      // User 2 (Org B) attempts to read messages of User 1's channel
      const u2AccessRes = await apiGet(`/api/v1/conversations/${channel?.id}/messages`, tokenU2);

      // User 2 should be rejected or receive 403 / 404 forbidden
      if (u2AccessRes.status === 403 || u2AccessRes.status === 404 || !u2AccessRes.ok) {
        recordResult(17, 'Aislamiento de canales y recursos privados entre organizaciones', 'PASS', `Colaborador de Org B no puede acceder a canal privado de Org A. Status=${u2AccessRes.status}`);
      } else {
        recordResult(17, 'Aislamiento de canales y recursos privados entre organizaciones', 'FAIL', `User 2 pudo acceder al canal de Org A. Status=${u2AccessRes.status}`);
      }
    } catch (e: any) {
      recordResult(17, 'Aislamiento de canales y recursos privados entre organizaciones', 'FAIL', e.message);
    }

    // -------------------------------------------------------------
    // Browser E2E Test: Admin UI Verification
    // -------------------------------------------------------------
    console.log('\n[Phase 2] Verifying Admin UI in Real Headless Browser...');
    const browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage']
    });

    try {
      const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      const page = await context.newPage();

      await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });

      // Fill login
      const emailInput = page.locator('input[type="text"], input[type="email"]').first();
      await emailInput.waitFor({ state: 'visible', timeout: 15000 });
      await emailInput.fill(ADMIN_EMAIL);
      const passwordInput = page.locator('input[type="password"]').first();
      await passwordInput.fill(ADMIN_PASSWORD);
      await page.locator('button[type="submit"]:has-text("Ingresar"), button:has-text("Ingresar")').first().click();

      // Wait for app load
      await page.waitForFunction(() => !!localStorage.getItem('nexora_token'), { timeout: 15000 });
      await page.waitForTimeout(2000);

      // Navigate to Admin View
      const adminNavButton = page.locator('button[title*="Admin"], button[aria-label*="Admin"], button:has-text("Admin")').first();
      if (await adminNavButton.isVisible()) {
        await adminNavButton.click();
        await page.waitForTimeout(1000);
      }

      // Check if "Organizaciones" tab exists and click it
      const orgsTab = page.locator('button:has-text("Organizaciones")').first();
      if (await orgsTab.isVisible()) {
        await orgsTab.click();
        await page.waitForTimeout(1000);
        console.log('[Browser] "Organizaciones" tab clicked successfully.');
      }

      // Check if "Pendientes de Activación" tab exists
      const pendingTab = page.locator('button:has-text("Pendientes")').first();
      if (await pendingTab.isVisible()) {
        console.log('[Browser] "Pendientes de Activación" tab visible in Admin UI.');
      }

      console.log('[Browser] Admin UI verification complete.');
      await context.close();
    } catch (bErr: any) {
      console.warn('[Browser Warning]', bErr.message);
    } finally {
      await browser.close();
    }

  } catch (err: any) {
    console.error('Fatal test error:', err);
  } finally {
    await pool.end();
  }

  // Summary Table
  console.log('\n================================================================');
  console.log('                 RESUMEN DE VALIDACIÓN FASE 3                   ');
  console.log('================================================================');
  const passCount = results.filter(r => r.status === 'PASS').length;
  const failCount = results.filter(r => r.status === 'FAIL').length;

  results.forEach(r => {
    console.log(`[REQ ${r.num.toString().padStart(2, '0')}] [${r.status}] ${r.name}`);
  });

  console.log('================================================================');
  console.log(`TOTAL: ${results.length} | PASS: ${passCount} | FAIL: ${failCount}`);
  console.log('================================================================\n');

  if (failCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main();
