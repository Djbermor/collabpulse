# COLLABPULSE — FASE 6: IN-CALL CHAT & MESSAGING IMPLEMENTATION

## 1. Visión General

La **Fase 6** dota a CollabPulse de una arquitectura de mensajería empresarial en tiempo real plenamente integrada con los motores de llamada 1:1 (WebRTC peer-to-peer de Fases 1-3) y conferencias grupales SFU (LiveKit de Fases 4-5).

Toda llamada activa cuenta ahora con una **conversación persistente vinculada** (`callConversationId`), permitiendo a los participantes comunicarse por texto, adjuntar archivos y reaccionar sin perder el historial al colgar la llamada.

---

## 2. Cambios en la Capa de Base de Datos y Persistencia

### 2.1 Tablas y Columnas Creadas (`src/db/schema.ts` y `server/bootstrap.ts`)
1. **`messages`**:
   - `message_type`: `'text' | 'system' | 'file' | 'image' | 'audio'` (por defecto `'text'`).
   - `status`: `'sending' | 'sent' | 'delivered' | 'read' | 'failed'` (por defecto `'sent'`).
   - `client_message_id`: Clave de idempotencia única para prevenir mensajes duplicados en reconexiones.
2. **`conversation_members`**:
   - `last_read_message_id`: Cursor o marca temporal del último mensaje leído por cada miembro.
3. **`message_reads`**:
   - Tabla relacional para seguimiento multi-usuario de confirmaciones de lectura (`id`, `message_id`, `user_id`, `read_at`).
4. **`message_deliveries`**:
   - Confirmación de entrega por dispositivo/usuario (`id`, `message_id`, `user_id`, `delivered_at`).

### 2.2 Métodos de Persistencia en `server/db.ts`
- `findOrCreateCallConversation`: Localiza la conversación existente vinculada a la llamada o crea una nueva con los miembros participantes, emitiendo el mensaje de sistema inicial.
- `persistSystemMessage`: Inserta mensajes del sistema (`"📞 Conferencia iniciada"`, `"📞 Llamada finalizada"`) respetando la integridad referencial con `users`.
- `persistMessageRead`: Registra lecturas de mensajes e informa al SSE Hub.
- `persistMessageDelivered`: Registra entregas de mensajes.
- `findMessageByClientId`: Consulta idempotente para responder de inmediato sin duplicar filas.

---

## 3. Endpoints de API REST & SSE Signaling

### 3.1 Conversaciones (`server/routes/conversations.ts`)
- `POST /api/v1/conversations`: Creación o recuperación de conversación 1:1 o grupal dentro del mismo tenant.
- `GET /api/v1/conversations/:id`: Obtención de metadatos, miembros y estado.
- `GET /api/v1/conversations/:id/messages`: Recuperación paginada con cursor de mensajes del chat.
- `POST /api/v1/conversations/:id/messages`: Envío directo de mensajes con validación de idempotencia por `clientMessageId`.

### 3.2 Mensajes y Recibos (`server/routes/messages.ts`)
- `POST /api/v1/messages/:id/delivered`: Registro de acuse de entrega.
- `POST /api/v1/messages/:id/read`: Acuse de lectura que resetea el contador de no leídos.
- `DELETE /api/v1/messages/:id/reactions/:emoji`: Retiro de reacción por parte del usuario.

### 3.3 Integración con el Motor de Llamadas (`calls.ts` y `groupCalls.ts`)
- Al llamar a `POST /api/v1/calls/invite`, se crea/vincula la conversación y se devuelve `callConversationId` tanto en la respuesta HTTP como en el evento de señalización SSE `IncomingCall`.
- Al crear una sala grupal en `POST /api/v1/group-calls`, se auto-asigna la conversación y se emite `callConversationId` a los participantes en `GroupCallCreated`.

---

## 4. Frontend & Experiencia de Usuario

### 4.1 Componente `InCallChatPanel.tsx`
- Ubicación: `src/components/chat/InCallChatPanel.tsx`.
- Diseño glassmorphism flotante / drawer lateral de alta fidelidad estética.
- Estados de mensaje visuales con iconos Lucide:
  - 🕒 Reloj: `sending`
  - ✓ Un check gris: `sent`
  - ✓✓ Doble check gris: `delivered`
  - ✓✓ Doble check azul: `read`
- Subida de archivos con previsualización de miniaturas y eliminación previa al envío.
- Selector de emojis rápidos y soporte para añadir o retirar reacciones.
- Escucha automática de eventos `MessageCreated` y `MessageReactionUpdated` via SSE.

### 4.2 Integración en Ventanas de Llamada
- **`CallWindow.tsx`**: Botón de chat con contador de mensajes no leídos (badge numérico); abre y cierra el panel dinámicamente.
- **`GroupCallWindow.tsx`**: Integración con las conferencias grupales de LiveKit, vinculando a los múltiples participantes.
