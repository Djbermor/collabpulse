# NEXORA — ESPECIFICACIÓN DE ARQUITECTURA, MODELO EMPRESARIAL Y POLÍTICAS DE CICLO DE VIDA

---

## 1. INTRODUCCIÓN Y CONTEXTO

El sistema ha concluido satisfactoriamente su etapa inicial de estabilización, alcanzando un estado funcional validado en la suite de pruebas automatizadas:

### Métricas Reales Verificadas de la Suite Actual (17 de septiembre de 2026)
* **Cantidad total de pruebas en la suite actual:** 19
* **Pruebas ejecutadas:** 19
* **Pruebas aprobadas (PASS):** 19
* **Pruebas fallidas (FAIL):** 0
* **Pruebas bloqueadas (BLOCKED):** 0
* **Tasa de éxito:** 100%

*(Nota de rigor técnico: La suite actual de validación E2E sobre navegador Chromium real ejecuta exactamente 19 pruebas atómicas de integración que cubren login múltiple, mensajería 1:1 en tiempo real con SSE, persistencia PostgreSQL, creación y membresía de canales, creación y mensajería de grupos, gestión dinámica de permisos en panel administrativo y guardas de API en 5 capas. Cualquier referencia previa a 22 pruebas correspondía a fases previas de desarrollo; las métricas oficiales vigentes son las aquí reportadas).*

A partir de este hito, la plataforma consolida su evolución formal hacia **NEXORA**, una suite de colaboración y comunicación multi-organizacional de nivel empresarial concebida para **Gestión Salud IPS** y sus unidades organizacionales asociadas.

---

## 2. REGLA MAESTRA DE NEXORA: PROHIBICIÓN ABSOLUTA DE ELIMINACIÓN FÍSICA (ZERO HARD DELETE)

> **REGLA EMPRESARIAL INMUTABLE:**  
> **NEXORA NO UTILIZA ELIMINACIÓN FÍSICA (SQL DELETE) PARA NINGÚN RECURSO EMPRESARIAL.**

Bajo ninguna circunstancia se ejecutará un `DELETE` en base de datos ni eliminación física de:
1. **Usuarios / Colaboradores**
2. **Organizaciones**
3. **Canales**
4. **Grupos**
5. **Conversaciones 1:1**
6. **Mensajes**
7. **Archivos y Adjuntos**
8. **Membresías Históricas**
9. **Registros de Auditoría y Trazabilidad**

### Vocabulario y Acciones Operativas Permitidas
Cuando en la interfaz de usuario se mencione una acción administrativa que coloquialmente se entienda como "eliminar", a nivel de sistema y modelo de datos significará estrictamente:
* **Desactivar** (para usuarios y organizaciones)
* **Inactivar / Retirar de operación** (para servicios y organizaciones)
* **Archivar** (para canales y grupos)
* **Retirar membresía** (conservando el histórico en `organization_members` con marca temporal de baja)
* **Marcar como histórico** (para registros que salen del flujo diario)

### Política Estricta de Conversaciones 1:1
* Las conversaciones directas 1 a 1 son **estrictamente persistentes y no pueden eliminarse**.
* Si un colaborador es desactivado o abandona la entidad:
  * Su **identidad histórica permanece**.
  * La **conversación permanece intacta**.
  * Los **mensajes permanecen intactos**.
  * Los **archivos y adjuntos permanecen intactos**.
  * Toda la información histórica puede ser consultada conforme a los permisos asignados por auditoría.
  * Ocultar una conversación en la vista de un colaborador es un comportamiento puramente visual a nivel de cliente (`hide / mute`), jamás un borrado en el servidor.

---

## 3. ESTADOS FORMALES DEL CICLO DE VIDA

Para evitar ambigüedades, Nexora define estados rigurosos por entidad:

### 3.1. Usuarios / Colaboradores
El ciclo de vida de un colaborador maneja 3 estados mutuamente excluyentes:
* **`PENDING_ACTIVATION` (Nuevo Colaborador Pendiente de Activación):**
  * Colaborador recién creado o registrado que aún no ha sido verificado o habilitado por el Administrador.
  * Se ubica en una sección administrativa dedicada y claramente diferenciada.
  * No puede operar en la plataforma ni acceder a información operativa.
  * *Diferenciación crítica:* No debe confundirse bajo ninguna circunstancia con un colaborador antiguo desactivado.
