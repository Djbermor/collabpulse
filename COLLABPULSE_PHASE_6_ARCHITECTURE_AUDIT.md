# COLLABPULSE — FASE 6: AUDITORÍA TÉCNICA DE ARQUITECTURA
## IN-CALL CHAT & MESSAGING — SISTEMA COMPLETO DE MENSAJERÍA Y CHAT EN LLAMADA

**Fecha:** 16 de Septiembre de 2026  
**Documentos Base:**  
- `COLLABPULSE_CALL_ENGINE_AUDIT.md` (Fase 0)
- `COLLABPULSE_PHASE_1_CALL_ENGINE_VALIDATION.md` (Fase 1: 42/42 PASS)
- `COLLABPULSE_PHASE_2_CALL_UX_MEDIA_VALIDATION.md` (Fase 2: 23/23 PASS)
- `COLLABPULSE_PHASE_3_MULTIPLE_CALLS_VALIDATION.md` (Fase 3: 15/15 PASS)
- `COLLABPULSE_PHASE_4_ARCHITECTURE_AUDIT.md` (Fase 4)
- `COLLABPULSE_PHASE_5_GROUP_CALLS_HARDENING_VALIDATION.md` (Fases 4/5: 25/25 PASS)  
**Estado:** PENDIENTE — AUDITORÍA TÉCNICA PREVIA A IMPLEMENTACIÓN  

---

## 1. Arquitectura Actual del Sistema (Fases 1 a 5)

CollabPulse cuenta con una arquitectura en producción verificada con suites de pruebas automatizadas al 100% (105 pruebas pasando, 0 errores de compilación TypeScript y build de producción limpio):

1. **Call Engine Core (Fase 1):**
   - Máquina de estados determinista (`idle`, `ringing_outgoing`, `ringing_incoming`, `connecting`, `active`, `held`, `reconnecting`, `failed`, `ended`).
   - `PeerConnectionManager` gestiona pares WebRTC P2P con drenaje ordenado de ICE candidates e ICE restart.
   - Tokens efímeros HMAC-SHA256, reclamo multi-pestaña de llamadas y control de timeouts.
   - Persistencia relacional en PostgreSQL (`calls`, `call_participants`, `call_history`).

2. **Call UX & Multimedia Real (Fase 2):**
   - `LocalMediaController` centraliza la captura de hardware, silenciamiento de micrófono, apagado de cámara web y screen sharing vía `replaceTrack`.
   - `CallWindow.tsx` actúa como ventana flotante persistente a nivel global con modos `minimized`, `normal` y `fullscreen`, independiente de la navegación.

3. **Multiple Calls: Busy / Hold / Resume / Swap (Fase 3):**
   - Capacidad estricta de 1 llamada activa + 1 llamada en espera + 1 llamada entrante.
   - Conmutación instantánea (`swapCalls`), rechazo por `busy` a terceras llamadas concurrentes y aislamiento de audio estricto en llamada retenida.

4. **Group Calls / LiveKit SFU (Fases 4 y 5):**
   - Integración con servidor LiveKit SFU (`SfuManager.ts`, `livekit-server-sdk`), soporte de hasta 25 participantes simultáneos con topología estrella.
   - Migración determinista de anfitrión (`host`), tokens criptográficos con 15 minutos de vigencia, `ParticipantGrid` dinámico (1x1 a 4x3) y orquestación de pausa/reanudación granular (`pauseGroupCall` / `resumeGroupCall`).

5. **Infraestructura de Mensajería Existente (Fuera de llamada):**
   - En el backend existen rutas para mensajería de canales y conversaciones directas (`server/routes/messages.ts`, `server/routes/conversations.ts`, `server/routes/files.ts`).
   - `realtimeHub` implementa un bus en tiempo real sobre Server-Sent Events (SSE) compatible con la semántica de grupos de SignalR (`channel:{id}`, `conversation:{id}`, `user:{id}`, `workspace:{id}`, `tenant:{id}`).
   - **Limitación crítica detectada en el estado actual de llamadas:** En `CallContext.tsx` y `CallWindow.tsx`, el chat de llamada (`sendInCallMessage`, `chatMessages`) es actualmente un stub en memoria local de React: no está enlazado a PostgreSQL, no utiliza el `realtimeHub`, no soporta estados de entrega ni de lectura, carece de idempotencia real frente a reconexiones, no tiene adjuntos ni reacciones y se pierde al refrescar o cambiar de contexto.

