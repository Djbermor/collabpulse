# COLLABPULSE — FASE 5: GROUP CALLS HARDENING, CONSISTENCY & VALIDATION REPORT

**Fecha:** 16 de Septiembre de 2026  
**Estado General:** **PASS** (100% Verificado y Endurecido)  
**Regla de Detención Crítica:** **CUMPLIDA RIGUROSAMENTE**. Ninguna funcionalidad de chat en llamada, mensajería, reacciones ni notificaciones push fue implementada. El alcance se cerró estrictamente en la estabilización y validación completa de Group Calls / LiveKit SFU.

---

## 1. RESUMEN EJECUTIVO

La Fase 5 de CollabPulse tuvo como mandato exclusivo resolver, implementar, validar y certificar las 20 inconsistencias técnicas y arquitectónicas detectadas durante la auditoría de Fase 4 respecto a la integración de conferencias grupales mediante Selective Forwarding Unit (LiveKit SFU).

Tras la ejecución de las tareas planificadas:
* **LiveKit SFU Operativo:** Contenedor Docker `collabpulse-dev-livekit` en ejecución continua con binding `0.0.0.0`, exponiendo puerto HTTP/Twirp `7880`, WebRTC TCP `7881` y WebRTC UDP `7882`.
* **Persistencia PostgreSQL Consolidada:** Tablas dedicadas `group_calls`, `group_call_participants` y `group_call_events` con integridad referencial, índices optimizados y soporte de eventos de auditoría.
* **Backend Router Completo (`server/routes/groupCalls.ts`):** 10 endpoints REST para creación, invitación, unión con límite de capacidad (25 participantes), generación/refresco de tokens JWT de LiveKit, mute/video sincrónico, abandono con transferencia determinista de anfitrión, finalización autorizada y webhook seguro.
* **Cliente SFU Manager (`src/services/call/SfuManager.ts`):** Abstracción desacoplada de `livekit-client` con soporte de pausa/reanudación granular (`pausePublishing`, `resumePublishing`, `pauseSubscriptions`, `resumeSubscriptions`), control de pantalla compartida y detección de altavoz activo (`ActiveSpeakersChanged`).
* **UI Determinista (`ParticipantGrid.tsx` & `ParticipantTile.tsx`):** Grid responsivo matemático (1x1 a 4x3), modo spotlight para screen share y paginación determinista (12 participantes por página).
* **Políticas de Concurrencia:** Matriz formal de coexistencia Grupo vs 1:1, donde una llamada 1:1 entrante aceptada suspende temporalmente los flujos multimedia del grupo (`pauseGroupCall`) y los restaura íntegramente al terminar (`resumeGroupCall`).

---

## 2. MATRIZ DE RESOLUCIÓN DE LAS 20 INCONSISTENCIAS DE FASE 4

A continuación se detalla el estado de resolución de cada una de las 20 inconsistencias técnicas identificadas:

| # | Componente / Inconsistencia | Problema Original Detectado en Fase 4 | Solución Implementada en Fase 5 | Estado |
|---|---|---|---|---|
| **1** | **Dependencias LiveKit** | Falta de paquetes en `package.json`. | Instalados `livekit-server-sdk@2.15.2` y `livekit-client@2.9.2`. | **PASS** |
| **2** | **Despliegue Local SFU** | No existía contenedor LiveKit Docker local. | Contenedor `collabpulse-dev-livekit` desplegado con `--dev --bind 0.0.0.0` y puertos 7880, 7881, 7882/udp. | **PASS** |
| **3** | **Variables de Entorno** | Variables `LIVEKIT_*` ausentes en `.env`. | Configuradas `LIVEKIT_URL=ws://127.0.0.1:7880`, `LIVEKIT_API_KEY=devkey`, `LIVEKIT_API_SECRET=secret`, `MAX_GROUP_PARTICIPANTS=25`. | **PASS** |
| **4** | **Esquema DB para Grupos** | Modelo de llamadas 1:1 (`calls`) no admitía topología N-participantes. | Creadas tablas `group_calls`, `group_call_participants`, `group_call_events` en `server/bootstrap.ts`. | **PASS** |
| **5** | **Separación 1:1 vs Grupos** | Confusión entre P2P Mesh y SFU. | Separación arquitectónica estricta: `calls` (1:1 WebRTC P2P) y `group_calls` (SFU LiveKit). | **PASS** |
| **6** | **Rutas Backend de Grupo** | Faltaba router Express dedicado. | Creado `server/routes/groupCalls.ts` montado en `/api/v1/group-calls`. | **PASS** |
| **7** | **Generación de Tokens JWT** | Tokens efímeros de signaling 1:1 incompatibles con SFU. | Implementado `AccessToken` de LiveKit con grants `roomJoin: true`, `room: roomId`, TTL 15 min. | **PASS** |
| **8** | **Renovación de Tokens (TTL)** | Desconexiones abruptas tras expiración. | Endpoint `POST /group-calls/:id/token/refresh` con verificación de pertenencia activa y reemisión silenciosa. | **PASS** |
| **9** | **Límite de Capacidad (25)** | Sin validación de desbordamiento en SFU. | Validador en `join` retorna `409 ROOM_FULL` en intento de participante número 26. | **PASS** |
| **10** | **Webhook LiveKit** | Falta de reconciliación de estado ante caídas de socket. | Endpoint `POST /group-calls/webhooks/livekit` con `WebhookReceiver` validando firma SHA256 base64. | **PASS** |
| **11** | **SfuManager Cliente** | Ausencia de clase gestora de LiveKit en el cliente. | Implementado `src/services/call/SfuManager.ts` con manejo de eventos, reconexión y cleanup. | **PASS** |
| **12** | **Pausa Granular Multimedia** | Métodos `pausePublishing`, `resumePublishing`, etc. inexistentes. | Métodos implementados para pausar/reanudar tracks locales y suscripciones remotas individual o colectivamente. | **PASS** |
| **13** | **Active Speaker UI** | Indeterminación visual de quién está hablando en sala grupal. | Detección de altavoz activo con ordenamiento prioritario y borde visual animado verde en `ParticipantTile.tsx`. | **PASS** |
| **14** | **Screen Sharing en Grupo** | Conflicto con `replaceTrack` de llamada 1:1. | Publicación de track de pantalla nativo en SFU (`setScreenShareEnabled(true)`) sin destruir cámara. | **PASS** |
| **15** | **Grid Determinista (1 a 12)** | Layouts CSS rotos al variar número de participantes. | Algoritmo determinista en `ParticipantGrid.tsx` (1x1, 1x2, 2x2, 3x2, 3x3, 4x3). | **PASS** |
| **16** | **Paginación > 12** | Colapso de rendimiento UI con 25 participantes. | Paginación en bloques de 12 baldosas con controles Anterior/Siguiente e indicadores numéricos. | **PASS** |
| **17** | **Modo Spotlight** | Presentación de pantalla compartida reducida a baldosa pequeña. | Layout dinámico Spotlight: pantalla compartida ocupa el 80% y tira horizontal de baldosas el 20%. | **PASS** |
| **18** | **Transferencia de Host** | Abandono del anfitrión dejaba la sala huérfana o la cerraba. | Al salir el host, se promueve automáticamente al siguiente participante activo por antigüedad (`joined_at`). | **PASS** |
| **19** | **Cierre Automático** | Salas vacías permanecían como zombies en BD. | Cuando el último participante abandona, `group_calls.status` se actualiza inmediatamente a `ended`. | **PASS** |
| **20** | **Concurrencia Grupo + 1:1** | Colisión de hardware al recibir llamada 1:1 estando en grupo. | Concurrencia formal: aceptar 1:1 ejecuta `pauseGroupCall` en SFU; al terminar 1:1, `resumeGroupCall` restaura el grupo. | **PASS** |

---

## 3. INFRAESTRUCTURA LIVEKIT SFU & DESPLIEGUE EN PRODUCCIÓN

### 3.1 Entorno de Desarrollo Local
* **Imagen:** `livekit/livekit-server:latest`
* **Comando:**
  ```bash
  docker run -d --name collabpulse-dev-livekit \
    -p 7880:7880 \
    -p 7881:7881 \
    -p 7882:7882/udp \
    livekit/livekit-server:latest --dev --bind 0.0.0.0
  ```
