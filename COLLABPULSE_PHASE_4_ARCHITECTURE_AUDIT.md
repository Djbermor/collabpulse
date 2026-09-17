# COLLABPULSE — FASE 4: AUDITORÍA TÉCNICA DE ARQUITECTURA
## GROUP CALLS / SFU / MULTI-PARTICIPANT CONFERENCING

**Fecha:** 16 de Septiembre de 2026  
**Documentos Base:** `COLLABPULSE_CALL_ENGINE_AUDIT.md`, `COLLABPULSE_PHASE_1_CALL_ENGINE_VALIDATION.md`, `COLLABPULSE_PHASE_2_CALL_UX_MEDIA_VALIDATION.md`, `COLLABPULSE_PHASE_3_MULTIPLE_CALLS_VALIDATION.md`  
**Estado:** Documento previo a la implementación de Fase 4  

---

## 1. Arquitectura Actual del Call Engine (Fases 1, 2 y 3)

El sistema de llamadas de CollabPulse actualmente opera con las siguientes garantías y componentes consolidados:

1. **Gestión Multimedia Local (`LocalMediaController.ts`):**
   - Control centralizado de hardware local (`getUserMedia`), resolución adaptativa, mute de micrófono y alternancia de cámara web.
   - Desacople del ciclo de vida del hardware respecto a los componentes de UI y navegación en React.
   - Mapeo de errores DOM amigables en español (`mediaErrors.ts`).

2. **Orquestación P2P y Multi-Llamada (`PeerConnectionManager.ts`):**
   - Mantiene un registro de conexiones peer indexado por `remoteUserId`: `Map<string, PeerConnectionContext>`.
   - Diseñado para llamadas directas 1:1, retención (`hold`), reanudación (`resume`) y conmutación (`swap`) entre dos conexiones independientes (1 activa + 1 en espera).
   - Manipulación de transceptores en caliente con `replaceVideoTrack()` para screen sharing y promoción de audio a video.

3. **Señalización Corporativa (`SignalingClient.ts` + `realtimeHub` SSE):**
   - Emisión de ofertas, respuestas, candidatos ICE y eventos de control (`hold`, `resume`, `reject`, `end`) vía HTTP POST `/api/v1/calls/signal`.
   - Recepción en tiempo real mediante Server-Sent Events (SSE) multiplexados en `/api/v1/realtime/stream`.
   - Claims atómicos multi-pestaña y tokens efímeros firmados con HMAC-SHA256.

4. **Persistencia y Aislamiento Multi-Tenant (`server/routes/calls.ts` y PostgreSQL):**
   - Tablas `calls`, `call_participants` y `call_history`.
   - Validación estricta por `tenant_id` y `workspace_id`: peticiones cruzadas son rechazadas con HTTP 403 `TENANT_MISMATCH` o HTTP 404 `WORKSPACE_NOT_FOUND`.

5. **Experiencia de Usuario Persistente (`CallWindow.tsx` y `IncomingCallModal.tsx`):**
   - Modos de ventana (`minimized`, `normal`, `fullscreen`).
   - Conmutador de llamadas en cabecera, banner in-call para segunda llamada entrante, audio remoto desacoplado y overlay visual de espera.

---

## 2. Limitaciones de la Arquitectura Actual para Llamadas Grupales

La arquitectura P2P de las Fases 1–3 es intencionalmente óptima para 1:1, pero presenta barreras técnicas insalvables si se intenta usar en conferencias multiparticipante:

1. **Explosión Cuadrática de Ancho de Banda y CPU (Malla P2P / Full Mesh):**
   - En una topología Full Mesh, cada participante debe codificar y transmitir $N-1$ flujos de video/audio y decodificar otros $N-1$ flujos.
   - Número total de conexiones en la sala: $N(N-1)$. Para 5 participantes = 20 conexiones; para 10 participantes = 90 conexiones.
   - En clientes móviles o estaciones de trabajo estándar, la CPU y el ancho de banda de subida (uplink) colapsan a partir de 3–4 participantes, generando congelamientos de video, pérdida de paquetes y latencia inaceptable.