---

## 2. Infraestructura Reutilizable

La Fase 6 no debe reinventar la rueda; dispone de una base sólida y reusable:

| Módulo / Capa | Nivel de Reutilización | Utilidad en Fase 6 |
| :--- | :---: | :--- |
| `server/realtime.ts` (`RealtimeHub`) | **95% Reutilizable** | Transporte en tiempo real de baja latencia con grupos (`conversation:{id}`), tracking de conexiones por usuario y typing indicators con debouncing. |
| `server/middleware.ts` | **100% Reutilizable** | Autenticación JWT (`authenticate`), validación multi-tenant (`req.user.tenantId`) y permisos granulares (`requirePermission`). |
| `server/security.ts` | **100% Reutilizable** | Sanitización XSS (`sanitizeText`), hashing y validación de tokens. |
| `server/routes/files.ts` + `multer` | **90% Reutilizable** | Almacenamiento físico en `uploads/` (hasta 50 MB) con metadatos registrados en tabla `files`. |
| `src/context/CallContext.tsx` | **85% Reutilizable** | Orquesta el ciclo de vida de llamadas 1:1 y de grupo, retención, swap y metadatos de sala/conversación. |
| `src/components/calls/CallWindow.tsx` | **80% Reutilizable** | Shell persistente de la ventana flotante; ya posee el panel lateral (`showInCallChat`) y botón de alternancia. |
| `src/components/chat/ChatArea.tsx` | **75% Reutilizable** | Referencia de UI enriquecida: formateo de mensajes, pickers de emojis, previsualización de adjuntos y respuestas. |

---

## 3. Tablas Existentes y Modelo de Datos en PostgreSQL

### 3.1 Tablas Existentes Relevantes
- `conversations`: `id`, `workspace_id`, `tenant_id`, `type` ('Direct', 'Group'), `name`, `created_at`, `updated_at`.
- `conversation_members`: `id`, `conversation_id`, `user_id`, `workspace_id`, `last_read_at`, `joined_at`.
- `messages`: `id`, `workspace_id`, `tenant_id`, `channel_id`, `conversation_id`, `parent_message_id`, `user_id`, `client_message_id`, `content`, `rich_content`, `attachments`, `is_edited`, `is_pinned`, `reply_count`, `last_reply_at`, `created_at`, `updated_at`, `deleted_at`.
- `message_reactions`: `id`, `message_id`, `user_id`, `emoji`, `created_at`.
- `files`: `id`, `workspace_id`, `tenant_id`, `uploaded_by`, `file_name`, `file_size`, `content_type`, `url`, `created_at`.
- `calls` (1:1): Posee la columna `conversation_id TEXT`.
- `group_calls` (SFU): Posee `channel_id TEXT`, pero requiere vincularse explícitamente a una conversación o generar una de `type: 'call'`.

### 3.2 Nuevas Tablas y Extensiones Requeridas en DDL
1. **Extensión a `conversations`:**
   - Soportar tipos: `'direct'`, `'group'`, `'call'`.
   - Agregar columna `call_id TEXT` (vínculo bidireccional con llamada 1:1 o llamada grupal).
   - Agregar columna `channel_id TEXT` (si la llamada se originó en un canal).
2. **Extensión a `conversation_members`:**
   - Agregar columna `last_read_message_id TEXT REFERENCES messages(id)`.
3. **Extensión a `messages`:**
   - Agregar columna `message_type TEXT NOT NULL DEFAULT 'text'` (`text`, `system`, `file`, `image`, `audio`).
   - Agregar columna `status TEXT NOT NULL DEFAULT 'sent'` (`sending`, `sent`, `delivered`, `read`, `failed`).