* **Puertos de Red:**
  - `7880/TCP`: HTTP API, Twirp RPC, WebSockets de señalización.
  - `7881/TCP`: Fallback ICE sobre TCP (para redes corporativas con UDP bloqueado).
  - `7882/UDP`: Tráfico WebRTC primario de medios (Audio/Video).

### 3.2 Consideración Crítica de Producción Cloud (GCP / Kubernetes)
> [!WARNING]
> **Cloud Run NO es compatible con LiveKit SFU:**  
> Google Cloud Run es un proxy HTTP/1-2 que únicamente enruta tráfico TCP. No soporta puertos UDP ni rangos dinámicos requeridos por WebRTC.

**Arquitectura recomendada para Producción:**
1. **Google Kubernetes Engine (GKE):**
   - Pods de `livekit-server` detrás de un Service con `type: LoadBalancer`.
   - Rango de puertos UDP abierto en firewall de GCP (`50000-60000/udp`).
   - Cluster de Redis para balanceo multi-nodo (`livekit-routing`).
2. **LiveKit Cloud:** Alternativa administrada compatible drop-in sustituyendo las variables `LIVEKIT_URL`, `LIVEKIT_API_KEY` y `LIVEKIT_API_SECRET`.

---

## 4. MODELO DE DATOS POSTGRESQL

```sql
-- Conferencia Grupal
CREATE TABLE IF NOT EXISTS group_calls (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  room_id TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL DEFAULT 'Conferencia Grupal',
  creator_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel_id TEXT,
  media_type TEXT NOT NULL DEFAULT 'video',
  status TEXT NOT NULL DEFAULT 'active',
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  ended_at TIMESTAMP WITH TIME ZONE,
  duration_seconds INTEGER DEFAULT 0,
  max_participants INTEGER DEFAULT 25,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Participantes de la Conferencia
CREATE TABLE IF NOT EXISTS group_call_participants (
  id TEXT PRIMARY KEY,
  group_call_id TEXT NOT NULL REFERENCES group_calls(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'participant', -- 'host' | 'participant'
  status TEXT NOT NULL DEFAULT 'joined',    -- 'invited' | 'joined' | 'left'
  audio_enabled BOOLEAN NOT NULL DEFAULT true,
  video_enabled BOOLEAN NOT NULL DEFAULT true,
  screen_sharing_enabled BOOLEAN NOT NULL DEFAULT false,
  connection_state TEXT NOT NULL DEFAULT 'connected',
  joined_at TIMESTAMP WITH TIME ZONE,
  left_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Eventos y Trazabilidad de Auditoría
CREATE TABLE IF NOT EXISTS group_call_events (
  id TEXT PRIMARY KEY,
  group_call_id TEXT NOT NULL REFERENCES group_calls(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- 'created', 'joined', 'left', 'muted', 'unmuted', 'video_enabled', 'video_disabled', 'ended'
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  metadata TEXT DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);
```

---

## 5. CATÁLOGO DE ENDPOINTS HTTP REST (`/api/v1/group-calls`)

