# CollabPulse — Capa de Aplicación (CQRS + MediatR Architecture)

Este documento detalla la arquitectura de la **Capa de Aplicación** (`CollabPulse.Application`) bajo los principios de **Clean Architecture**, el patrón **CQRS (Command Query Responsibility Segregation)**, el mediador en proceso **MediatR** y la validación fuertemente tipada con **FluentValidation**.

---

## 1. Principios de Diseño y Responsabilidades

1. **Independencia de la Infraestructura**:
   - La capa de aplicación no depende de PostgreSQL, Npgsql ni ASP.NET Core MVC.
   - Solo consume abstracciones declaradas en `CollabPulse.Application.Common.Interfaces`:
     - `IApplicationDbContext`: contratos de `DbSet<T>` y transaccionalidad `SaveChangesAsync()`.
     - `ICurrentUserService`: identidad del usuario, claims, roles y permisos.
     - `ICurrentTenantService`: contexto de la organización activa (`TenantId`).
     - `IRealtimeHubService`: difusión de eventos en tiempo real (SignalR / Server-Sent Events).
     - `ITokenService` y `IPasswordHasher`: seguridad criptográfica y JWT.
     - `IFileStorageService`: almacenamiento agnóstico de archivos (Azure Blob, AWS S3, MinIO).

2. **Vertical Slice Architecture por Feature**:
   - Cada caso de uso es autónomo y está encapsulado en su propia carpeta bajo `Features/<Modulo>/<Commands|Queries>/<NombreCasoDeUso>/`.
   - Cada caso de uso contiene su `Command` / `Query` (inmutable record), su `Validator` (FluentValidation) y su `Handler`.

3. **Inmutabilidad y Type Safety**:
   - Los comandos y consultas son `records` de C# inmutables.
   - Las respuestas utilizan el patrón funcional `Result<T>` y `PaginatedList<T>`.

---

## 2. Pipeline de MediatR (Behaviors en Cadena)

Todas las solicitudes procesadas por `IMediator.Send()` fluyen a través de una tubería estricta de comportamientos registrados en orden de ejecución:

```text
[Cliente / API Controller]
         │
         ▼
┌────────────────────────────────────────────────────────┐
│ 1. UnhandledExceptionBehaviour                         │ -> Captura errores no controlados y loguea contexto
└────────────────────────┬───────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────┐
│ 2. PerformanceBehaviour                                │ -> Mide tiempo de ejecución; advierte si > 500ms
└────────────────────────┬───────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────┐
│ 3. LoggingBehaviour                                    │ -> Loguea inicio/fin con TenantId y UserId
└────────────────────────┬───────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────┐
│ 4. ValidationBehaviour                                 │ -> Ejecuta todos los IValidator<TRequest>
│                                                        │    (Lanza ValidationException si falla)
└────────────────────────┬───────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────┐
│ 5. TenantAuthorizationBehaviour                        │ -> Aplica ITenantScopedRequest y roles/permisos
│                                                        │    (Lanza TenantMismatchException / Forbidden)
└────────────────────────┬───────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────┐
│ Target Request Handler (Ej. SendMessageCommandHandler) │ -> Lógica pura de negocio y persistencia
└────────────────────────────────────────────────────────┘
```

### Comportamientos Implementados:
- **`UnhandledExceptionBehaviour<TRequest, TResponse>`**: registra errores críticos con el nombre de la solicitud y sus parámetros.
- **`PerformanceBehaviour<TRequest, TResponse>`**: mide latencia en milisegundos y genera alertas en el log si una operación excede 500 ms.
- **`LoggingBehaviour<TRequest, TResponse>`**: trazabilidad estructurada correlacionando `TenantId` y `UserId`.
- **`ValidationBehaviour<TRequest, TResponse>`**: intercepta la petición antes del handler; si alguna regla de FluentValidation falla, lanza `ValidationException` con el diccionario de campos erróneos.
- **`TenantAuthorizationBehaviour<TRequest, TResponse>`**: garantiza el aislamiento multi-tenant: si la petición implementa `ITenantScopedRequest`, valida que el `TenantId` de la petición coincida exactamente con el `CurrentTenantId` de la sesión activa, impidiendo ataques de fuga cruzada de datos.

---

## 3. Módulos y Casos de Uso Implementados