4. **Nueva tabla `message_reads` (Read Receipts por usuario):**
   ```sql
   CREATE TABLE IF NOT EXISTS message_reads (
     id TEXT PRIMARY KEY,
     message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
     user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
     UNIQUE(message_id, user_id)
   );
   CREATE INDEX IF NOT EXISTS idx_message_reads_message_id ON message_reads(message_id);
   CREATE INDEX IF NOT EXISTS idx_message_reads_user_id ON message_reads(user_id);
   ```
5. **Nueva tabla `message_deliveries` (Delivery Receipts por usuario):**
   ```sql
   CREATE TABLE IF NOT EXISTS message_deliveries (
     id TEXT PRIMARY KEY,
     message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
     user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     delivered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
     UNIQUE(message_id, user_id)
   );
   CREATE INDEX IF NOT EXISTS idx_message_deliveries_message_id ON message_deliveries(message_id);
   CREATE INDEX IF NOT EXISTS idx_message_deliveries_user_id ON message_deliveries(user_id);
   ```
6. **Nueva tabla `message_attachments` (Adjuntos estructurados):**
   ```sql
   CREATE TABLE IF NOT EXISTS message_attachments (
     id TEXT PRIMARY KEY,
     message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
     file_name TEXT NOT NULL,
     mime_type TEXT NOT NULL,
     size INTEGER NOT NULL,
     storage_key TEXT NOT NULL,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
   );
   CREATE INDEX IF NOT EXISTS idx_message_attachments_msg_id ON message_attachments(message_id);
   ```
7. **Índice de Unicidad en `message_reactions`:**
   - Asegurar `UNIQUE(message_id, user_id, emoji)` para impedir reacciones duplicadas a nivel de base de datos.

---

## 4. APIs Existentes y Endpoints a Extender/Crear

### 4.1 Endpoints Existentes
- `GET /api/v1/conversations`: Lista conversaciones del usuario autenticado.
- `POST /api/v1/conversations`: Crea conversación 1:1 o grupal.
- `GET /api/v1/messages`: Obtiene mensajes con paginación cursor (`channelId`, `conversationId`, `cursor`, `limit`).
- `POST /api/v1/messages`: Envía mensaje con soporte de idempotencia básica en memoria y menciones.
- `PUT /api/v1/messages/:id`: Edita mensaje (solo autor o admin).
- `DELETE /api/v1/messages/:id`: Soft delete de mensaje.
- `POST /api/v1/messages/:id/reactions`: Alterna reacción (emoji).
- `POST /api/v1/files/upload`: Subida física de archivo vía multipart.

### 4.2 Endpoints a Añadir / Ajustar para Fase 6
- `GET /api/v1/conversations/:id`: Obtiene detalle y miembros de una conversación específica.
- `GET /api/v1/conversations/:id/messages`: Paginación por cursor específica para una conversación (`before`, `after`, `limit`).
- `POST /api/v1/conversations/:id/messages`: Envío directo de mensaje en una conversación específica (incluye `clientMessageId`).
- `PATCH /api/v1/messages/:id`: Modificación de contenido respetando permisos del remitente.
- `POST /api/v1/messages/:id/delivered`: Registro de entrega de mensaje para el usuario autenticado (emite `message.delivered` / `MessageDelivered`).
- `POST /api/v1/messages/:id/read`: Registro de lectura de mensaje para el usuario autenticado (emite `message.read` / `MessageRead`).
- `DELETE /api/v1/messages/:id/reactions/:reaction`: Eliminación idempotente de una reacción específica.
- `GET /api/v1/calls/:callId/conversation` y `GET /api/v1/group-calls/:groupCallId/conversation`: Resolución garantizada del ID de conversación asociado a la llamada en curso.

---

## 5. Eventos en Tiempo Real