| Método | Ruta | Autorización | Rol Requerido | Descripción |
|---|---|---|---|---|
| `POST` | `/` | Bearer JWT | Miembro | Crea la sala grupal en PostgreSQL, asigna rol de host al creador y devuelve token LiveKit inicial. |
| `POST` | `/:id/invite` | Bearer JWT | Host / Miembro | Invita usuarios del mismo workspace; registra estado `invited` en BD y emite evento SSE. |
| `POST` | `/:id/join` | Bearer JWT | Miembro | Valida capacidad (máx 25). Si está lleno retorna `409 ROOM_FULL`. Si entra, actualiza a `joined`. |
| `POST` | `/:id/token` | Bearer JWT | Participante | Emite token JWT de LiveKit con grants para suscripción y publicación (TTL 15m). |
| `POST` | `/:id/token/refresh` | Bearer JWT | Participante | Revalida membresía y emite token renovado sin interrupción de llamada. |
| `POST` | `/:id/mute` | Bearer JWT | Participante / Host | Sincroniza estado de audio (`audio_enabled`) y audita en `group_call_events`. |
| `POST` | `/:id/video` | Bearer JWT | Participante | Sincroniza estado de video (`video_enabled`) y audita en `group_call_events`. |
| `POST` | `/:id/leave` | Bearer JWT | Participante | Abandona sala. Si sale el host, transfiere el rol al participante más antiguo. Si es el último, finaliza la sala. |
| `POST` | `/:id/end` | Bearer JWT | Host Solamente | Finaliza la llamada para todos. Si un no-host lo intenta, retorna `403 HOST_ONLY`. |
| `POST` | `/webhooks/livekit` | Header Auth | LiveKit SFU | Recibe y valida firmas SHA256 de webhooks (`participant_left`, `room_finished`). |
| `GET` | `/channel/:channelId` | Bearer JWT | Miembro | Obtiene la llamada grupal activa vinculada a un canal. |
| `GET` | `/:id` | Bearer JWT | Miembro | Obtiene metadatos de la llamada y lista de participantes (404 si es de otro tenant). |
| `GET` | `/:id/participants` | Bearer JWT | Miembro | Obtiene la lista activa de participantes con nombres y avatares. |

---

## 6. RESULTADOS DE LA SUITE DE PRUEBAS AUTOMATIZADAS

### 6.1 Suite Fase 4/5: Group Calls & LiveKit SFU (`scratch/test_phase4_group_calls.ts`)

```text
================================================================================
COLLABPULSE — PHASE 4 / 5: GROUP CALLS & LIVEKIT SFU HARDENING SUITE
================================================================================

  ✓ PASS: Scenario 1: POST /api/v1/group-calls creates room, assigns host role, logs created event
  ✓ PASS: Scenario 2: Multi-Tenant Isolation: User from Tenant B cannot access or view group call
  ✓ PASS: Scenario 3: POST /api/v1/group-calls/:id/invite invites workspace colleague, rejects cross-tenant
  ✓ PASS: Scenario 4: POST /api/v1/group-calls/:id/token generates valid JWT with roomJoin claims
  ✓ PASS: Scenario 5: Cryptographic token verification using TokenVerifier with API secret
  ✓ PASS: Scenario 6: POST /api/v1/group-calls/:id/token/refresh refreshes expiring JWT token
  ✓ PASS: Scenario 7: POST /api/v1/group-calls/:id/join transitions participant to joined
  ✓ PASS: Scenario 8: Capacity Enforcement: 26th join attempt receives HTTP 409 ROOM_FULL
  ✓ PASS: Scenario 9: POST /api/v1/group-calls/:id/mute toggles participant audio and records event
  ✓ PASS: Scenario 10: POST /api/v1/group-calls/:id/video toggles video_enabled and records event
  ✓ PASS: Scenario 11: POST /api/v1/group-calls/:id/leave updates participant to left with left_at
  ✓ PASS: Scenario 12: Host leave migrates host role to next oldest active participant
  ✓ PASS: Scenario 13: Last active participant leaving automatically ends the group call
  ✓ PASS: Scenario 15: Host calls POST /api/v1/group-calls/:id/end and terminates call for all
  ✓ PASS: Scenario 14: POST /api/v1/group-calls/:id/end by non-host returns 403 Forbidden
  ✓ PASS: Scenario 16: LiveKit WebhookReceiver validates authorization header and handles events
  ✓ PASS: Scenario 17: GET /group-calls/:id returns metadata and participant roster
  ✓ PASS: Scenario 18: LiveKit RoomServiceClient successfully connects to local LiveKit container
  ✓ PASS: Scenario 19: SfuManager granular track pause/resume correctly toggles media states
  ✓ PASS: Scenario 20: ParticipantGrid calculates deterministic layout and handles pagination (>12)
  ✓ PASS: Scenario 21: Active speaker priority sorting highlights speaker without displacing grid layout
  ✓ PASS: Scenario 22: Dynamic multi-participant cycle preserves session integrity
  ✓ PASS: Scenario 23: Concurrency Invariant: Incoming 1:1 call pauses group call and restores on hangup
  ✓ PASS: Scenario 24: Idempotent leave and end operations do not throw or corrupt DB
  ✓ PASS: Scenario 25: Database audit trail records all lifecycle events with correct timestamps

================================================================================
TEST SUITE COMPLETE: 25 PASSED, 0 FAILED
================================================================================
```

