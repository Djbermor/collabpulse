# CollabPulse Enterprise — Feature Traceability Matrix
**Versión:** 1.0.0-PROD | **Documento Normativo:** FEATURE_MATRIX.md

---

## Matriz de Trazabilidad de Funcionalidades, Endpoints y Pruebas

| Módulo | Funcionalidad / Requisito | Endpoint / Canal | Rol Mínimo (RBAC) | Pruebas Unitarias | Pruebas Integración | Escenario E2E | Estado |
| :--- | :--- | :--- | :---: | :--- | :--- | :--- | :---: |
| **Auth** | Registro de Tenant y Owner | `POST /api/v1/auth/register-tenant` | Anónimo | `RegisterTenantValidatorTests` | `RegisterTenantIntegrationTest` | `auth.spec.ts: Register` | VERIFICADO |
| **Auth** | Login con Credenciales | `POST /api/v1/auth/login` | Anónimo | `LoginCommandHandlerTests` | `LoginRateLimitIntegrationTest` | `auth.spec.ts: Login` | VERIFICADO |
| **Auth** | Rotación de Refresh Token | `POST /api/v1/auth/refresh` | Token Activo | `RefreshTokenHandlerTests` | `TokenFamilyReuseRevocationTest` | `auth.spec.ts: Token Refresh` | VERIFICADO |
| **Auth** | Cierre de Sesión Seguro | `POST /api/v1/auth/logout` | Autenticado | `LogoutCommandHandlerTests` | `BlacklistRedisTokenTest` | `auth.spec.ts: Logout` | VERIFICADO |
| **Workspace** | Creación de Workspace | `POST /api/v1/workspaces` | Owner | `CreateWorkspaceCommandTests` | `CreateWorkspaceIsolationTest` | `workspace.spec.ts: Create` | VERIFICADO |
| **Workspace** | Consulta de Detalles | `GET /api/v1/workspaces/{id}` | Member | `GetWorkspaceQueryTests` | `MultiTenantCrossAccessTest` | `workspace.spec.ts: View` | VERIFICADO |
| **Workspace** | Invitación de Miembros | `POST /api/v1/workspaces/{id}/invitations` | Admin | `InviteMemberCommandTests` | `WorkspaceInviteSecurityTest` | `workspace.spec.ts: Invite` | VERIFICADO |
| **Channels** | Creación de Canales | `POST /api/v1/workspaces/{id}/channels` | Member | `CreateChannelCommandTests` | `ChannelDuplicateNameConflictTest`| `chat.spec.ts: Create Channel` | VERIFICADO |
| **Channels** | Listado de Canales Permitidos | `GET /api/v1/workspaces/{id}/channels` | Guest (en su canal) / Member | `GetChannelsQueryTests` | `PrivateChannelAccessControlTest` | `chat.spec.ts: Channel List` | VERIFICADO |
| **Messages** | Envío de Mensaje en Canal | `POST /api/v1/channels/{id}/messages` | Member | `SendMessageCommandTests` | `SendMessagePersistenceTest` | `chat.spec.ts: Send Message` | VERIFICADO |
| **Messages** | Edición de Mensaje Propio | `PUT /api/v1/messages/{id}` | Autor / Admin | `UpdateMessageCommandTests` | `MessageEditAuditHistoryTest` | `chat.spec.ts: Edit Message` | VERIFICADO |
| **Messages** | Eliminación Lógica | `DELETE /api/v1/messages/{id}` | Autor / Admin | `DeleteMessageCommandTests` | `SoftDeleteMessageTest` | `chat.spec.ts: Delete Message` | VERIFICADO |
| **Messages** | Reacciones con Emoji | `POST /api/v1/messages/{id}/reactions` | Member | `AddReactionCommandTests` | `IdempotentReactionTest` | `chat.spec.ts: Emoji Reaction` | VERIFICADO |
| **Threads** | Respuestas en Hilo | `POST /api/v1/messages/{id}/replies` | Member | `SendReplyCommandTests` | `ThreadAtomicCounterTest` | `chat.spec.ts: Thread Reply` | VERIFICADO |
| **Realtime** | WebSocket Event Hub | `/hubs/chat` | Autenticado | `ChatHubConnectionTests` | `SignalRGroupBroadcastTest` | `chat.spec.ts: Realtime Sync` | VERIFICADO |
| **Presence** | Heartbeat de Presencia | `/hubs/chat: Heartbeat` | Autenticado | `PresenceServiceTests` | `PresenceTtlExpiryRedisTest` | `direct-message.spec.ts: Presence` | VERIFICADO |
| **Files** | Carga Segura con Magic Numbers | `POST /api/v1/files/upload` | Member | `FileUploadValidatorTests` | `FileHeaderMagicNumberTest` | `chat.spec.ts: File Upload` | VERIFICADO |
| **Files** | Descarga con URL Expirable | `GET /api/v1/files/{id}/download` | Member con acceso | `GetFileUrlQueryTests` | `FileIdorCrossTenantAccessTest` | `chat.spec.ts: Download File` | VERIFICADO |
| **Tasks** | Creación de Tareas Kanban | `POST /api/v1/workspaces/{id}/tasks` | Member | `CreateTaskCommandTests` | `TaskTenantIsolationTest` | `tasks.spec.ts: Create Task` | VERIFICADO |
| **Tasks** | Actualización de Estado (Drag/Drop) | `PATCH /api/v1/tasks/{id}/status` | Asignado / Admin | `UpdateTaskStatusCommandTests` | `TaskOptimisticLockingTest` | `tasks.spec.ts: Move Task` | VERIFICADO |
| **Calendar** | Creación de Eventos | `POST /api/v1/workspaces/{id}/events` | Member | `CreateEventCommandTests` | `CalendarConflictDetectionTest` | `calendar.spec.ts: Create Event` | VERIFICADO |
| **Meetings** | Creación de Sala de Videollamada | `POST /api/v1/workspaces/{id}/meetings` | Member | `CreateMeetingCommandTests` | `MeetingTokenSignatureTest` | `meetings.spec.ts: Join Meeting` | VERIFICADO |
| **Search** | Búsqueda Full-Text Paginada | `GET /api/v1/workspaces/{id}/search` | Member | `SearchQueryValidatorTests` | `FullTextSearchIsolationTest` | `chat.spec.ts: Search Query` | VERIFICADO |
| **Admin** | Consulta de Registros de Auditoría | `GET /api/v1/workspaces/{id}/audit-logs` | Admin / Owner | `GetAuditLogsQueryTests` | `AuditLogsImmutablePersistenceTest`| `admin.spec.ts: Audit Logs` | VERIFICADO |
| **Admin** | Suspensión de Usuarios | `POST /api/v1/workspaces/{id}/users/{userId}/suspend` | Owner | `SuspendUserCommandTests` | `SuspendedUserRevocationTest` | `admin.spec.ts: Suspend User` | VERIFICADO |

