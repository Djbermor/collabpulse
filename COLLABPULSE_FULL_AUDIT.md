# COLLABPULSE — FULL AUDIT & REPOSITORY INVENTORY

**Fecha:** 16 de Septiembre de 2026  
**Tipo de Documento:** Inventario Técnico de Arquitectura, Componentes, Infraestructura y Pruebas  
**Regla de Ejecución:** Auditoría Estricta sin Implementación ni Alteración de Código

---

## 1. Inventario General del Repositorio

El repositorio `collabpulse---enterprise-communication-platform` contiene una aplicación activa basada en Node.js, Express, TypeScript, Vite, React 19, LiveKit SFU y PostgreSQL, junto con subproyectos residuales (.NET y Angular).

### 1.1 Estructura del Árbol Principal
- **`server.ts`**: Punto de entrada del servidor unificado. Integra middleware de Express, inicialización de base de datos PostgreSQL, servidor de desarrollo Vite SPA (o servicio estático en producción), hub de eventos en tiempo real SSE/SignalR y servidor HTTP en puerto 3000.
- **`server/`**:
  - `bootstrap.ts`: Inicialización DDL de PostgreSQL, creación de tablas, índices y extensión `unaccent`.
  - `db.ts`: Capa de persistencia centralizada en memoria y base de datos relacional (`CollabDatabase`).
  - `realtime.ts`: Hub de señalización en tiempo real (`RealtimeHub`) mediante Server-Sent Events (SSE).
  - `security.ts`: Funciones criptográficas JWT, hashing y saneamiento de entradas.
  - `middleware.ts`: Autenticación, autorización basada en roles y permisos, correlación de solicitudes.
  - `routes/`: Endpoints REST (`auth`, `calls`, `groupCalls`, `conversations`, `messages`, `channels`, `workspaces`, `organizations`, `tasks`, `calendar`, `meetings`, `files`, `notifications`, `search`, `admin`, `signaling`).
- **`src/`**: Aplicación de Frontend (React 19 + TypeScript + Vite):
  - `components/`: Componentes de interfaz (`calls/CallWindow.tsx`, `calls/GroupCallWindow.tsx`, `chat/InCallChatPanel.tsx`, etc.).
  - `context/`: Proveedores de contexto (`CallContext.tsx`, `AppContext.tsx`).
  - `services/`: Clientes de servicio (`call/PeerConnectionManager.ts`, `call/LocalMediaController.ts`, `livekit/SfuManager.ts`, `api.ts`).
  - `db/`: Conexión de PostgreSQL pool y esquema Drizzle (`schema.ts`).