| Módulo | Tipo | Caso de Uso | Descripción |
| :--- | :--- | :--- | :--- |
| **Auth & Tenancy** | Command | `RegisterTenantCommand` | Onboarding de organización, usuario admin root, roles base (Owner, Admin, Member), workspace y canales por defecto, emitiendo JWT y RefreshToken. |
| **Auth & Tenancy** | Command | `LoginCommand` | Autenticación contra hash seguro, validación de estado de tenant/usuario y creación de sesión de auditoría. |
| **Auth & Tenancy** | Command | `RefreshTokenCommand` | Rotación criptográfica de refresh tokens con revocación inmediata del token previo. |
| **Workspaces** | Command | `CreateWorkspaceCommand` | Creación de nuevo workspace aislado por tenant, asignación del creador y canal `#general`. |
| **Workspaces** | Query | `GetUserWorkspacesQuery` | Listado de workspaces a los que pertenece el usuario autenticado con conteo de miembros y canales. |
| **Channels** | Command | `CreateChannelCommand` | Creación de canal público/privado con validación de slug y notificación SSE/SignalR al workspace. |
| **Channels** | Query | `GetWorkspaceChannelsQuery` | Canales accesibles (públicos + privados con membresía activa). |
| **Channels** | Command | `JoinChannelCommand` | Adhesión voluntaria a canales públicos. |
| **Messages** | Command | `SendMessageCommand` | Motor central de mensajería: valida la restricción estricta `chk_message_target` (canal XOR conversación), hilos (`ParentId`), adjuntos, menciones y difusión broadcast en tiempo real. |
| **Messages** | Query | `GetChannelMessagesQuery` | Paginación de mensajes, cálculo agrupado de reacciones emoji, recuento de respuestas en hilo y remitentes. |
| **Messages** | Command | `AddReactionCommand` | Agregado / toggle de reacciones emoji con broadcast en tiempo real. |
| **Messages** | Command | `PinMessageCommand` | Fijación de mensajes destacados en canales. |
| **Tasks & Kanban** | Command | `CreateTaskCommand` | Creación de tarea con prioridad, responsable y workspace. |
| **Tasks & Kanban** | Command | `UpdateTaskStatusCommand` | Transición de estado en tablero Kanban (`Pending` -> `InProgress` -> `Completed`) con `CompletedAt` automático. |
| **Tasks & Kanban** | Query | `GetWorkspaceTasksQuery` | Filtrado de tareas por estado, prioridad y responsable. |
| **Meetings** | Command | `CreateMeetingCommand` | Programación de videollamadas con proveedor (Internal, LiveKit, Zoom) y generación de enlace seguro. |
| **Calendar** | Command | `ScheduleEventCommand` | Creación de eventos de agenda con validación horaria y gestión de lista de asistentes. |
| **Calendar** | Query | `GetCalendarEventsQuery` | Consulta de eventos en ventana temporal filtrada por workspace y tenant. |

---

## 4. Garantía de Restricciones PostgreSQL a Nivel de Aplicación

La base de datos impone restricciones críticas que la Capa de Aplicación valida preventivamente antes de emitir queries al motor:

1. **`chk_message_target`**:
   - *Regla SQL*: `(channel_id IS NOT NULL AND conversation_id IS NULL) OR (channel_id IS NULL AND conversation_id IS NOT NULL)`
   - *Validación C#*: `SendMessageCommandValidator` valida que exactamente uno de los dos identificadores esté presente.
2. **`slug` de Tenants y Workspaces**:
   - Solo caracteres alfanuméricos en minúscula y guiones (`^[a-z0-9-]+$`).
3. **Multi-Tenancy Global**:
   - `TenantAuthorizationBehaviour` comprueba `ITenantScopedRequest` en cada comando.
   - EF Core aplica `HasQueryFilter` en `ApplicationDbContext` como red de seguridad adicional en el motor.

---

## 5. Inyección de Dependencias (`DependencyInjection.cs`)

Para registrar la capa de aplicación en el contenedor de dependencias:

```csharp
// Program.cs
builder.Services.AddApplication();
```

Esto registra automáticamente todos los handlers de MediatR, los validadores de FluentValidation del ensamblado y configura la cadena de comportamientos en el orden exacto especificado.