* **`ACTIVE` (Activo):**
  * Colaborador plenamente habilitado para operar, enviar mensajes y participar en las organizaciones donde posee membresía activa.
* **`INACTIVE` (Desactivado / Histórico):**
  * Colaborador que ha sido dado de baja o retirado de la empresa.
  * Bloqueo inmediato de autenticación y sesiones.
  * **Conservación 100% íntegra:** Su nombre, mensajes pasados, participación en canales y grupos, adjuntos y registros de auditoría se preservan intactos con indicación histórica de su estado inactivo.

### 3.2. Organizaciones
* **`ACTIVE` (Operativa):**
  * Organización habilitada para el flujo de trabajo diario de sus miembros.
* **`INACTIVE` (Inactiva / Fuera de Operación):**
  * La organización no opera normalmente y **no debe aceptar nuevas operaciones** (no permite crear canales, ni enviar mensajes, ni agregar miembros).
  * No aparece como organización operativa en selectores convencionales de colaboradores.
  * **Conservación total:** Todos sus datos, canales, grupos, mensajes, archivos, membresías históricas y auditoría se conservan intactos para consulta exclusiva de administradores.
  * *Reactivación de Organizaciones:* `PENDIENTE DE DEFINICIÓN / APROBACIÓN EN FASE POSTERIOR` (no se implementa reactivación automática ni deliberada en esta fase).

### 3.3. Canales y Grupos
Diferenciación conceptual entre estado operativo y retiro de operación:
* **`ACTIVE` (Activo / Operativo):**
  * Canal o grupo disponible para interacción, mensajería y consulta de sus miembros.
* **`ARCHIVED` (Archivado / Fuera de la vista operativa):**
  * El canal o grupo ha sido desactivado por su propietario o por el Administrador, o bien ha quedado sin miembros activos.
  * **Retiro de vista operativa:** Desaparece de la lista normal de canales/grupos de los colaboradores y de las búsquedas operativas; deja de aceptar mensajes, archivos o nuevos integrantes.
  * **Conservación total:** Permanece disponible exclusivamente en el **Archivo Administrativo** para consulta histórica de administradores.
  * Desactivar o archivar **NO significa eliminar**: los mensajes, adjuntos, reacciones, miembros históricos y registros de auditoría permanecen permanentemente.

---

## 4. INVENTARIO DE REBRANDING: COLLABPULSE → NEXORA

Para la **Fase 2**, se ha auditado el sistema completo para reemplazar toda referencia visible al usuario:

### 4.1. Referencias Visibles al Usuario (Frontend UI & Metadatos)

| Archivo | Elemento | Texto Anterior (CollabPulse) | Sustitución (Nexora) | Estado |
| :--- | :--- | :--- | :--- | :--- |
| `index.html` | `<title>` (Línea 6) | `CollabPulse - Enterprise Communication Platform` | `Nexora - Enterprise Communication Platform` | CAMBIADO |
| `index.html` | Meta descripción & OG | `CollabPulse - Enterprise...` | `Nexora - Enterprise...` | CAMBIADO |
| `metadata.json` | Propiedad `name` | `"CollabPulse - Enterprise Communication Platform"` | `"Nexora - Enterprise Communication Platform"` | CAMBIADO |
| `src/components/layout/Header.tsx` | Brand Logo / Title | `CollabPulse` | `Nexora` | CAMBIADO |
| `src/components/auth/AuthScreen.tsx` | Encabezado Login | `CollabPulse Enterprise` | `Nexora Enterprise` | CAMBIADO |
| `src/components/auth/AuthScreen.tsx` | Toast de Registro | `¡Bienvenido a CollabPulse!` | `¡Bienvenido a Nexora!` | CAMBIADO |
| `src/App.tsx` | Loader de Sesión | `Cargando sesión de CollabPulse Enterprise...` | `Cargando sesión de Nexora Enterprise...` | CAMBIADO |
| `src/App.tsx` | Fallback de Módulos | `...deshabilitado en esta versión MVP de CollabPulse...` | `...deshabilitado en esta versión MVP de Nexora...` | CAMBIADO |
| `src/components/modals/SettingsModal.tsx` | Título y Política | `CollabPulse Desktop` / `Las contraseñas de CollabPulse...` | `Nexora Desktop` / `Las contraseñas de Nexora...` | CAMBIADO |
| `src/components/calendar/CalendarView.tsx`| Placeholder | `Ej: Sala Virtual CollabPulse...` | `Ej: Sala Virtual Nexora...` | CAMBIADO |
| `server.ts` | Consola inicio | `CollabPulse Server running on...` | `Nexora Server running on...` | CAMBIADO |