2. **Ausencia de Ruteo Inteligente de Medios y Calidad Adaptativa (Simulcast / Dynacast):**
   - En P2P no existe un nodo intermedio que pueda recibir un flujo en alta calidad (1080p/720p) y reenviarlo a diferentes resoluciones según la capacidad de recepción de cada cliente o según el tamaño del tile en el grid (Dynacast).

3. **Inexistencia de Detección Centralizada de Hablante Activo (Active Speaker):**
   - En P2P cada cliente tendría que analizar localmente las pistas de audio de todos los pares remotos, multiplicando el cómputo de audio del navegador.

4. **Inestabilidad en Join / Leave Dinámico:**
   - La entrada o salida de un participante en una malla P2P obliga a renegociar simultáneamente $N-1$ conexiones `RTCPeerConnection` con ofertas/respuestas concurrentes, generando estados de "glare" (colisión de ofertas) e inconsistencias de estado.

---

## 3. Componentes Reutilizables de Fases 1–3

La implementación de la Fase 4 reutilizará los cimientos probados sin reinventar la rueda:

| Componente | Nivel de Reutilización | Justificación |
| :--- | :---: | :--- |
| `LocalMediaController.ts` | **100% Reutilizable** | Gestiona captura de cámara, micrófono, resoluciones ideales y `replaceTrack` de pantalla. |
| `mediaErrors.ts` | **100% Reutilizable** | Traducción amigable de excepciones de hardware y permisos a español. |
| `sound.ts` | **100% Reutilizable** | Tonos de timbrado, entrada, salida y fin de llamada. |
| `server/middleware.ts` | **100% Reutilizable** | Autenticación JWT Firebase/Node y aislamiento de tenant y workspace. |
| `realtimeHub` (SSE) | **100% Reutilizable** | Canal para eventos de notificación grupal (`GroupCallCreated`, `ParticipantJoined`, etc.). |
| `VideoTile.tsx` | **80% Reutilizable** | Base para renderizar tracks multimedia desacoplados con soporte autoplay. |
| Esquema PostgreSQL | **80% Reutilizable** | Tablas `calls`, `call_participants` y `call_history` listas para sesiones con `type = 'group'`. |

---

## 4. Componentes que Requieren Extensión o Nuevas Creaciones

1. **Nuevo Adaptador de Medios SFU (`SfuManager.ts` / `LiveKitAdapter.ts`):**
   - Abstracción de conexión hacia el servidor SFU para salas grupales.
   - Publicación de tracks locales (micrófono, cámara, pantalla) mediante un único upstream.
   - Suscripción a tracks remotos desde el downstream del SFU con reenvío selectivo.
   - Detección de `activeSpeakers` basada en eventos del SFU.

2. **Nuevos Endpoints Backend para Llamadas Grupales (`server/routes/groupCalls.ts`):**
   - `POST /api/v1/group-calls`: Creación de la sala con asignación de host.
   - `POST /api/v1/group-calls/:id/invite`: Envío de invitaciones a múltiples usuarios.
   - `POST /api/v1/group-calls/:id/join`: Registro de ingreso de participante.
   - `POST /api/v1/group-calls/:id/leave`: Salida limpia de un participante.
   - `POST /api/v1/group-calls/:id/end`: Finalización autorizada por el host.
   - `POST /api/v1/group-calls/:id/token`: Generación de token criptográfico efímero de SFU con permisos específicos.
   - `GET /api/v1/group-calls/:id`: Consulta de estado y membresía.
   - `GET /api/v1/group-calls/:id/participants`: Listado en tiempo real de participantes y sus estados.