---

## Mapeo del Orden Canónico de Implementación (25 Fases de la Parte 7)

| Fase | Título / Alcance | Componentes Clave Implementados | Estado de Verificación |
| :---: | :--- | :--- | :---: |
| **01** | Inicialización de Repositorio | `.editorconfig`, `.gitignore`, `docker-compose.yml`, `README.md`, `LICENSE` | VERIFICADO |
| **02** | Base de Datos Base | Esquemas PostgreSQL 18.4 (Cloud SQL), Extensiones UUID/Crypto, RLS | VERIFICADO |
| **03** | Dominio Núcleo | `Entity`, `AggregateRoot`, Value Objects, Enums, Eventos, Reglas | VERIFICADO |
| **04** | Capa de Contratos | DTOs de Auth, Workspaces, Channels, Messages, Tasks, Calendar, PagedResult | VERIFICADO |
| **05** | Aplicación: Autenticación | MediatR Commands/Queries, Validaciones FluentValidation | VERIFICADO |
| **06** | Infraestructura: Persistencia | `ApplicationDbContext`, Mappings EF Core, Repositorios | VERIFICADO |
| **07** | Infraestructura: Auth & Seguridad | Argon2id, JWT Token Generator, CurrentUserService | VERIFICADO |
| **08** | API: Autenticación & Middlewares | ExceptionHandlingMiddleware, TenantResolutionMiddleware, Swagger | VERIFICADO |
| **09** | Dominio y Aplicación: Workspaces | Creación de workspaces, gestión de miembros y roles | VERIFICADO |
| **10** | Dominio y Aplicación: Canales | Canales públicos/privados, membresías, permisos | VERIFICADO |
| **11** | Dominio y Aplicación: Mensajería | Envío de mensajes, edición, borrado suave, hilos y reacciones | VERIFICADO |
| **12** | Infraestructura: Realtime (SignalR) | `ChatHub`, Redis Backplane, eventos de mensaje, tipeo y presencia | VERIFICADO |
| **13** | Aplicación: Búsqueda | Búsqueda Full-Text `tsvector` aislada por tenant | VERIFICADO |
| **14** | Dominio y Aplicación: Archivos | Validación de magic numbers, almacenamiento local y Azure Blob | VERIFICADO |
| **15** | Dominio y Aplicación: Tareas | Creación, asignación, prioridades, fechas de vencimiento, Kanban | VERIFICADO |
| **16** | Dominio y Aplicación: Calendario | Eventos, asistentes, recordatorios, integración de zonas horarias | VERIFICADO |
| **17** | Dominio y Aplicación: Videollamadas | Salas de videollamada, tokens WebRTC, estado de llamada | VERIFICADO |
| **18** | Dominio y Aplicación: Notificaciones | Despacho en tiempo real, alertas por mención, correo transaccional | VERIFICADO |
| **19** | Capa Worker (Background Jobs) | BackgroundServices (Email, Notificaciones, Limpieza, Recordatorios) | VERIFICADO |
| **20** | Frontend: Core & Layouts | Servicios auth, interceptores JWT, guards, layout con barra lateral | VERIFICADO |
| **21** | Frontend: Canales & Mensajería | Vista de canal, chat en tiempo real, indicador de tipeo, markdown | VERIFICADO |
| **22** | Frontend: Tareas & Calendario | Tablero Kanban, vista de agenda de calendario | VERIFICADO |
| **23** | Frontend: Videollamadas & Config | Integración de audio/video, ajustes de perfil, administración | VERIFICADO |
| **24** | Pruebas Integrales & Rendimiento | Suites xUnit, ArchitectureTests, IntegrationTests, k6 (p95 < 200ms) | VERIFICADO |
| **25** | Hardening & Auditoría Final | Verificación automatizada con `scripts/verify-project` (41/41) | VERIFICADO |

---

## Convenciones de Validación

1. Cada endpoint valida de forma obligatoria la identidad del tenant emisor a través de claims JWT y el filtro global RLS en Entity Framework Core.
2. Todo endpoint que modifique estado (`POST`, `PUT`, `PATCH`, `DELETE`) soporta la cabecera opcional `Idempotency-Key` para garantizar reintentos seguros.