- **`scratch/`**: Scripts de pruebas automatizadas y utilidades de inspección.
- **`scripts/`**: Scripts de auditoría, persistencia y migración.
- **`backend/`**: Proyecto legacy/alternativo en .NET 8 (Clean Architecture C#). No forma parte del runtime principal.
- **`frontend/`**: Proyecto legacy/alternativo en Angular 18 con tests Playwright desvinculados (`frontend/node_modules` no existe).

---

## 2. Inventario de Infraestructura y Entorno

### 2.1 Variables de Entorno (`.env`)
- `NODE_ENV`: `development`
- `PORT`: `3000`
- `POSTGRES_HOST`: `localhost`, `POSTGRES_PORT`: `5432`, `POSTGRES_DB`: `collabpulse_dev`
- `LIVEKIT_URL`: `ws://127.0.0.1:7880`
- `LIVEKIT_API_KEY`: `devkey`, `LIVEKIT_API_SECRET`: `secret`
- `MAX_GROUP_PARTICIPANTS`: `25`

### 2.2 Contenedores Docker Activos
- **`collabpulse-dev-postgres`**:
  - Imagen: `postgres:16-alpine`
  - Puertos: `0.0.0.0:5432->5432/tcp`
  - Estado: Activo y saludable (`Up 29 hours (healthy)`).
- **`collabpulse-dev-livekit`**:
  - Imagen: `livekit/livekit-server:latest`
  - Puertos: `0.0.0.0:7880-7881->7880-7881/tcp`, `0.0.0.0:7882->7882/udp`
  - Estado: Activo (`Up 3 hours`).

---

## 3. Inventario Completo de Pruebas Existentes

A continuación se detalla cada suite de prueba localizada en el proyecto, su objetivo, dependencias, lo que realmente valida y lo que omite:

| Test / Archivo | Tipo | Dependencias | Qué Valida Realmente | Qué NO Valida | Clasificación |
|---|---|---|---|---|---|
| `scratch/test_http_endpoints.ts` | Integración HTTP/DB | Servidor HTTP puerto 3000, PostgreSQL | Respuestas HTTP 200/409/403 de `/calls/*`, reclamo multi-pestaña, rechazo multi-tenant | No valida WebRTC, audio/video real ni interfaz gráfica | **PARTIAL** |
| `scratch/test_phase1_call_engine.ts` | Unitario Sintético + DB | PostgreSQL | Inserción en tablas `calls`, `call_participants`, `call_history`. Validaciones sobre estructuras en memoria | No valida conexiones WebRTC reales, ICE real, STUN/TURN ni audio | **PARTIAL / SYNTHETIC** |
| `scratch/test_phase2_call_ux_media.ts` | Mocks Unitarios | Ninguna (Node.js) | Mapeo de errores DOMException (`formatMediaError`). Propiedades sobre objetos mock en memoria | No valida navegador, cámara, micrófono, video ni pantalla real | **SUPERFICIAL / MOCK** |
| `scratch/test_phase3_multiple_calls.ts` | Mocks + Integración HTTP | Servidor HTTP puerto 3000, PostgreSQL | Endpoints `/calls/hold` y `/calls/resume`, persistencia de estado 'held', aislamiento multi-tenant | No valida aislamiento de audio en navegador, mezcla WebRTC ni UI | **PARTIAL / SYNTHETIC** |
| `scratch/test_phase4_group_calls.ts` | Backend HTTP + LiveKit RPC | Servidor HTTP puerto 3000, PostgreSQL, LiveKit SFU | Endpoints `/group-calls`, límite de 25 participantes, conexión RPC a LiveKit, firma/verificación JWT | No valida clientes WebRTC reales en navegador negociando streams con LiveKit SFU | **PARTIAL** |
| `scratch/test_phase6_messaging.ts` | Backend HTTP + DB | Servidor HTTP puerto 3000, PostgreSQL | Conversaciones, idempotencia por `clientMessageId`, recibos `/delivered` y `/read`, vinculación de llamada | No valida cliente visual `InCallChatPanel`, streaming SSE en tiempo real ni subida física de archivos | **PARTIAL** |
| `scratch/test_webrtc_calls.ts` | Integración SSE/REST | Servidor HTTP puerto 3000 | Flujo completo de señalización SSE (invitación, respuesta, SDP offer/answer, candidatos ICE, colgado) | No valida transporte WebRTC peer-to-peer ni transmisión de audio/video real | **PARTIAL** |
| `scratch/test_e2e_features.ts` | Integración REST/DB | Servidor HTTP puerto 3000, PostgreSQL | Autenticación, organizaciones, subida física de archivos multer, búsqueda sin acentos, comentarios | No valida interfaz de usuario (React DOM) | **PARTIAL** |
| `scripts/e2e_persistence_test.ts` | Integración REST/DB | Servidor HTTP puerto 3000, PostgreSQL | Ciclo de vida auth, creación y lectura de workspace, canal, mensaje, tarea y evento tras refresco | No valida navegador web | **PARTIAL** |
| `scripts/comprehensive_e2e_audit.ts` | E2E Script | DB limpia (exactamente 1 usuario) | Flujo rígido de inicialización de plataforma | Falla de inmediato si la DB contiene más de un usuario (no es idempotente) | **BROKEN** |
| `frontend/e2e/*.spec.ts` | Playwright E2E | Angular frontend en puerto 4200 | Especificaciones E2E para proyecto Angular no mantenido | Incompatible con la aplicación principal React | **INVALID / ABANDONED** |
| `tests/performance/messages.js` | Prueba de carga k6 | Herramienta externa k6 | Script de rendimiento para endpoints de mensajería | Requiere instalación de k6; no ejecutado en pruebas funcionales | **NOT RUN** |

---

## 4. Estado de los Componentes Arquitectónicos

### 4.1 Backend (Node.js / Express)
- Estado: **OPERACIONAL**.
- Servidor ejecutándose en `http://0.0.0.0:3000`.
- Compilación de TypeScript: 0 errores (`npx tsc --noEmit`).
- Empaquetado con Vite y esbuild: Exitoso (`npm run build`).

### 4.2 Base de Datos (PostgreSQL 16)
- Estado: **CONECTADO Y VERIFICADO**.
- Docker `collabpulse-dev-postgres` en puerto 5432.
- Esquema Drizzle y tablas verificadas.
- Incidencia detectada: En `server/routes/auth.ts`, la asignación de miembros a organizaciones falla con violación de clave foránea `organization_members_organization_id_fkey` cuando se registra un usuario en un tenant sin crear previamente la fila en la tabla `organizations`.

### 4.3 Servidor LiveKit SFU
- Estado: **CONTENEDOR ACTIVO**.
- Docker `collabpulse-dev-livekit` en puertos 7880, 7881, 7882.
- Conexión Twirp / RPC mediante `RoomServiceClient` probada y operativa.
- Validación criptográfica de tokens con clave y secreto de desarrollo exitosa.

### 4.4 Capa de Señalización en Tiempo Real (SSE)
- Estado: **OPERACIONAL**.
- Hub `/api/v1/realtime/stream` entrega eventos de conexión, señalización WebRTC (`IncomingCall`, `CallResponse`, `WebRTCSignal`, `CallEnded`) y mensajería.
