# Arquitectura de Base de Datos y Persistencia — CollabPulse SaaS

Este documento define la arquitectura integral de almacenamiento, concurrencia, aislamiento y rendimiento para la plataforma **CollabPulse**, basada en **PostgreSQL 18.4 (Google Cloud SQL)** y **Drizzle ORM / Entity Framework Core**.

---

## 1. Topología General de Almacenamiento y Separación de Responsabilidades

CollabPulse sigue una arquitectura de capas con separación estricta entre **Persistencia Transaccional**, **Caché en Memoria** y **Almacenamiento de Blobs**:

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│                            CollabPulse Application                           │
└───────────────┬──────────────────────┬──────────────────────┬────────────────┘
                │                      │                      │
                ▼                      ▼                      ▼
    ┌───────────────────────┐ ┌──────────────────┐ ┌───────────────────────────┐
    │     PostgreSQL 18.4   │ │      Redis 7+    │ │   Object Storage (Blob)   │
    │ (Source of Truth)     │ │  (Realtime/Cache)│ │     (Azure Blob / S3)     │
    ├───────────────────────┤ ├──────────────────┤ ├───────────────────────────┤
    │ • Multi-tenant Data   │ │ • User Presence  │ │ • Message Attachments     │
    │ • RBAC & Permissions  │ │ • Typing Alerts  │ │ • Task Artifacts          │
    │ • Message History     │ │ • SignalR Plane  │ │ • Avatars & Logos         │
    │ • Full-Text Search    │ │ • Rate Limiting  │ │ • Meeting Recordings      │
    │ • Tasks & Meetings    │ │ • L2 Query Cache │ │                           │
    │ • Audit Logs          │ │                  │ │                           │
    └───────────────────────┘ └──────────────────┘ └───────────────────────────┘
```

---

## 2. Principio Rector: Aislamiento Multi-Tenant

El aislamiento de organizaciones es la garantía de seguridad primaria. Se implementa en tres niveles no negociables:

### 2.1. Nivel Base de Datos (Relational Model Constraints)
- Cada tabla de negocio contiene `tenant_id UUID NOT NULL REFERENCES tenants(id)`.
- Restricciones compuestas de unicidad obligan a que identificadores públicos o credenciales nunca colisionen dentro del mismo tenant ni se mezclen entre ellos:
  ```sql
  CONSTRAINT uq_users_tenant_email UNIQUE (tenant_id, email)
  CONSTRAINT uq_workspaces_tenant_slug UNIQUE (tenant_id, slug)
  ```

### 2.2. Nivel ORM (EF Core Global Query Filters)
En el `ApplicationDbContext.cs`, todas las entidades que implementan `ITenantEntity` tienen activado un filtro de consulta global en tiempo de compilación:
```csharp
builder.Entity<TEntity>().HasQueryFilter(e =>
    e.TenantId == _currentTenantService.CurrentTenantId &&
    e.DeletedAt == null
);
```
Esto garantiza que incluso si un desarrollador omite un `Where(x => x.TenantId == id)` en un query de LINQ, la consulta SQL generada contendrá automáticamente la cláusula WHERE.

### 2.3. Nivel de Inyección de Dependencias
El `CurrentTenantService` resuelve el `tenant_id` exclusivamente a través del JWT verificado en el backend o por el subdominio criptográficamente validado. **Nunca se confía en el valor de un header o query param sin verificar la firma del token.**

---

## 3. Modelo de Mensajería de Alta Concurrencia

### 3.1. Restricción de Exclusión Mutua (Channel vs. Conversation)
Un mensaje debe pertenecer obligatoriamente a un canal público/privado O a una conversación directa/grupal, pero bajo ninguna circunstancia a ambos:
```sql
CONSTRAINT chk_message_target CHECK (
    (channel_id IS NOT NULL AND conversation_id IS NULL) OR
    (channel_id IS NULL AND conversation_id IS NOT NULL)
)
```

### 3.2. Estrategia de Particionamiento
Para soportar millones de mensajes mensuales sin degradación de índices B-Tree:
- **Particionamiento por Rango de Fecha (`created_at`)**: Las particiones se definen mensualmente (`messages_2026_09`, `messages_2026_10`, etc.).
- **Particionamiento Compuesto (Tenant + Rango)**: En clientes Enterprise con más de 50,000 empleados, se aísla la partición por `tenant_id` mediante tablas derivadas en tablespaces dedicados.
- **Consultas Paginadas Cursor-Based**: La paginación en la API de chat no utiliza `OFFSET/LIMIT`, sino paginación basada en cursor:
  ```sql
  SELECT * FROM messages
  WHERE tenant_id = @tenantId AND channel_id = @channelId AND created_at < @cursorTimestamp
  ORDER BY created_at DESC
  LIMIT 50;
  ```

---

## 4. Motor de Búsqueda Full-Text y Trigramas

### 4.1. Búsqueda de Mensajes con GIN e Invariante de Acentos
```sql
CREATE INDEX idx_messages_fts
    ON messages USING GIN (to_tsvector('simple', unaccent(content)));