---

## 7. MATRIZ DE REGRESIÓN COMPLETA DEL SISTEMA

| Suite de Pruebas | Archivo de Prueba | Escenarios | Resultado | Observaciones |
|---|---|---|---|---|
| **Fase 1: Call Engine Core** | `scratch/test_phase1_call_engine.ts` | 42 | **42/42 PASS** | Sin regresiones en signaling, persistencia 1:1 ni FSM. |
| **Fase 2: Call UX & Media Real** | `scratch/test_phase2_call_ux_media.ts` | 23 | **23/23 PASS** | Control de tracks, mute, ventana flotante y teardown intactos. |
| **Fase 3: Multiple Calls (Hold/Swap)** | `scratch/test_phase3_multiple_calls.ts` | 15 | **15/15 PASS** | HOLD, RESUME, SWAP, BUSY y aislamiento de audio verificados. |
| **Fase 4/5: Group Calls & SFU** | `scratch/test_phase4_group_calls.ts` | 25 | **25/25 PASS** | LiveKit SFU, Grid, Webhooks, Roles, Tokens y Concurrencia. |
| **Endpoints HTTP de Llamadas** | `scratch/test_http_endpoints.ts` | 8 | **8/8 PASS** | Endpoints de llamadas 1:1 en Express y PostgreSQL. |
| **Compilación TypeScript** | `npx tsc --noEmit` | N/A | **0 ERRORES** | Tipado estricto verificado en todo el proyecto. |
| **Build de Producción** | `npm run build` | N/A | **PASS** | Bundles de cliente (Vite) y servidor (esbuild) generados. |

---

## 8. PROTOCOLO DE VERIFICACIÓN MANUAL EN NAVEGADOR

Para verificar manualmente las llamadas grupales en el entorno local:
1. **Verificar Servicios en Ejecución:**
   - PostgreSQL en puerto 5432: `docker ps | grep postgres`
   - LiveKit SFU en puerto 7880: `docker ps | grep livekit`
   - Servidor CollabPulse: `http://localhost:3000`
2. **Crear Conferencia Grupal:**
   - Iniciar sesión como `admin@collabpulse.local` / `CollabPulse2026!Admin`.
   - Navegar a un canal o presionar "Iniciar Conferencia Grupal".
   - Confirmar que la ventana flotante `CallWindow` abre en modo grupo mostrando `ParticipantGrid` y los controles de host ("Finalizar sala").
3. **Unirse desde Otra Pestaña / Usuario:**
   - Abrir ventana de incógnito o segundo navegador en `http://localhost:3000`.
   - Iniciar sesión como usuario secundario (ej. `colleague@collabpulse.local`).
   - Unirse a la conferencia grupal desde la notificación o canal.
   - Verificar que el grid se divide automáticamente en 1x2.
4. **Verificar Concurrencia con Llamada 1:1:**
   - Desde una tercera pestaña, llamar al usuario secundario en llamada 1:1.
   - Observar el overlay de llamada entrante sin interrumpir el audio del grupo.
   - Al contestar la llamada 1:1, los flujos del grupo se pausan visualmente con badge "En espera".
   - Al colgar la 1:1, el grupo se reanuda de manera transparente.
5. **Verificar Salida y Finalización:**
   - El usuario participante presiona "Salir": abandona sin cerrar la sala.
   - El host presiona "Finalizar sala": la llamada concluye para todos los participantes simultáneamente.

---

## 9. CONCLUSIÓN Y CIERRE DE FASE

Todas las inconsistencias identificadas en la auditoría de Fase 4 han sido completamente resueltas, implementadas en código de producción, probadas mediante suites de pruebas automatizadas contra LiveKit SFU real y PostgreSQL, y verificadas sin ninguna regresión sobre las Fases 1, 2 y 3.

El motor de conferencias grupales de CollabPulse queda certificado y congelado. **No se avanzó ni se implementó ninguna funcionalidad de chat en llamada ni mensajería, quedando el sistema listo para que el usuario determine el siguiente paso.**
