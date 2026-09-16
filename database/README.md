# CollabPulse — Especificación y Arquitectura de Base de Datos PostgreSQL 18.4

Este directorio contiene la definición completa de base de datos relacional para la plataforma SaaS empresarial de comunicación y colaboración **CollabPulse**.

## 1. Principios de Arquitectura

- **Motor Principal**: PostgreSQL 18.4 (Google Cloud SQL)
- **ORM Oficial**: Entity Framework Core 8+ / 9+
- **Claves Primarias**: `UUID` generados nativamente en el motor con `gen_random_uuid()`
- **Nomenclatura**: `snake_case` estricto en tablas y columnas
- **Marcas de Tiempo**: `TIMESTAMPTZ` en UTC estricto (`CLOCK_TIMESTAMP()`)
- **Aislamiento Multi-Tenant**: Columna `tenant_id UUID` indexada y protegida en el 100% de las tablas empresariales
- **Borrado Lógico (Soft Delete)**: `deleted_at TIMESTAMPTZ NULL` en entidades de negocio con Global Query Filters en EF Core
- **Concurrencia Optimista**: Soporte de control de versiones por fila mediante `xmin` nativo de PostgreSQL

---

## 2. Estructura de Archivos

```text
database/
├── README.md                           # Documentación técnica y manual operativo
├── schema/
│   ├── 01_init.sql                     # Extensiones (pgcrypto, pg_trgm, unaccent) y funciones base
│   ├── 02_tables.sql                   # Definición DDL de las 40 tablas del producto
│   ├── 03_indexes_and_constraints.sql  # Índices compuestos, FTS (GIN) y restricciones CHECK
│   └── 04_triggers.sql                 # Triggers automatizados de updated_at y auditoría
├── migrations/                         # Migraciones incrementales secuenciales
│   ├── V1__Initial_Extensions_And_Tenants.sql
│   ├── V2__Workspaces_And_Channels.sql
│   ├── V3__Messaging_And_Reactions.sql
│   ├── V4__Tasks_Calendar_Meetings.sql
│   ├── V5__Files_And_Notifications.sql
│   └── V6__Audit_Billing_Integrations.sql
├── seeds/
│   └── 01_seed_demo_company.sql        # Semilla inicial con Demo Company, Main Workspace y usuarios
└── scripts/
    ├── init_db.sh                      # Orquestador Bash para CI/CD o despliegue automatizado
    ├── test_tenant_isolation.sql       # Suite SQL de verificación de aislamiento multi-tenant
    └── test_integrity_constraints.sql  # Suite SQL de verificación de restricciones CHECK y unicidad
```

---

## 3. Modelo Relacional y Entidades Principales

| Módulo | Tablas Principales | Rol en el Sistema |
| :--- | :--- | :--- |
| **Tenancy & Auth** | `tenants`, `users`, `user_sessions`, `roles`, `permissions`, `user_roles`, `role_permissions`, `refresh_tokens` | Aislamiento multi-organización, RBAC de grano fino y sesiones seguras |
| **Workspaces** | `workspaces`, `workspace_members`, `workspace_invitations` | Espacios colaborativos y gestión de membresía por invitación |
| **Canales & Chats** | `channels`, `channel_members`, `conversations`, `conversation_members` | Canales públicos/privados y mensajes directos 1:1 o grupales |
| **Mensajería** | `messages`, `message_reactions`, `message_reads`, `message_pins`, `message_attachments` | Mensajería de alta concurrencia con hilos, emojis y búsqueda FTS |
| **Archivos** | `files` | Metadatos de archivos (archivos reales en Azure Blob / S3) |
| **Productividad** | `tasks`, `task_comments`, `task_attachments` | Tablero Kanban y gestión ágil de tareas |
| **Calendario & Reuniones** | `calendar_events`, `calendar_event_attendees`, `meetings`, `meeting_participants` | Agenda compartida y telemetría de videollamadas |
| **Gobernanza** | `audit_logs`, `notifications`, `notification_preferences` | Trazabilidad inmutable de seguridad y notificaciones de usuario |
| **Facturación & Addons** | `subscription_plans`, `subscriptions`, `subscription_items`, `invoices`, `payments` | Modelo SaaS modular para planes Free, Pro, Business y Enterprise |
| **Ecosistema** | `integrations`, `oauth_connections`, `webhooks`, `api_keys` | Conectividad con Google Workspace, Microsoft, GitHub, Jira y webhooks |

---

## 4. Garantía de Aislamiento Multi-Tenant

Para prevenir cualquier filtración de datos entre tenants:
1. **Database Constraints**: `users` tiene `UNIQUE(tenant_id, email)` y `workspaces` tiene `UNIQUE(tenant_id, slug)`.
2. **EF Core Global Query Filters**:
   ```csharp
   modelBuilder.Entity<Message>().HasQueryFilter(m => m.TenantId == _currentTenantId && m.DeletedAt == null);
   ```
3. **Exclusión Mutua de Destino en Mensajes**:
   ```sql
   CONSTRAINT chk_message_target CHECK (
       (channel_id IS NOT NULL AND conversation_id IS NULL) OR
       (channel_id IS NULL AND conversation_id IS NOT NULL)
   );
   ```

---

## 5. Búsqueda Full-Text y Trigramas

Para búsqueda instantánea de mensajes en grandes volúmenes:
- Índice invertido generalizado (`GIN`) con diccionario `'simple'` y filtro `unaccent`:
  ```sql
  CREATE INDEX idx_messages_fts ON messages USING GIN (to_tsvector('simple', unaccent(content)));
  ```
- Coincidencias difusas y autocompletado en usuarios y canales mediante `pg_trgm`:
  ```sql
  CREATE INDEX idx_users_trgm_search ON users USING GIN ((first_name || ' ' || last_name || ' ' || email) gin_trgm_ops);
  ```

---

## 6. Ejecución y Despliegue

Para desplegar la base de datos completa en un entorno PostgreSQL 18.4:

```bash
chmod +x database/scripts/init_db.sh
DB_HOST=localhost DB_PORT=5432 DB_USER=postgres DB_NAME=collabpulse_db ./database/scripts/init_db.sh
```
