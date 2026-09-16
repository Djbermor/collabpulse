# Contrato y Catálogo de Endpoints de la API REST

## 1. Convenciones Globales
- **Base URL:** `/api/v1`
- **Autenticación:** Cabecera `Authorization: Bearer <jwt_token>`
- **Contexto Multi-tenant:** Cabecera `X-Tenant-Id: <guid>`
- **Content-Type:** `application/json`
- **Respuestas de Error:** RFC 7807 `application/problem+json`

## 2. Catálogo de Endpoints

### Autenticación (`/api/v1/auth`)
- `POST /register` — Registro de nuevo usuario y creación de credenciales.
- `POST /login` — Inicio de sesión, retorna JWT y Refresh Token.
- `POST /refresh-token` — Renovación de sesión expirada.
- `POST /forgot-password` — Solicitud de enlace seguro de recuperación.
- `POST /reset-password` — Restablecimiento de contraseña mediante token.

### Espacios de Trabajo (`/api/v1/workspaces`)
- `GET /` — Listar workspaces del usuario actual.
- `POST /` — Crear nuevo workspace empresarial.
- `GET /{id}` — Obtener detalles y miembros.
- `POST /{id}/invitations` — Invitar colaboradores por correo.

### Canales (`/api/v1/channels`)
- `GET /` — Listar canales accesibles del workspace.
- `POST /` — Crear canal público o privado.
- `GET /{id}` — Detalles del canal y miembros.
- `POST /{id}/members` — Agregar miembro al canal.
- `DELETE /{id}/members/{userId}` — Salir o remover miembro.

### Mensajería e Hilos (`/api/v1/messages`)
- `GET /` — Obtener mensajes con paginación cursor-based `(channelId, page, pageSize)`.
- `POST /` — Enviar mensaje estándar o enriquecido.
- `PUT /{id}` — Editar mensaje propio.
- `DELETE /{id}` — Eliminación suave (soft delete).
- `POST /{id}/reactions` — Agregar reacción emoji.
- `DELETE /{id}/reactions/{code}` — Quitar reacción.

### Tareas (`/api/v1/tasks`)
- `GET /` — Listar tareas filtradas por estado y prioridad.
- `POST /` — Crear tarea asignada a un miembro.
- `PUT /{id}/status` — Actualizar progreso (Pending -> InProgress -> Completed).

### Calendario y Reuniones (`/api/v1/calendar`, `/api/v1/meetings`)
- `GET /calendar` — Obtener eventos programados en rango de fechas.
- `POST /calendar` — Agendar evento o reunión de equipo.
- `POST /meetings/start` — Iniciar videollamada instantánea con tokens WebRTC.