Para compatibilidad completa con el estándar del proyecto (SignalR sobre SSE) y las especificaciones de la Fase 6, se emitirán eventos con nombres duales o payload normalizado:

| Evento Fase 6 | Evento SignalR Equivalente | Destino | Payload |
| :--- | :--- | :--- | :--- |
| `message.created` | `MessageCreated` | `conversation:{id}` | `{ event, conversationId, messageId, timestamp, payload: Message }` |
| `message.updated` | `MessageUpdated` | `conversation:{id}` | `{ event, conversationId, messageId, timestamp, payload: Message }` |
| `message.deleted` | `MessageDeleted` | `conversation:{id}` | `{ event, conversationId, messageId, timestamp, payload: { messageId } }` |
| `message.delivered` | `MessageDelivered` | `conversation:{id}` | `{ event, conversationId, messageId, timestamp, payload: { messageId, userId, deliveredAt } }` |
| `message.read` | `MessageRead` | `conversation:{id}` | `{ event, conversationId, messageId, timestamp, payload: { messageId, userId, readAt } }` |
| `reaction.created` | `ReactionAdded` | `conversation:{id}` | `{ event, conversationId, messageId, timestamp, payload: { messageId, userId, reaction } }` |
| `reaction.deleted` | `ReactionRemoved` | `conversation:{id}` | `{ event, conversationId, messageId, timestamp, payload: { messageId, userId, reaction } }` |
| `typing.started` | `TypingStarted` | `conversation:{id}` | `{ event, conversationId, timestamp, payload: { userId, userName } }` |
| `typing.stopped` | `TypingStopped` | `conversation:{id}` | `{ event, conversationId, timestamp, payload: { userId, userName } }` |
| `conversation.updated` | `ConversationUpdated` | `conversation:{id}` | `{ event, conversationId, timestamp, payload: Conversation }` |

---

## 6. Componentes Reutilizables de UI

1. **`InCallChatPanel.tsx` (a integrar en `CallWindow.tsx`):**
   - Reemplaza el stub actual en `CallWindow.tsx` por un panel de mensajería completo conectado a la conversación real de la llamada.
   - Contiene:
     - `MessageList`: Lista virtualizada o scrollable con soporte de paginación ascendente ("cargar anteriores").
     - `MessageItem`: Mensaje individual con avatar, nombre, hora, estado de entrega/lectura (checks ✓ / ✓✓), indicador de edición, reacciones interactivas y botón de responder.
     - `MessageComposer`: Input de texto con debounced typing indicator, botón de adjuntar archivos y previsualización de respuesta activa.
     - `TypingIndicator`: Visualización no intrusiva ("X está escribiendo...").
     - `ReactionPicker`: Menú emergente de reacciones básicas (👍 ❤️ 😂 😮 😢 👏).
     - `ReplyPreview`: Barra flotante sobre el composer al responder un mensaje.
     - `AttachmentPreview`: Previsualización de imágenes y archivos subidos.

---

## 7. Dependencias Externas y del Entorno

- **Node.js / Express:** Servidor HTTP y API REST.
- **PostgreSQL / Docker (`collabpulse-dev-postgres`):** Persistencia relacional de todas las entidades.
- **SSE (`realtimeHub`):** Canal de transporte bidireccional / streaming para eventos de aplicación.
- **Multer:** Procesamiento de carga de archivos en disco local.
- **Lucide React:** Iconografía existente para mensajes, estados, adjuntos y reacciones.
- **LiveKit Server (`collabpulse-dev-livekit`):** Servidor SFU para media de Group Calls (independiente de la mensajería).

---

## 8. Análisis de Riesgos

1. **Riesgo de Acoplamiento entre Mensajería y Media WebRTC/SFU:**
   - *Peligro:* Si el chat se transportase mediante DataChannels de WebRTC o LiveKit Data Messages, una llamada en HOLD o una llamada grupal pausada (`pauseGroupCall()`) congelaría la mensajería.
   - *Mitigación:* La mensajería operará exclusivamente sobre la capa de aplicación propia (API REST + SSE `RealtimeHub` + PostgreSQL).