3. **Nuevas Vistas y Componentes UI:**
   - `ParticipantGrid.tsx`: Cuadrícula responsiva que acomoda dinámicamente desde 1 hasta 12+ participantes (1x1, 1x2, 2x2, 3x2, 3x3).
   - `ParticipantTile.tsx`: Tarjeta individual con indicador de estado (micrófono muteado, cámara apagada, avatar con iniciales, borde iluminado de hablante activo).
   - `GroupCallControls.tsx`: Barra de controles enriquecida con controles de host (`Finalizar para todos`) y participante (`Abandonar`), screen share y selector de vistas.
   - `GroupCallWindow.tsx` o extensión desacoplada de `CallWindow.tsx`: Integración armónica en la ventana flotante persistente existente.

4. **Extensión de `CallContext.tsx`:**
   - Soporte para alternar fluidamente entre modo `1:1` (usando `PeerConnectionManager`) y modo `group` (usando `SfuManager`).
   - Política de concurrencia: si el usuario está en una conferencia grupal y recibe una llamada individual 1:1, se muestra el in-call overlay para decidir si rechazar la entrante o poner en pausa/silencio su presencia en la grupal.

---

## 5. Evaluación y Selección de la Arquitectura SFU

Se evaluaron formalmente tres alternativas líderes de la industria:

### A. mediasoup (Node.js C++ Worker)
- *Pros:* Muy bajo consumo de recursos, control milimétrico a nivel de RTP.
- *Contras:* Requiere compilación nativa en C++ (`node-gyp`, Python, toolchains específicas de Visual Studio en Windows). Históricamente propenso a fallos de instalación en entornos Windows y CI. Además, no incluye señalización out-of-the-box, requiriendo implementar cientos de líneas de protocolo manual para creación de routers, transports, producers y consumers.

### B. Janus Gateway
- *Pros:* Probado, desarrollado en C, soporta plugins de videoconferencia.
- *Contras:* Protocolo propio JSON-RPC sobre WebSockets poco ergonómico en TypeScript, SDK de cliente anticuado, arquitectura compleja para escalar en contenedores modernos de Google Cloud.

### C. LiveKit (Elegido)
- *Pros:*
  1. **Arquitectura y Rendimiento:** Motor SFU moderno escrito en Go, con soporte nativo para Simulcast, Dynacast, adaptive bitrate y control de congestión de última generación.
  2. **SDKs de Primer Nivel:**
     - Cliente: `livekit-client` en TypeScript puro, sin dependencias nativas, 100% compatible con React 19 y Vite.
     - Servidor: `livekit-server-sdk` para Node.js, que genera `AccessToken` con firma criptográfica JWT y permisos exhaustivos (canPublish, canSubscribe, roomAdmin).
  3. **Separación de Responsabilidades Impecable:**
     ```text
     CollabPulse Backend (Express + PostgreSQL)
           │ (Auth, Tenant, Workspace, Permisos, Roles, Room Members)
           ▼
     Emite SFU JWT Token con Claims Estrictos
           │
           ▼
     Navegador del Usuario (React 19)
           │
           ▼ (Downstream/Upstream WebRTC)
     LiveKit SFU Server (Contenedor Docker / Cloud Run / GKE)
     ```
  4. **Desarrollo Local y Despliegue Cloud:** Imagen oficial de Docker ligera y disponible (`livekit/livekit-server:latest`), ejecutable en local en un comando y desplegable a producción en Google Cloud (GKE o Compute Engine) o conectable a LiveKit Cloud con cero cambios en el código de la aplicación.
  5. **Detección Nativas de Hablante Activo:** LiveKit calcula los niveles de audio en el SFU y emite eventos `ActiveSpeakersChanged` instantáneamente.

**Decisión:** Se selecciona **LiveKit** como el SFU de CollabPulse para la Fase 4.

---

## 6. Modelo de Datos para Llamadas Grupales (PostgreSQL)

Se extenderá el esquema en `server/bootstrap.ts` creando tablas dedicadas con aislamiento multi-tenant:

```sql
-- Tabla principal de conferencias grupales
CREATE TABLE IF NOT EXISTS group_calls (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  room_id TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL DEFAULT 'Conferencia Grupal',
  creator_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  media_type TEXT NOT NULL DEFAULT 'video',
  status TEXT NOT NULL DEFAULT 'active', -- 'active' | 'ended'
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  ended_at TIMESTAMP WITH TIME ZONE,
  duration_seconds INTEGER DEFAULT 0,
  max_participants INTEGER DEFAULT 25,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Participantes de la conferencia grupal
CREATE TABLE IF NOT EXISTS group_call_participants (
  id TEXT PRIMARY KEY,
  group_call_id TEXT NOT NULL REFERENCES group_calls(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'participant', -- 'host' | 'participant'
  status TEXT NOT NULL DEFAULT 'joined', -- 'invited' | 'joined' | 'left' | 'disconnected'
  audio_enabled BOOLEAN NOT NULL DEFAULT true,
  video_enabled BOOLEAN NOT NULL DEFAULT true,
  screen_sharing_enabled BOOLEAN NOT NULL DEFAULT false,
  connection_state TEXT NOT NULL DEFAULT 'connected',
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  left_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Auditoría de eventos de conferencia
CREATE TABLE IF NOT EXISTS group_call_events (
  id TEXT PRIMARY KEY,
  group_call_id TEXT NOT NULL REFERENCES group_calls(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- 'created' | 'invited' | 'joined' | 'left' | 'muted' | 'unmuted' | 'ended'
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_group_calls_tenant ON group_calls(tenant_id);
CREATE INDEX IF NOT EXISTS idx_group_calls_room ON group_calls(room_id);
CREATE INDEX IF NOT EXISTS idx_group_call_parts_call ON group_call_participants(group_call_id);
CREATE INDEX IF NOT EXISTS idx_group_call_parts_user ON group_call_participants(user_id);
```

---

## 7. Análisis de Riesgos y Mitigaciones

| Riesgo | Probabilidad | Impacto | Estrategia de Mitigación |
| :--- | :---: | :---: | :--- |
| Contenedor Docker de LiveKit no disponible en el entorno local | Media | Alto | Verificación previa de Docker; contenedor configurado con variables de entorno claras y soporte de fallback informativo si el puerto está ocupado. |
| Regresión en llamadas 1:1 de Fases 1–3 | Baja | Crítico | Separación estricta en `CallContext`: llamadas 1:1 continúan canalizándose por `PeerConnectionManager`. Los tests automatizados de Fases 1, 2 y 3 se ejecutan en cada paso. |
| Fuga de seguridad multi-tenant en tokens SFU | Baja | Crítico | El backend de CollabPulse genera los tokens SFU firmados con `API_SECRET`. El token solo otorga acceso a `room_id = call.room_id` verificado contra el `tenantId` de la sesión. |
| Acoplamiento excesivo en UI entre 1:1 y Grupo | Media | Medio | Creación de componentes modulares (`ParticipantGrid`, `ParticipantTile`) que se montan condicionalmente según `activeSession.type === 'group'`. |

---

## 8. Estrategia de Rollback

1. **Aislamiento de Módulos:**
   - Toda la lógica del SFU residirá en `src/services/call/SfuManager.ts` y `server/routes/groupCalls.ts`.
   - Si se requiere deshabilitar temporalmente la funcionalidad grupal, las rutas 1:1 (`/api/v1/calls/*`) y `PeerConnectionManager.ts` permanecen intactos.
2. **Esquema de Base de Datos Aditivo:**
   - Las nuevas tablas `group_calls`, `group_call_participants` y `group_call_events` son aditivas y no modifican ni eliminan campos de `calls` ni `call_participants`.
3. **Compatibilidad Inversa Garantizada:**
   - Todas las pruebas de Fase 1 (42 tests), Fase 2 (23 tests) y Fase 3 (15 tests) continuarán pasando al 100%.
