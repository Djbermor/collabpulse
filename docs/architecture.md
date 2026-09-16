# Arquitectura del Sistema CollabPulse Enterprise (PumbleClone)

## 1. Visión General y Clean Architecture
El sistema está estructurado bajo los principios de **Clean Architecture**, **CQRS (Command Query Responsibility Segregation)** y **Domain-Driven Design (DDD)**, garantizando que el dominio central sea totalmente independiente de frameworks, bases de datos o bibliotecas externas.

```text
+-------------------------------------------------------------+
|                      CollabPulse.Api                        |
|   (Controllers, Hubs, Middlewares, OpenAPI/Swagger, Filters) |
+-------------------------------------------------------------+
                              |
                              v
+-------------------------------------------------------------+
|                   CollabPulse.Application                   |
| (MediatR Handlers, Pipeline Behaviors, DTOs, Validations)   |
+-------------------------------------------------------------+
                              |
                              v
+-------------------------------------------------------------+
|                     CollabPulse.Domain                      |
| (Entities, Value Objects, Aggregates, Events, BusinessRules)|
+-------------------------------------------------------------+
                              ^
                              |
+-------------------------------------------------------------+
|                 CollabPulse.Infrastructure                  |
| (EF Core, PostgreSQL RLS, Redis Backplane, Azure Blob, Smtp)|
+-------------------------------------------------------------+
```

---

## 2. Flujos Operativos y Diagramas de Secuencia (Secciones 64-71)

### 2.1 Flujo de Envío de Mensaje (Sección 64)
1. **Cliente:** El usuario envía `POST /api/v1/messages` con `channelId`, `content`, `type`.
2. **API:** Valida el JWT y extrae `tenant_id` y `user_id`.
3. **Application:** Ejecuta `SendMessageCommand` a través del pipeline de MediatR (`ValidationBehavior` -> `TransactionBehavior`).
4. **Domain:** Ejecuta reglas de negocio (`MessageContentMustNotBeEmptyRule`, `MemberMustBeActiveRule`) y emite `MessageCreated` DomainEvent.
5. **Infrastructure (Persistencia):** Persiste el mensaje en PostgreSQL con clave de aislamiento `tenant_id`.
6. **Realtime (SignalR + Redis Backplane):** El evento es publicado al topic `workspace_{id}:channel_{id}` en Redis.
7. **Broadcast:** Todos los clientes conectados en la sala reciben el mensaje instantáneamente via WebSocket.

### 2.2 Flujo de Subida de Archivo (Sección 65)
1. **Cliente:** Solicita URL de carga prefirmada vía `POST /api/v1/files/upload-ticket`.
2. **API / Application:** Valida tipo MIME, extensión permitida y límite de tamaño (máx 100MB).
3. **Infrastructure (Storage):** Genera Shared Access Signature (SAS) o presigned URL apuntando a Azure Blob Storage / MinIO.
4. **Cliente:** Sube el binario directamente al Storage evitando saturar el servidor API.
5. **Confirmación:** El cliente notifica `POST /api/v1/files/confirm` para persistir los metadatos del archivo en la base de datos.

### 2.3 Flujo de Notificación (Sección 66)
1. **Evento:** Se crea un mensaje con mención `@usuario` o se asigna una tarea.
2. **Domain Event:** `NotificationCreated` es despachado internamente.
3. **Application:** Comprueba preferencias de usuario (No Molestar, Silenciar canal, Horario laboral).
4. **Worker / Realtime:**
   - Si el usuario está **Online**: Despacha evento `NotificationReceived` por SignalR.
   - Si el usuario está **Offline**: Despacha correo electrónico resumen a través de `NotificationDispatcherService`.

### 2.4 Flujo de Invitación a Workspace (Sección 67)
1. **Admin:** Envía `POST /api/v1/workspaces/{id}/invitations` con correo y rol asignado.
2. **Application:** Verifica que el solicitante sea `Owner` o `Admin`.
3. **Domain:** Genera un token criptográfico seguro con vencimiento a 7 días.
4. **Worker:** `EmailBackgroundService` envía el correo transaccional con el enlace de aceptación.
5. **Receptor:** Hace clic en el enlace, completa su registro y es añadido automáticamente al espacio y a los canales predeterminados (#general).

### 2.5 Flujo de Recuperación de Contraseña (Sección 68)
1. **Usuario:** Solicita restablecimiento vía `POST /api/v1/auth/forgot-password`.
2. **Seguridad:** La respuesta siempre retorna HTTP 200 para mitigar ataques de enumeración de cuentas.
3. **Criptografía:** Genera token de reseteo con hash SHA-256 temporal (expiración: 15 minutos).
4. **Email:** Enlace único de un solo uso enviado al correo registrado.
5. **Confirmación:** `POST /api/v1/auth/reset-password` valida el token, computa el hash con Argon2id e invalida todas las sesiones de refresh tokens previas.

### 2.6 Flujo de Búsqueda (Sección 69)
1. **Cliente:** Envía término de búsqueda en `GET /api/v1/search?q={query}`.
2. **Base de Datos:** Ejecuta consulta Full-Text Search utilizando `to_tsvector('spanish', content)` con soporte de índices GIN.
3. **Aislamiento Multi-tenant:** Aplica estrictamente `tenant_id = current_tenant` y filtra únicamente canales donde el usuario tiene membresía activa.
4. **Respuesta:** Agrupa resultados clasificados en Mensajes, Canales, Archivos y Tareas.

### 2.7 Flujo de Verificación de Permisos (Sección 70)
1. **Request:** Cada petición entrante incluye el token Bearer JWT y encabezado `X-Tenant-Id`.
2. **TenantResolutionMiddleware:** Verifica coherencia entre el `tenant_id` del token y el recurso solicitado.
3. **AuthorizationBehavior:** Evalúa la matriz RBAC:
   - `Owner`: Control total de facturación, borrado de workspace y auditoría.
   - `Admin`: Gestión de canales, miembros e integraciones.
   - `Member`: Creación de canales públicos, envío de mensajes y tareas.
   - `Guest`: Acceso restringido a canales asignados de forma explícita.
4. **Fallo:** Retorna `403 Forbidden` en caso de violación de privilegios o IDOR.

### 2.8 Flujo de Manejo de Errores (Sección 71)
1. **Excepciones:** Cualquier excepción no controlada o error de regla de dominio es capturada por `ExceptionHandlingMiddleware`.
2. **Formato RFC 7807:** La respuesta se serializa bajo el estándar `application/problem+json`:
   - `type`: Enlace descriptivo del código de error.
   - `title`: Título legible del problema.
   - `status`: Código de estado HTTP exacto (400, 401, 403, 404, 409, 422, 500).
   - `detail`: Descripción segura sin revelar stacktraces internos en producción.
   - `instance`: Ruta del endpoint solicitado.
3. **Auditoría:** Los errores 500 se registran con severidad `Error` en Serilog con Correlation ID para trazabilidad.