2. **Riesgo de Mensajes Duplicados en Reconexión:**
   - *Peligro:* Al fallar la red temporalmente y reintentar el envío, se pueden insertar múltiples mensajes idénticos.
   - *Mitigación:* Idempotencia obligatoria basada en `clientMessageId` persistido en base de datos e indexado en caché caliente.
3. **Riesgo de Desincronización de Read Receipts en Grupos:**
   - *Peligro:* Marcar un booleano global `message.read = true` generaría que si un usuario lee el mensaje, aparezca leído para todos.
   - *Mitigación:* Almacenamiento relacional por usuario en la tabla `message_reads`.
4. **Riesgo de Romper Invariantes de Fases 1 a 5:**
   - *Peligro:* Tocar la lógica de `PeerConnectionManager`, `SignalingClient` o `SfuManager` podría alterar el comportamiento de Hold/Swap o LiveKit SFU.
   - *Mitigación:* Regla estricta de NO modificar Fases 1 a 5. La integración se realizará únicamente en la capa superior (`CallContext` y `CallWindow`).

---

## 9. Incompatibilidades Detectadas y Solución

| Incompatibilidad Detectada | Causa Raíz | Solución en Fase 6 |
| :--- | :--- | :--- |
| `CallContext.tsx` usa array `chatMessages` local | Prototipo inicial en memoria | Conectar `CallContext` al servicio de mensajería real persistente, resolviendo la conversación asociada (`conversationId`). |
| `group_calls` no tiene `conversation_id` | Fase 4 modeló únicamente medios SFU | Enlazar de forma determinista la llamada grupal con una conversación relacional de tipo `'call'` en la creación de la llamada. |
| Inexistencia de tabla para Read Receipts por usuario | El esquema previo solo tenía `last_read_at` a nivel de conversación | Crear la tabla `message_reads` y `message_deliveries` con clave única `(message_id, user_id)`. |
| Falta de estados del mensaje en base de datos (`status`) | La tabla `messages` solo guardaba el texto y fecha | Agregar la columna `status` (`sending`, `sent`, `delivered`, `read`, `failed`) y `message_type`. |

---

## 10. Propuesta de Implementación y Plan de Ejecución

1. **Paso 1: DDL y Modelo de Datos en PostgreSQL:**
   - Extender tablas `messages`, `conversations` y `conversation_members`.
   - Crear tablas `message_reads`, `message_deliveries` y `message_attachments`.
   - Crear índices de optimización para búsqueda por `conversation_id` y cursor cronológico.

2. **Paso 2: Backend REST API & RealtimeHub:**
   - Ampliar `server/routes/messages.ts` y `server/routes/conversations.ts` con todos los endpoints requeridos (entrega, lectura, reacciones atómicas, paginación cursor, idempotencia estricta).
   - Agregar métodos en `realtimeHub` para emitir eventos estandarizados (`message.created`, `message.delivered`, `message.read`, `reaction.created`, etc.).

3. **Paso 3: Asociación Automática de Conversación con Llamadas 1:1 y Group Calls:**
   - Al iniciar una llamada 1:1, asociar o crear una conversación directa entre ambos usuarios.
   - Al iniciar una llamada grupal, crear automáticamente una conversación de `type: 'call'` con los participantes de la sala.

4. **Paso 4: Frontend Call Integration & UI:**
   - Actualizar `CallContext.tsx` para sincronizar los mensajes reales de la conversación de la llamada activa o retenida.
   - Implementar el panel de chat en `CallWindow.tsx` con estados de envío, reintento ante fallos, reacciones, respuestas, adjuntos y visualización responsive.

5. **Paso 5: Suite de Validación Automatizada:**
   - Desarrollar `scratch/test_phase6_messaging.ts` con cobertura total de los requisitos.
   - Ejecutar regresión completa de Fases 1, 2, 3, 4/5, TypeScript y Build de producción.
