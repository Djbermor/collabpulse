# Autorización y Control de Acceso (RBAC & Multi-tenancy)

## 1. Modelo de Roles (RBAC)
1. **Owner:** Control absoluto del workspace, planes de suscripción, transferencia de propiedad y eliminación total.
2. **Admin:** Gestión de miembros, creación y archivo de canales, configuración de integraciones y acceso a registros de auditoría.
3. **Member:** Creación de canales públicos, envío y edición de mensajes, asignación y gestión de tareas, inicio de videollamadas.
4. **Guest:** Limitado exclusivamente a los canales asignados de manera explícita por un administrador.

## 2. Prevención de IDOR y Aislamiento Multi-tenant
- Cada consulta a la base de datos incluye automáticamente la condición `TenantId == CurrentTenantId`.
- PostgreSQL Row Level Security (RLS) actúa como salvaguarda en la capa física de base de datos.
- Las solicitudes cruzadas entre inquilinos resultan inmediatamente en `403 Forbidden` y auditoría de seguridad.