```
- Se utiliza la configuración `'simple'` para no alterar nombres de variables de código, identificadores técnicos ni jerga en español/inglés.
- `unaccent` elimina la sensibilidad a tildes (ej. "configuración" localiza "configuracion").

### 4.2. Búsqueda Difusa en Usuarios y Canales
Se emplea la extensión `pg_trgm` con índices GIN para autocompletar menciones `@usuario` y canales `#canal` en menos de 10 milisegundos:
```sql
CREATE INDEX idx_users_trgm_search
    ON users USING GIN ((first_name || ' ' || last_name || ' ' || email) gin_trgm_ops);
```

---

## 5. Control de Concurrencia Optimista

Para evitar la sobrescritura silenciosa en tareas colaborativas, perfiles y canales compartidos:
- Se utiliza la columna de control del sistema de PostgreSQL `xmin` mapeada en Entity Framework Core:
  ```csharp
  builder.Property<uint>("xmin")
         .HasColumnType("xid")
         .ValueGeneratedOnAddOrUpdate()
         .IsRowVersion();
  ```
- Si dos usuarios modifican el estado de una misma tarea simultáneamente, el segundo intento arroja una `DbUpdateConcurrencyException`, notificando al cliente mediante SignalR para recargar el estado sin pérdida de información.

---

## 6. Soft Delete y Políticas de Retención de Datos

### 6.1. Borrado Lógico
Las tablas de negocio no sufren `DELETE` físicos directos. En su lugar, el `ApplicationDbContext` intercepta el guardado:
- Se asigna `deleted_at = DateTimeOffset.UtcNow`.
- Los Global Query Filters excluyen registros eliminados lógicamente de forma automática.

### 6.2. Ciclo de Purga Automática (Data Retention Background Worker)
Un job de segundo plano (Hangfire / IHostedService) ejecuta limpiezas programadas en ventanas de bajo tráfico (02:00 AM UTC):
1. **Sesiones Expiradas**: Registros en `user_sessions` y `refresh_tokens` con `expires_at < NOW() - INTERVAL '30 days'` son eliminados físicamente.
2. **Notificaciones Antiguas**: Registros en `notifications` con `is_read = TRUE AND created_at < NOW() - INTERVAL '90 days'`.
3. **Auditoría de Cumplimiento**: Retención estricta configurable por plan (Free: 30 días, Pro: 365 días, Enterprise: 7 años en cold storage comprimido).

---

## 7. Objetivos de Latencia y Rendimiento (SLA)

| Operación | Meta de Latencia (p95) | Estrategia de Optimización |
| :--- | :---: | :--- |
| **Login & Emisión de Token** | < 500 ms | BCrypt calibrado (cost 12), sesión indexada por token hash |
| **Listar Canales de Workspace** | < 250 ms | Index `idx_channels_workspace`, proyección `AsNoTracking()` |
| **Carga de Mensajes (50 ítems)** | < 350 ms | Composite index `(tenant_id, channel_id, created_at DESC)` |
| **Envío y Publicación de Mensaje** | < 200 ms | Transacción corta + despacho asíncrono a Redis SignalR Hub |
| **Búsqueda Global Full-Text** | < 400 ms | GIN Index con vector precalculado |

---

## 8. Estrategia de Respaldo y Recuperación ante Desastres (Disaster Recovery)

1. **Continuous WAL Archiving**: Registro constante de Write-Ahead Logs hacia almacenamiento inmutable con retención de 35 días.
2. **Point-In-Time Recovery (PITR)**: Capacidad de restauración a cualquier segundo específico en caso de incidente o corrupción involuntaria de datos.
3. **Instantáneas Diarias**: Snapshots automáticos a las 00:00 UTC con réplicas geo-distribuidas.
4. **Pool de Conexiones**: PgBouncer en modo de pooling por transacción (`pool_mode = transaction`) con límite de 2,000 conexiones concurrentes por nodo primario.