### 4.2. Compatibilidad y Manejo de Almacenamiento Local (LocalStorage)
Para garantizar que **ningún colaborador pierda su sesión activa**:
* **Tokens (`src/services/api.ts`):** Lectura con prioridad de `nexora_token`, y si no existe fallback a `collab_token`. Al guardar sesión, se actualizan ambas claves de forma transparente.
* **Configuraciones de Usuario (`src/context/AppContext.tsx`):** Lectura con prioridad de `nexora_settings`, con fallback a `collabpulse_settings`.

---

## 5. ARQUITECTURA DE DATOS Y TRANSICIÓN MULTI-ORGANIZACIÓN

### 5.1. Entidades en Base de Datos PostgreSQL
1. **`users`**: Identidad y autenticación.
2. **`organizations`**: Unidades organizacionales (`id, name, slug, status, created_at`).
3. **`organization_members`**: Vínculo N:M entre usuario y organizaciones con rol y estado.
4. **`channels`** y **`channel_members`**: Canales de mensajería y participantes.
5. **`conversations`** y **`conversation_members`**: Chats 1:1 directos y grupos.
6. **`messages`**: Mensajería persistente con soporte para hilos y adjuntos.
7. **`feature_permissions`**: Matriz de permisos de módulos.
8. **`audit_logs`**: Trazabilidad inmutable de eventos.
9. **`tenants`** y **`workspaces`**: Tablas estructurales existentes que operan como soporte de la instancia actual y que se alinean gradualmente con `organizations`.

### 5.2. Reglas de Propietarios y Miembros
* **Propietario Desactivado o que Abandona:** El canal o grupo continúa existiendo; su `owner_id` pasa a `NULL` hasta que un Administrador asigne un nuevo propietario. No se desactiva ni elimina el recurso.
* **Cero Miembros:** Si un canal o grupo queda con 0 miembros activos, pasa automáticamente de `ACTIVE` a `ARCHIVED`.

---

## 6. SISTEMA DE PERMISOS EN DOS CAPAS

* **Capa 1 — Feature Permissions (Módulos):** Control booleano por instancia/organización (`messaging`, `channels`, `groups`, `tasks`, `calendar`, `calls`, `videoCalls`, `files`, `saved`, `activity`).
* **Capa 2 — Resource Permissions (Recursos):** Privilegios sobre recursos individuales (`channels.create`, `channels.archive`, `groups.manage_members`, etc.).

---

## 7. CONCEPTOS PENDIENTES DE DEFINICIÓN / FASES POSTERIORES

Siguiendo el mandato de no introducir prematuramente funcionalidades no aprobadas:
* `PENDIENTE DE DEFINICIÓN / IMPLEMENTACIÓN EN FASE POSTERIOR`: Canales públicos vs. canales privados.
* `PENDIENTE DE DEFINICIÓN / IMPLEMENTACIÓN EN FASE POSTERIOR`: Directorios corporativos públicos abiertos.
* `PENDIENTE DE DEFINICIÓN / IMPLEMENTACIÓN EN FASE POSTERIOR`: Flujo automatizado de reactivación de organizaciones inactivas.
* `PENDIENTE DE DEFINICIÓN / IMPLEMENTACIÓN EN FASE POSTERIOR`: Roles jerárquicos adicionales no contemplados en el MVP actual.
* `PENDIENTE DE DEFINICIÓN / IMPLEMENTACIÓN EN FASE POSTERIOR`: Validación SMTP real de dominio `@gestionsaludips.com`.
* `PENDIENTE DE DEFINICIÓN / IMPLEMENTACIÓN EN FASE POSTERIOR`: Reactivación de módulos secundarios (Llamadas WebRTC, LiveKit, Calendario, Tareas).

---

## 8. ADMINISTRADOR PRINCIPAL CONFIGURADO
* **Nombre:** `Deivi Jose Bertel Morelo`
* **Correo:** `analistalider.ctg@gestionsaludips.com`
* **Cargo:** `Analista de sistema`
* **ID:** `usr-admin-mu36yjdt`
* **Credenciales:** Hash seguro PBKDF2 (SHA-512). Credenciales en texto plano estrictamente resguardadas.
