# Diccionario de Datos — CollabPulse Platform

Este documento define la totalidad de las tablas, columnas, tipos de datos, restricciones y descripciones semánticas de la base de datos PostgreSQL 18.4 (Google Cloud SQL) de CollabPulse.

---

## Table: tenants

Column: id
Type: UUID
Nullable: NO
Primary Key: YES
Description: Identificador único universal del tenant (organización SaaS).

Column: name
Type: VARCHAR(150)
Nullable: NO
Primary Key: NO
Description: Razón social o nombre legal de la organización.

Column: slug
Type: VARCHAR(100)
Nullable: NO
Primary Key: NO
Description: Identificador amigable para URLs y subdominios. Constraint UNIQUE.

Column: description
Type: TEXT
Nullable: YES
Primary Key: NO
Description: Descripción de la compañía o giro comercial.

Column: logo_url
Type: TEXT
Nullable: YES
Primary Key: NO
Description: URL de la imagen del logotipo institucional.

Column: timezone
Type: VARCHAR(100)
Nullable: YES
Primary Key: NO
Description: Zona horaria IANA por defecto de la organización (ej. America/New_York).

Column: language
Type: VARCHAR(10)
Nullable: YES
Primary Key: NO
Description: Código ISO del idioma principal del tenant (ej. es, en).

Column: is_active
Type: BOOLEAN
Nullable: NO
Primary Key: NO
Description: Indica si la organización se encuentra habilitada operativamente.

Column: created_at
Type: TIMESTAMPTZ
Nullable: NO
Primary Key: NO
Description: Marca temporal en UTC de creación del registro.

Column: updated_at
Type: TIMESTAMPTZ
Nullable: NO
Primary Key: NO
Description: Marca temporal en UTC de última actualización mediante trigger.

Column: deleted_at
Type: TIMESTAMPTZ
Nullable: YES
Primary Key: NO
Description: Fecha de borrado lógico (soft delete). NULL si está activo.

---

## Table: users

Column: id
Type: UUID
Nullable: NO
Primary Key: YES
Description: Identificador único universal del usuario.

Column: tenant_id
Type: UUID
Nullable: NO
Primary Key: NO
Description: Clave foránea al tenant propietario. Constraint UNIQUE(tenant_id, email).

Column: first_name
Type: VARCHAR(100)
Nullable: NO
Primary Key: NO
Description: Nombres de pila del usuario.

Column: last_name
Type: VARCHAR(100)
Nullable: NO
Primary Key: NO
Description: Apellidos del usuario.

Column: email
Type: VARCHAR(320)
Nullable: NO
Primary Key: NO
Description: Correo electrónico corporativo normalizado.

Column: password_hash
Type: TEXT
Nullable: NO
Primary Key: NO
Description: Hash seguro de la contraseña (BCrypt / Argon2). Nunca en texto plano.

Column: avatar_url
Type: TEXT
Nullable: YES
Primary Key: NO
Description: Enlace al avatar o foto de perfil del usuario.

Column: job_title
Type: VARCHAR(150)
Nullable: YES
Primary Key: NO
Description: Cargo o rol profesional dentro de la empresa.

Column: phone
Type: VARCHAR(50)
Nullable: YES
Primary Key: NO
Description: Teléfono corporativo de contacto con código de país.

Column: timezone
Type: VARCHAR(100)
Nullable: YES
Primary Key: NO
Description: Zona horaria del usuario para representación local de eventos.

Column: status
Type: VARCHAR(30)
Nullable: NO
Primary Key: NO
Description: Estado de presencia en vivo: online, away, busy, dnd, offline.

Column: custom_status
Type: TEXT
Nullable: YES
Primary Key: NO
Description: Mensaje personalizado con emoji fijado por el usuario.

Column: custom_status_expires_at
Type: TIMESTAMPTZ
Nullable: YES
Primary Key: NO
Description: Expiración automática del mensaje de estado temporal.

Column: last_seen_at
Type: TIMESTAMPTZ
Nullable: YES
Primary Key: NO
Description: Última interacción o señal de latido (heartbeat) registrada.

Column: is_email_verified
Type: BOOLEAN
Nullable: NO
Primary Key: NO
Description: Bandera de verificación de posesión de correo electrónico.

Column: is_active
Type: BOOLEAN
Nullable: NO
Primary Key: NO
Description: Estado de la cuenta de usuario (habilitado / suspendido).

Column: created_at
Type: TIMESTAMPTZ
Nullable: NO
Primary Key: NO
Description: Fecha de registro inicial en UTC.

Column: updated_at
Type: TIMESTAMPTZ
Nullable: NO
Primary Key: NO
Description: Fecha de última actualización del perfil.

Column: deleted_at
Type: TIMESTAMPTZ
Nullable: YES
Primary Key: NO
Description: Fecha de baja lógica del usuario.

---

## Table: user_sessions

Column: id
Type: UUID
Nullable: NO
Primary Key: YES
Description: Identificador único de la sesión del dispositivo.

Column: tenant_id
Type: UUID
Nullable: NO
Primary Key: NO
Description: Clave foránea al tenant correspondiente.

Column: user_id
Type: UUID
Nullable: NO
Primary Key: NO
Description: Clave foránea al usuario autenticado.

Column: refresh_token_hash
Type: TEXT
Nullable: NO
Primary Key: NO
Description: Hash SHA-256 del refresh token emitido.

Column: ip_address
Type: INET
Nullable: YES
Primary Key: NO
Description: Dirección IP del cliente en la conexión.

Column: user_agent
Type: TEXT
Nullable: YES
Primary Key: NO
Description: Identificador de navegador o cliente nativo.

Column: device_name
Type: VARCHAR(200)
Nullable: YES
Primary Key: NO
Description: Nombre amigable del equipo o dispositivo móvil.

Column: expires_at
Type: TIMESTAMPTZ
Nullable: NO
Primary Key: NO
Description: Fecha límite de validez de la sesión.

Column: revoked_at
Type: TIMESTAMPTZ
Nullable: YES
Primary Key: NO
Description: Fecha de revocación manual o por cierre de sesión.

Column: created_at
Type: TIMESTAMPTZ
Nullable: NO
Primary Key: NO
Description: Fecha de apertura de la sesión.

---

## Table: roles

Column: id
Type: UUID
Nullable: NO
Primary Key: YES
Description: Identificador único del rol.

Column: tenant_id
Type: UUID
Nullable: YES
Primary Key: NO
Description: NULL para roles predefinidos del sistema; UUID para roles propios del tenant.

Column: name
Type: VARCHAR(100)
Nullable: NO
Primary Key: NO
Description: Nombre del rol (Owner, Admin, Member, Guest o personalizado).

Column: description
Type: TEXT
Nullable: YES
Primary Key: NO
Description: Explicación de responsabilidades asignadas al rol.

Column: is_system_role
Type: BOOLEAN
Nullable: NO
Primary Key: NO
Description: TRUE si es un rol inmutable reservado por la plataforma.

Column: created_at
Type: TIMESTAMPTZ
Nullable: NO
Primary Key: NO
Description: Fecha de creación.

Column: updated_at
Type: TIMESTAMPTZ
Nullable: NO
Primary Key: NO
Description: Fecha de modificación.

---

## Table: permissions

Column: id
Type: UUID
Nullable: NO
Primary Key: YES
Description: Identificador del permiso.

Column: code
Type: VARCHAR(150)
Nullable: NO
Primary Key: NO
Description: Código único de control de acceso (ej. message.read, user.invite).

Column: description
Type: TEXT
Nullable: YES
Primary Key: NO
Description: Descripción funcional de la autorización.

Column: module
Type: VARCHAR(100)
Nullable: NO
Primary Key: NO
Description: Módulo agrupador (workspace, channel, message, file, task, audit).

Column: created_at
Type: TIMESTAMPTZ
Nullable: NO
Primary Key: NO
Description: Fecha de registro del permiso.

---

## Table: user_roles

Column: user_id
Type: UUID
Nullable: NO
Primary Key: YES
Description: Identificador del usuario asignado.

Column: role_id
Type: UUID
Nullable: NO
Primary Key: YES
Description: Identificador del rol concedido.

Column: assigned_by
Type: UUID
Nullable: YES
Primary Key: NO
Description: Usuario administrador que realizó la asignación.

Column: created_at
Type: TIMESTAMPTZ
Nullable: NO
Primary Key: NO
Description: Fecha de concesión del rol.

---

## Table: role_permissions

Column: role_id
Type: UUID
Nullable: NO
Primary Key: YES
Description: Rol beneficiario.

Column: permission_id
Type: UUID
Nullable: NO
Primary Key: YES
Description: Permiso atómico concedido.

Column: created_at
Type: TIMESTAMPTZ
Nullable: NO
Primary Key: NO
Description: Fecha de asociación del permiso.

---

## Table: workspaces

Column: id
Type: UUID
Nullable: NO
Primary Key: YES
Description: Identificador único del espacio de trabajo.

Column: tenant_id
Type: UUID
Nullable: NO
Primary Key: NO
Description: Organización a la que pertenece el espacio. Constraint UNIQUE(tenant_id, slug).

Column: name
Type: VARCHAR(150)
Nullable: NO
Primary Key: NO
Description: Nombre del espacio de trabajo (ej. Main Workspace).

Column: slug
Type: VARCHAR(100)
Nullable: NO
Primary Key: NO
Description: Slug alfanumérico para resolución de rutas.

Column: description
Type: TEXT
Nullable: YES
Primary Key: NO
Description: Descripción del propósito del espacio.

Column: logo_url
Type: TEXT
Nullable: YES
Primary Key: NO
Description: Logotipo específico del workspace.

Column: timezone
Type: VARCHAR(100)
Nullable: YES
Primary Key: NO
Description: Zona horaria del workspace.

Column: is_active
Type: BOOLEAN
Nullable: NO
Primary Key: NO
Description: Habilitación operativa del espacio.

Column: created_at
Type: TIMESTAMPTZ
Nullable: NO
Primary Key: NO
Description: Fecha de creación en UTC.

Column: updated_at
Type: TIMESTAMPTZ
Nullable: NO
Primary Key: NO
Description: Fecha de última actualización.

Column: deleted_at
Type: TIMESTAMPTZ
Nullable: YES
Primary Key: NO
Description: Borrado lógico del workspace.

---

## Table: workspace_members

Column: workspace_id
Type: UUID
Nullable: NO
Primary Key: YES
Description: Clave foránea al workspace.

Column: user_id
Type: UUID
Nullable: NO
Primary Key: YES
Description: Clave foránea al usuario miembro.

Column: role_id
Type: UUID
Nullable: NO
Primary Key: NO
Description: Rol del usuario dentro de este workspace particular.

Column: joined_at
Type: TIMESTAMPTZ
Nullable: NO
Primary Key: NO
Description: Fecha de incorporación al workspace.

Column: last_active_at
Type: TIMESTAMPTZ
Nullable: YES
Primary Key: NO
Description: Fecha de última actividad registrada en este workspace.

Column: is_active
Type: BOOLEAN
Nullable: NO
Primary Key: NO
Description: Estado de membresía (activo / suspendido).

---

## Table: workspace_invitations

Column: id
Type: UUID
Nullable: NO
Primary Key: YES
Description: Identificador de la invitación.

Column: tenant_id
Type: UUID
Nullable: NO
Primary Key: NO
Description: Tenant al que pertenece la invitación.

Column: workspace_id
Type: UUID
Nullable: NO
Primary Key: NO
Description: Workspace al que se invita al destinatario.

Column: email
Type: VARCHAR(320)
Nullable: NO
Primary Key: NO
Description: Correo del invitado.

Column: role_id
Type: UUID
Nullable: NO
Primary Key: NO
Description: Rol con el que ingresará una vez aceptada.

Column: token_hash
Type: TEXT
Nullable: NO
Primary Key: NO
Description: Hash del token seguro enviado en el enlace de invitación.

Column: invited_by
Type: UUID
Nullable: NO
Primary Key: NO
Description: Usuario que emitió la invitación.

Column: expires_at
Type: TIMESTAMPTZ
Nullable: NO
Primary Key: NO
Description: Fecha de expiración de la invitación.

Column: accepted_at
Type: TIMESTAMPTZ
Nullable: YES
Primary Key: NO
Description: Fecha en que el invitado activó su cuenta.

Column: revoked_at
Type: TIMESTAMPTZ
Nullable: YES
Primary Key: NO
Description: Fecha de cancelación manual de la invitación.

Column: created_at
Type: TIMESTAMPTZ
Nullable: NO
Primary Key: NO
Description: Fecha de despacho de la invitación.

---

## Table: channels

Column: id
Type: UUID
Nullable: NO
Primary Key: YES
Description: Identificador único del canal de comunicación.

Column: tenant_id
Type: UUID
Nullable: NO
Primary Key: NO
Description: Identificador del tenant.

Column: workspace_id
Type: UUID
Nullable: NO
Primary Key: NO
Description: Workspace donde reside el canal. Constraint UNIQUE(workspace_id, slug).

Column: name
Type: VARCHAR(100)
Nullable: NO
Primary Key: NO
Description: Nombre del canal (ej. general, development, support).

Column: slug
Type: VARCHAR(120)
Nullable: NO
Primary Key: NO
Description: Identificador para URLs y menciones #canal.

Column: description
Type: TEXT
Nullable: YES
Primary Key: NO
Description: Propósito o temas a tratar en el canal.

Column: channel_type
Type: VARCHAR(30)
Nullable: NO
Primary Key: NO
Description: Tipo de canal: public o private.

Column: is_archived
Type: BOOLEAN
Nullable: NO
Primary Key: NO
Description: Indica si el canal fue archivado en modo solo lectura.

Column: created_by
Type: UUID
Nullable: NO
Primary Key: NO
Description: Usuario creador del canal.

Column: created_at
Type: TIMESTAMPTZ
Nullable: NO
Primary Key: NO
Description: Fecha de creación.

Column: updated_at
Type: TIMESTAMPTZ
Nullable: NO
Primary Key: NO
Description: Fecha de modificación.

Column: deleted_at
Type: TIMESTAMPTZ
Nullable: YES
Primary Key: NO
Description: Fecha de borrado lógico.

---

## Table: channel_members

Column: channel_id
Type: UUID
Nullable: NO
Primary Key: YES
Description: Canal suscrito.

Column: user_id
Type: UUID
Nullable: NO
Primary Key: YES
Description: Usuario participante.

Column: joined_at
Type: TIMESTAMPTZ
Nullable: NO
Primary Key: NO
Description: Fecha de unión al canal.

Column: last_read_at
Type: TIMESTAMPTZ
Nullable: YES
Primary Key: NO
Description: Marca de agua de lectura para cálculo de mensajes no leídos.

Column: is_muted
Type: BOOLEAN
Nullable: NO
Primary Key: NO
Description: Silencia notificaciones push o de escritorio.

Column: notifications_enabled
Type: BOOLEAN
Nullable: NO
Primary Key: NO
Description: Habilitación global de notificaciones para este canal.

---

## Table: conversations

Column: id
Type: UUID
Nullable: NO
Primary Key: YES
Description: Identificador de conversación directa o grupal fuera de canales.

Column: tenant_id
Type: UUID
Nullable: NO
Primary Key: NO
Description: Tenant propietario.

Column: workspace_id
Type: UUID
Nullable: NO
Primary Key: NO
Description: Workspace contextual.

Column: conversation_type
Type: VARCHAR(30)
Nullable: NO
Primary Key: NO
Description: direct (1 a 1) o group (grupo ad-hoc).

Column: name
Type: VARCHAR(150)
Nullable: YES
Primary Key: NO
Description: Nombre opcional en caso de conversaciones grupales.

Column: created_by
Type: UUID
Nullable: NO
Primary Key: NO
Description: Creador de la conversación.

Column: created_at
Type: TIMESTAMPTZ
Nullable: NO
Primary Key: NO
Description: Fecha de inicio de la conversación.

Column: updated_at
Type: TIMESTAMPTZ
Nullable: NO
Primary Key: NO
Description: Fecha de última interacción o actualización.

Column: deleted_at
Type: TIMESTAMPTZ
Nullable: YES
Primary Key: NO
Description: Borrado lógico.

---

## Table: conversation_members

Column: conversation_id
Type: UUID
Nullable: NO
Primary Key: YES
Description: Conversación vinculada.

Column: user_id
Type: UUID
Nullable: NO
Primary Key: YES
Description: Usuario participante.

Column: joined_at
Type: TIMESTAMPTZ
Nullable: NO
Primary Key: NO
Description: Fecha de adhesión a la conversación.

Column: last_read_at
Type: TIMESTAMPTZ
Nullable: YES
Primary Key: NO
Description: Última lectura de mensajes.

Column: is_muted
Type: BOOLEAN
Nullable: NO
Primary Key: NO
Description: Silenciado por el usuario.

Column: is_admin
Type: BOOLEAN
Nullable: NO
Primary Key: NO
Description: Administrador de la conversación grupal.

Column: left_at
Type: TIMESTAMPTZ
Nullable: YES
Primary Key: NO
Description: Fecha en la que abandonó el chat.

---

## Table: messages

Column: id
Type: UUID
Nullable: NO
Primary Key: YES
Description: Identificador único universal del mensaje.

Column: tenant_id
Type: UUID
Nullable: NO
Primary Key: NO
Description: Tenant del mensaje para aislamiento estricto.

Column: workspace_id
Type: UUID
Nullable: NO
Primary Key: NO
Description: Workspace del mensaje.

Column: channel_id
Type: UUID
Nullable: YES
Primary Key: NO
Description: Canal de destino. Excluyente con conversation_id (chk_message_target).

Column: conversation_id
Type: UUID
Nullable: YES
Primary Key: NO
Description: Conversación privada de destino. Excluyente con channel_id.

Column: sender_id
Type: UUID
Nullable: NO
Primary Key: NO
Description: Usuario autor del mensaje.

Column: parent_message_id
Type: UUID
Nullable: YES
Primary Key: NO
Description: Mensaje padre si este mensaje es respuesta en un hilo de discusión.

Column: content
Type: TEXT
Nullable: NO
Primary Key: NO
Description: Contenido en texto o Markdown con soporte de sintaxis de código.

Column: message_type
Type: VARCHAR(30)
Nullable: NO
Primary Key: NO
Description: text, system, file, image, audio, video.

Column: is_edited
Type: BOOLEAN
Nullable: NO
Primary Key: NO
Description: TRUE si fue modificado con posterioridad al envío.

Column: edited_at
Type: TIMESTAMPTZ
Nullable: YES
Primary Key: NO
Description: Fecha de la última edición.

Column: is_deleted
Type: BOOLEAN
Nullable: NO
Primary Key: NO
Description: Bandera de borrado por moderación o usuario.

Column: deleted_at
Type: TIMESTAMPTZ
Nullable: YES
Primary Key: NO
Description: Fecha de eliminación lógica.

Column: created_at
Type: TIMESTAMPTZ
Nullable: NO
Primary Key: NO
Description: Fecha de publicación en UTC.

Column: updated_at
Type: TIMESTAMPTZ
Nullable: NO
Primary Key: NO
Description: Fecha de actualización del registro.

---

## Table: message_reactions

Column: id
Type: UUID
Nullable: NO
Primary Key: YES
Description: Identificador de la reacción.

Column: message_id
Type: UUID
Nullable: NO
Primary Key: NO
Description: Mensaje sobre el que se reacciona.

Column: user_id
Type: UUID
Nullable: NO
Primary Key: NO
Description: Usuario que reaccionó. Constraint UNIQUE(message_id, user_id, emoji).

Column: emoji
Type: VARCHAR(50)
Nullable: NO
Primary Key: NO
Description: Glifo o código unicode del emoji (ej. 🚀, 👍).

Column: created_at
Type: TIMESTAMPTZ
Nullable: NO
Primary Key: NO
Description: Fecha en que se agregó la reacción.

---

## Table: message_reads

Column: message_id
Type: UUID
Nullable: NO
Primary Key: YES
Description: Mensaje consultado.

Column: user_id
Type: UUID
Nullable: NO
Primary Key: YES
Description: Usuario receptor que leyó el mensaje.

Column: read_at
Type: TIMESTAMPTZ
Nullable: NO
Primary Key: NO
Description: Fecha y hora exacta de lectura.

---

## Table: message_pins

Column: id
Type: UUID
Nullable: NO
Primary Key: YES
Description: Identificador del mensaje fijado.

Column: message_id
Type: UUID
Nullable: NO
Primary Key: NO
Description: Mensaje destacado en el canal o conversación.

Column: channel_id
Type: UUID
Nullable: YES
Primary Key: NO
Description: Canal donde queda fijado.

Column: conversation_id
Type: UUID
Nullable: YES
Primary Key: NO
Description: Conversación donde queda fijado.

Column: pinned_by
Type: UUID
Nullable: NO
Primary Key: NO
Description: Usuario que fijó el mensaje.

Column: created_at
Type: TIMESTAMPTZ
Nullable: NO
Primary Key: NO
Description: Fecha en que se fijó el mensaje.

---

## Table: files

Column: id
Type: UUID
Nullable: NO
Primary Key: YES
Description: Identificador del objeto de archivo.

Column: tenant_id
Type: UUID
Nullable: NO
Primary Key: NO
Description: Tenant propietario del archivo.

Column: uploaded_by
Type: UUID
Nullable: NO
Primary Key: NO
Description: Usuario que cargó el archivo.

Column: original_name
Type: VARCHAR(500)
Nullable: NO
Primary Key: NO
Description: Nombre original del archivo proporcionado por el usuario.

Column: storage_name
Type: VARCHAR(500)
Nullable: NO
Primary Key: NO
Description: Nombre anonimizado o UUID en el backend de almacenamiento.

Column: storage_provider
Type: VARCHAR(50)
Nullable: NO
Primary Key: NO
Description: Proveedor de storage: local, azure_blob, s3, minio.

Column: storage_path
Type: TEXT
Nullable: NO
Primary Key: NO
Description: Ruta completa en el bucket o contenedor (ej. /tenant/year/month/file.bin).

Column: mime_type
Type: VARCHAR(200)
Nullable: NO
Primary Key: NO
Description: Tipo MIME IANA (ej. application/pdf, image/png).

Column: extension
Type: VARCHAR(20)
Nullable: NO
Primary Key: NO
Description: Extensión de archivo normalizada (ej. .pdf, .ts).

Column: size_bytes
Type: BIGINT
Nullable: NO
Primary Key: NO
Description: Tamaño del archivo en bytes. Constraint CHECK(size_bytes >= 0).

Column: checksum
Type: VARCHAR(128)
Nullable: YES
Primary Key: NO
Description: Hash SHA-256 para verificación de integridad de datos.

Column: is_public
Type: BOOLEAN
Nullable: NO
Primary Key: NO
Description: Indica si el archivo puede accederse mediante enlace público sin sesión.

Column: created_at
Type: TIMESTAMPTZ
Nullable: NO
Primary Key: NO
Description: Fecha de subida.

Column: deleted_at
Type: TIMESTAMPTZ
Nullable: YES
Primary Key: NO
Description: Borrado lógico.

---

## Table: message_attachments

Column: id
Type: UUID
Nullable: NO
Primary Key: YES
Description: Identificador del vínculo adjunto.

Column: message_id
Type: UUID
Nullable: NO
Primary Key: NO
Description: Mensaje contenedor.

Column: file_id
Type: UUID
Nullable: NO
Primary Key: NO
Description: Archivo adjunto.

Column: created_at
Type: TIMESTAMPTZ
Nullable: NO
Primary Key: NO
Description: Fecha de adjuntado.

---

## Table: notifications

Column: id
Type: UUID
Nullable: NO
Primary Key: YES
Description: Identificador único de la notificación.

Column: tenant_id
Type: UUID
Nullable: NO
Primary Key: NO
Description: Tenant contextual.

Column: user_id
Type: UUID
Nullable: NO
Primary Key: NO
Description: Usuario destinatario de la notificación.

Column: notification_type
Type: VARCHAR(50)
Nullable: NO
Primary Key: NO
Description: Tipo: mention, direct_message, task_assigned, meeting_invite, system.

Column: title
Type: VARCHAR(200)
Nullable: NO
Primary Key: NO
Description: Título breve y descriptivo del evento.

Column: message
Type: TEXT
Nullable: NO
Primary Key: NO
Description: Detalle descriptivo de la notificación.

Column: entity_type
Type: VARCHAR(100)
Nullable: YES
Primary Key: NO
Description: Entidad asociada para navegación rápida (message, task, meeting).

Column: entity_id
Type: UUID
Nullable: YES
Primary Key: NO
Description: Clave primaria de la entidad asociada.

Column: is_read
Type: BOOLEAN
Nullable: NO
Primary Key: NO
Description: TRUE si ya fue vista o marcada como leída por el usuario.

Column: read_at
Type: TIMESTAMPTZ
Nullable: YES
Primary Key: NO
Description: Fecha y hora en que fue leída.

Column: created_at
Type: TIMESTAMPTZ
Nullable: NO
Primary Key: NO
Description: Fecha de generación. Indexado junto con (user_id, is_read, created_at DESC).

---

## Table: notification_preferences

Column: id
Type: UUID
Nullable: NO
Primary Key: YES
Description: Identificador de preferencia.

Column: tenant_id
Type: UUID
Nullable: NO
Primary Key: NO
Description: Tenant propietario.

Column: user_id
Type: UUID
Nullable: NO
Primary Key: NO
Description: Usuario titular. Constraint UNIQUE(user_id, notification_type).

Column: notification_type
Type: VARCHAR(50)
Nullable: NO
Primary Key: NO
Description: Tipo de evento notificado.

Column: in_app_enabled
Type: BOOLEAN
Nullable: NO
Primary Key: NO
Description: Habilita alertas en la aplicación web.

Column: email_enabled
Type: BOOLEAN
Nullable: NO
Primary Key: NO
Description: Habilita despacho de correos electrónicos.

Column: push_enabled
Type: BOOLEAN
Nullable: NO
Primary Key: NO
Description: Habilita notificaciones push a dispositivos móviles y WebPush.

Column: created_at
Type: TIMESTAMPTZ
Nullable: NO
Primary Key: NO
Description: Fecha de configuración.

Column: updated_at
Type: TIMESTAMPTZ
Nullable: NO
Primary Key: NO
Description: Fecha de modificación de preferencias.

---

## Table: tasks

Column: id
Type: UUID
Nullable: NO
Primary Key: YES
Description: Identificador de la tarea.

Column: tenant_id
Type: UUID
Nullable: NO
Primary Key: NO
Description: Tenant propietario.

Column: workspace_id
Type: UUID
Nullable: NO
Primary Key: NO
Description: Workspace del tablero Kanban.

Column: created_by
Type: UUID
Nullable: NO
Primary Key: NO
Description: Usuario autor o creador de la tarea.

Column: assigned_to
Type: UUID
Nullable: YES
Primary Key: NO
Description: Usuario asignado para la ejecución.

Column: title
Type: VARCHAR(250)
Nullable: NO
Primary Key: NO
Description: Título conciso de la tarea.

Column: description
Type: TEXT
Nullable: YES
Primary Key: NO
Description: Criterios de aceptación y especificación en Markdown.

Column: status
Type: VARCHAR(30)
Nullable: NO
Primary Key: NO
Description: pending, in_progress, completed, cancelled, postponed.

Column: priority
Type: VARCHAR(30)
Nullable: NO
Primary Key: NO
Description: low, medium, high, urgent.

Column: due_date
Type: TIMESTAMPTZ
Nullable: YES
Primary Key: NO
Description: Fecha límite de entrega.

Column: completed_at
Type: TIMESTAMPTZ
Nullable: YES
Primary Key: NO
Description: Fecha en que la tarea pasó al estado completed.

Column: created_at
Type: TIMESTAMPTZ
Nullable: NO
Primary Key: NO
Description: Fecha de apertura de la tarea.

Column: updated_at
Type: TIMESTAMPTZ
Nullable: NO
Primary Key: NO
Description: Fecha de última modificación.

Column: deleted_at
Type: TIMESTAMPTZ
Nullable: YES
Primary Key: NO
Description: Borrado lógico.

---

## Table: task_comments

Column: id
Type: UUID
Nullable: NO
Primary Key: YES
Description: Identificador del comentario.

Column: task_id
Type: UUID
Nullable: NO
Primary Key: NO
Description: Tarea comentada.

Column: user_id
Type: UUID
Nullable: NO
Primary Key: NO
Description: Autor del comentario.

Column: content
Type: TEXT
Nullable: NO
Primary Key: NO
Description: Contenido del comentario.

Column: created_at
Type: TIMESTAMPTZ
Nullable: NO
Primary Key: NO
Description: Fecha de publicación.

Column: updated_at
Type: TIMESTAMPTZ
Nullable: NO
Primary Key: NO
Description: Fecha de edición.

Column: deleted_at
Type: TIMESTAMPTZ
Nullable: YES
Primary Key: NO
Description: Borrado lógico.

---

## Table: task_attachments

Column: id
Type: UUID
Nullable: NO
Primary Key: YES
Description: Identificador del adjunto.

Column: task_id
Type: UUID
Nullable: NO
Primary Key: NO
Description: Tarea relacionada.

Column: file_id
Type: UUID
Nullable: NO
Primary Key: NO
Description: Archivo vinculado.

Column: created_at
Type: TIMESTAMPTZ
Nullable: NO
Primary Key: NO
Description: Fecha de adjuntado.

---

## Table: calendar_events

Column: id
Type: UUID
Nullable: NO
Primary Key: YES
Description: Identificador del evento de calendario.

Column: tenant_id
Type: UUID
Nullable: NO
Primary Key: NO
Description: Tenant propietario.

Column: workspace_id
Type: UUID
Nullable: NO
Primary Key: NO
Description: Workspace del evento.

Column: created_by
Type: UUID
Nullable: NO
Primary Key: NO
Description: Organizador del evento.

Column: title
Type: VARCHAR(250)
Nullable: NO
Primary Key: NO
Description: Asunto del evento.

Column: description
Type: TEXT
Nullable: YES
Primary Key: NO
Description: Agenda o notas de la sesión.

Column: start_at
Type: TIMESTAMPTZ
Nullable: NO
Primary Key: NO
Description: Fecha y hora de inicio.

Column: end_at
Type: TIMESTAMPTZ
Nullable: NO
Primary Key: NO
Description: Fecha y hora de culminación. CHECK (end_at >= start_at).

Column: location
Type: TEXT
Nullable: YES
Primary Key: NO
Description: Ubicación física o sala de reuniones.

Column: meeting_id
Type: UUID
Nullable: YES
Primary Key: NO
Description: Enlace opcional a sesión de videollamada virtual.

Column: is_all_day
Type: BOOLEAN
Nullable: NO
Primary Key: NO
Description: Indica si el evento abarca la jornada completa.

Column: recurrence_rule
Type: TEXT
Nullable: YES
Primary Key: NO
Description: Regla de repetición en formato RFC 5545 iCalendar (RRULE).

Column: created_at
Type: TIMESTAMPTZ
Nullable: NO
Primary Key: NO
Description: Fecha de registro.

Column: updated_at
Type: TIMESTAMPTZ
Nullable: NO
Primary Key: NO
Description: Fecha de actualización.

Column: deleted_at
Type: TIMESTAMPTZ
Nullable: YES
Primary Key: NO
Description: Borrado lógico.

---

## Table: calendar_event_attendees

Column: event_id
Type: UUID
Nullable: NO
Primary Key: YES
Description: Evento al que se convoca.

Column: user_id
Type: UUID
Nullable: NO
Primary Key: YES
Description: Usuario invitado.

Column: response_status
Type: VARCHAR(30)
Nullable: NO
Primary Key: NO
Description: pending, accepted, declined, tentative.

Column: created_at
Type: TIMESTAMPTZ
Nullable: NO
Primary Key: NO
Description: Fecha de envío de convocatoria.

Column: updated_at
Type: TIMESTAMPTZ
Nullable: NO
Primary Key: NO
Description: Fecha de respuesta del invitado.

---

## Table: meetings

Column: id
Type: UUID
Nullable: NO
Primary Key: YES
Description: Identificador de la reunión virtual.

Column: tenant_id
Type: UUID
Nullable: NO
Primary Key: NO
Description: Tenant propietario.

Column: workspace_id
Type: UUID
Nullable: NO
Primary Key: NO
Description: Workspace donde se genera la sesión.

Column: created_by
Type: UUID
Nullable: NO
Primary Key: NO
Description: Anfitrión de la reunión.

Column: title
Type: VARCHAR(250)
Nullable: NO
Primary Key: NO
Description: Asunto de la videollamada.

Column: meeting_code
Type: VARCHAR(100)
Nullable: NO
Primary Key: NO
Description: Código único de enlace de acceso (ej. pulse-eng-892).

Column: provider
Type: VARCHAR(50)
Nullable: NO
Primary Key: NO
Description: Proveedor de WebRTC: internal, livekit, zoom, teams.

Column: provider_room_id
Type: VARCHAR(250)
Nullable: YES
Primary Key: NO
Description: ID de sala en el cluster SFU/WebRTC externo.

Column: start_at
Type: TIMESTAMPTZ
Nullable: NO
Primary Key: NO
Description: Hora programada o de apertura.

Column: end_at
Type: TIMESTAMPTZ
Nullable: NO
Primary Key: NO
Description: Hora de finalización. CHECK (end_at >= start_at).

Column: status
Type: VARCHAR(30)
Nullable: NO
Primary Key: NO
Description: scheduled, active, ended, cancelled.

Column: created_at
Type: TIMESTAMPTZ
Nullable: NO
Primary Key: NO
Description: Fecha de creación.

Column: updated_at
Type: TIMESTAMPTZ
Nullable: NO
Primary Key: NO
Description: Fecha de cambio de estado.

---

## Table: meeting_participants

Column: meeting_id
Type: UUID
Nullable: NO
Primary Key: YES
Description: Reunión a la que ingresó el usuario.

Column: user_id
Type: UUID
Nullable: NO
Primary Key: YES
Description: Usuario participante.

Column: joined_at
Type: TIMESTAMPTZ
Nullable: NO
Primary Key: YES
Description: Marca temporal exacta de conexión a la sala.

Column: left_at
Type: TIMESTAMPTZ
Nullable: YES
Primary Key: NO
Description: Marca temporal de desconexión o abandono de sala.

---

## Table: audit_logs

Column: id
Type: UUID
Nullable: NO
Primary Key: YES
Description: Identificador único universal del registro de auditoría.

Column: tenant_id
Type: UUID
Nullable: NO
Primary Key: NO
Description: Tenant objeto de la auditoría.

Column: user_id
Type: UUID
Nullable: YES
Primary Key: NO
Description: Usuario ejecutor de la acción (NULL en eventos de sistema).

Column: action
Type: VARCHAR(100)
Nullable: NO
Primary Key: NO
Description: Código semántico de acción (LOGIN, USER_CREATED, MESSAGE_DELETED, etc.).

Column: entity_type
Type: VARCHAR(100)
Nullable: NO
Primary Key: NO
Description: Entidad impactada (user, channel, message, task, settings).

Column: entity_id
Type: UUID
Nullable: YES
Primary Key: NO
Description: Identificador de la entidad impactada.

Column: ip_address
Type: INET
Nullable: YES
Primary Key: NO
Description: Dirección IP de origen.

Column: user_agent
Type: TEXT
Nullable: YES
Primary Key: NO
Description: Encabezado User-Agent del cliente.

Column: request_id
Type: UUID
Nullable: YES
Primary Key: NO
Description: Identificador de correlación distribuida de la petición HTTP.

Column: metadata
Type: JSONB
Nullable: YES
Primary Key: NO
Description: Payload con snapshot de campos modificados o contexto de seguridad.

Column: created_at
Type: TIMESTAMPTZ
Nullable: NO
Primary Key: NO
Description: Marca temporal inmutable del evento.

---

## Table: refresh_tokens

Column: id
Type: UUID
Nullable: NO
Primary Key: YES
Description: Identificador del token.

Column: tenant_id
Type: UUID
Nullable: NO
Primary Key: NO
Description: Tenant correspondiente.

Column: user_id
Type: UUID
Nullable: NO
Primary Key: NO
Description: Usuario beneficiario.

Column: token_hash
Type: TEXT
Nullable: NO
Primary Key: NO
Description: Hash criptográfico del token para rotación segura.

Column: expires_at
Type: TIMESTAMPTZ
Nullable: NO
Primary Key: NO
Description: Fecha de caducidad del token.

Column: revoked_at
Type: TIMESTAMPTZ
Nullable: YES
Primary Key: NO
Description: Fecha de revocación si fue invalidado.

Column: created_at
Type: TIMESTAMPTZ
Nullable: NO
Primary Key: NO
Description: Fecha de emisión.

---

## Table: subscription_plans

Column: id
Type: UUID
Nullable: NO
Primary Key: YES
Description: Identificador del plan.

Column: code
Type: VARCHAR(50)
Nullable: NO
Primary Key: NO
Description: Código de plan: Free, Pro, Business, Enterprise. Constraint UNIQUE.

Column: name
Type: VARCHAR(100)
Nullable: NO
Primary Key: NO
Description: Nombre comercial del plan.

Column: description
Type: TEXT
Nullable: YES
Primary Key: NO
Description: Resumen de límites y capacidades.

Column: price_cents
Type: INTEGER
Nullable: NO
Primary Key: NO
Description: Precio base en centavos.

Column: billing_period
Type: VARCHAR(20)
Nullable: NO
Primary Key: NO
Description: monthly o annual.

Column: features
Type: JSONB
Nullable: NO
Primary Key: NO
Description: Configuración de límites (usuarios, almacenamiento en GB, retención de mensajes).

Column: is_active
Type: BOOLEAN
Nullable: NO
Primary Key: NO
Description: Disponible para nuevas contrataciones.

Column: created_at
Type: TIMESTAMPTZ
Nullable: NO
Primary Key: NO
Description: Fecha de alta.

Column: updated_at
Type: TIMESTAMPTZ
Nullable: NO
Primary Key: NO
Description: Fecha de actualización.

---

## Table: subscriptions

Column: id
Type: UUID
Nullable: NO
Primary Key: YES
Description: Identificador de suscripción.

Column: tenant_id
Type: UUID
Nullable: NO
Primary Key: NO
Description: Organización suscriptora.

Column: plan_id
Type: UUID
Nullable: NO
Primary Key: NO
Description: Plan contratado.

Column: status
Type: VARCHAR(30)
Nullable: NO
Primary Key: NO
Description: trialing, active, past_due, canceled.

Column: current_period_start
Type: TIMESTAMPTZ
Nullable: NO
Primary Key: NO
Description: Inicio del periodo de facturación en curso.

Column: current_period_end
Type: TIMESTAMPTZ
Nullable: NO
Primary Key: NO
Description: Fin del periodo contratado.

Column: cancel_at_period_end
Type: BOOLEAN
Nullable: NO
Primary Key: NO
Description: Indica si no se renovará al concluir el ciclo.

Column: external_customer_id
Type: VARCHAR(255)
Nullable: YES
Primary Key: NO
Description: Identificador de cliente en pasarela de pago (ej. Stripe / Adyen).

Column: external_subscription_id
Type: VARCHAR(255)
Nullable: YES
Primary Key: NO
Description: Identificador de suscripción en pasarela de pago.

Column: created_at
Type: TIMESTAMPTZ
Nullable: NO
Primary Key: NO
Description: Fecha de alta de la suscripción.

Column: updated_at
Type: TIMESTAMPTZ
Nullable: NO
Primary Key: NO
Description: Fecha de modificación de estado.

---

## Table: subscription_items

Column: id
Type: UUID
Nullable: NO
Primary Key: YES
Description: Identificador de ítem facturado.

Column: subscription_id
Type: UUID
Nullable: NO
Primary Key: NO
Description: Suscripción a la que pertenece el ítem.

Column: feature_key
Type: VARCHAR(100)
Nullable: NO
Primary Key: NO
Description: Clave de consumo (ej. additional_storage, extra_seats).

Column: quantity
Type: INTEGER
Nullable: NO
Primary Key: NO
Description: Unidades contratadas.

Column: unit_price_cents
Type: INTEGER
Nullable: NO
Primary Key: NO
Description: Precio unitario en centavos.

Column: created_at
Type: TIMESTAMPTZ
Nullable: NO
Primary Key: NO
Description: Fecha de inclusión del ítem.

---

## Table: invoices

Column: id
Type: UUID
Nullable: NO
Primary Key: YES
Description: Identificador de factura.

Column: tenant_id
Type: UUID
Nullable: NO
Primary Key: NO
Description: Tenant facturado.

Column: subscription_id
Type: UUID
Nullable: YES
Primary Key: NO
Description: Suscripción liquidada.

Column: invoice_number
Type: VARCHAR(100)
Nullable: NO
Primary Key: NO
Description: Número correlativo fiscal o comercial único.

Column: amount_due_cents
Type: INTEGER
Nullable: NO
Primary Key: NO
Description: Monto total a pagar en centavos.

Column: amount_paid_cents
Type: INTEGER
Nullable: NO
Primary Key: NO
Description: Monto efectivamente cobrado en centavos.

Column: currency
Type: VARCHAR(3)
Nullable: NO
Primary Key: NO
Description: Código ISO 4217 de moneda (ej. USD, EUR).

Column: status
Type: VARCHAR(30)
Nullable: NO
Primary Key: NO
Description: draft, open, paid, uncollectible, void.

Column: due_date
Type: TIMESTAMPTZ
Nullable: NO
Primary Key: NO
Description: Fecha límite de pago.

Column: paid_at
Type: TIMESTAMPTZ
Nullable: YES
Primary Key: NO
Description: Fecha en que se completó el pago.

Column: created_at
Type: TIMESTAMPTZ
Nullable: NO
Primary Key: NO
Description: Fecha de emisión.

---

## Table: payments

Column: id
Type: UUID
Nullable: NO
Primary Key: YES
Description: Identificador de transacción de cobro.

Column: tenant_id
Type: UUID
Nullable: NO
Primary Key: NO
Description: Tenant pagador.

Column: invoice_id
Type: UUID
Nullable: NO
Primary Key: NO
Description: Factura abonada.

Column: amount_cents
Type: INTEGER
Nullable: NO
Primary Key: NO
Description: Monto liquidado en centavos.

Column: currency
Type: VARCHAR(3)
Nullable: NO
Primary Key: NO
Description: Moneda de cobro.

Column: payment_method
Type: VARCHAR(50)
Nullable: NO
Primary Key: NO
Description: credit_card, sepa_debit, wire_transfer.

Column: payment_gateway
Type: VARCHAR(50)
Nullable: NO
Primary Key: NO
Description: Pasarela procesadora (stripe, adyen).

Column: gateway_transaction_id
Type: VARCHAR(255)
Nullable: YES
Primary Key: NO
Description: ID de transacción provisto por la pasarela de pagos.

Column: status
Type: VARCHAR(30)
Nullable: NO
Primary Key: NO
Description: pending, succeeded, failed, refunded.

Column: created_at
Type: TIMESTAMPTZ
Nullable: NO
Primary Key: NO
Description: Fecha de transacción.

---

## Table: integrations

Column: id
Type: UUID
Nullable: NO
Primary Key: YES
Description: Identificador de integración externa.

Column: tenant_id
Type: UUID
Nullable: NO
Primary Key: NO
Description: Tenant habilitador.

Column: provider
Type: VARCHAR(50)
Nullable: NO
Primary Key: NO
Description: Proveedor: google, microsoft, github, jira, trello.

Column: name
Type: VARCHAR(100)
Nullable: NO
Primary Key: NO
Description: Nombre identificativo de la integración.

Column: is_active
Type: BOOLEAN
Nullable: NO
Primary Key: NO
Description: Estado operativo del conector.

Column: config
Type: JSONB
Nullable: NO
Primary Key: NO
Description: Parámetros y opciones específicas del conector.

Column: created_at
Type: TIMESTAMPTZ
Nullable: NO
Primary Key: NO
Description: Fecha de activación.

Column: updated_at
Type: TIMESTAMPTZ
Nullable: NO
Primary Key: NO
Description: Fecha de actualización de configuración.

---

## Table: oauth_connections

Column: id
Type: UUID
Nullable: NO
Primary Key: YES
Description: Identificador de conexión OAuth 2.0.

Column: tenant_id
Type: UUID
Nullable: NO
Primary Key: NO
Description: Tenant del usuario.

Column: user_id
Type: UUID
Nullable: NO
Primary Key: NO
Description: Usuario titular de la cuenta externa.

Column: provider
Type: VARCHAR(50)
Nullable: NO
Primary Key: NO
Description: google, microsoft, github, slack.

Column: account_id
Type: VARCHAR(255)
Nullable: NO
Primary Key: NO
Description: Identificador único provisto por el proveedor externo.

Column: account_email
Type: VARCHAR(320)
Nullable: YES
Primary Key: NO
Description: Correo asociado en la plataforma externa.

Column: access_token_hash
Type: TEXT
Nullable: NO
Primary Key: NO
Description: Token de acceso cifrado en reposo.

Column: refresh_token_hash
Type: TEXT
Nullable: YES
Primary Key: NO
Description: Token de refresco cifrado en reposo.

Column: token_expires_at
Type: TIMESTAMPTZ
Nullable: YES
Primary Key: NO
Description: Expiración del token de acceso.

Column: scopes
Type: TEXT[]
Nullable: NO
Primary Key: NO
Description: Permisos autorizados por el usuario.

Column: created_at
Type: TIMESTAMPTZ
Nullable: NO
Primary Key: NO
Description: Fecha de autorización.

Column: updated_at
Type: TIMESTAMPTZ
Nullable: NO
Primary Key: NO
Description: Fecha de refresco de credenciales.

---

## Table: webhooks

Column: id
Type: UUID
Nullable: NO
Primary Key: YES
Description: Identificador del webhook.

Column: tenant_id
Type: UUID
Nullable: NO
Primary Key: NO
Description: Tenant propietario.

Column: workspace_id
Type: UUID
Nullable: NO
Primary Key: NO
Description: Workspace emisor de eventos.

Column: target_url
Type: TEXT
Nullable: NO
Primary Key: NO
Description: URL de destino del consumidor externo.

Column: secret_hash
Type: TEXT
Nullable: NO
Primary Key: NO
Description: Secreto compartido para firma HMAC SHA-256 de las cargas útiles.

Column: subscribed_events
Type: TEXT[]
Nullable: NO
Primary Key: NO
Description: Lista de eventos suscritos (ej. message.created, task.updated).

Column: is_active
Type: BOOLEAN
Nullable: NO
Primary Key: NO
Description: Estado activo o pausado del webhook.

Column: created_at
Type: TIMESTAMPTZ
Nullable: NO
Primary Key: NO
Description: Fecha de registro.

Column: updated_at
Type: TIMESTAMPTZ
Nullable: NO
Primary Key: NO
Description: Fecha de modificación.

---

## Table: api_keys

Column: id
Type: UUID
Nullable: NO
Primary Key: YES
Description: Identificador de la API Key.

Column: tenant_id
Type: UUID
Nullable: NO
Primary Key: NO
Description: Tenant propietario.

Column: created_by
Type: UUID
Nullable: NO
Primary Key: NO
Description: Desarrollador o administrador que generó la clave.

Column: key_prefix
Type: VARCHAR(16)
Nullable: NO
Primary Key: NO
Description: Primeros caracteres visibles para identificación rápida (ej. cp_live_4f89...).

Column: key_hash
Type: TEXT
Nullable: NO
Primary Key: NO
Description: Hash SHA-256 de la clave completa. La clave en texto claro solo se muestra al crearla.

Column: name
Type: VARCHAR(100)
Nullable: NO
Primary Key: NO
Description: Nombre de la clave o servicio consumidor.

Column: scopes
Type: TEXT[]
Nullable: NO
Primary Key: NO
Description: Alcances y permisos permitidos para esta clave.

Column: expires_at
Type: TIMESTAMPTZ
Nullable: YES
Primary Key: NO
Description: Fecha de expiración de la clave.

Column: last_used_at
Type: TIMESTAMPTZ
Nullable: YES
Primary Key: NO
Description: Última fecha en que fue utilizada para autenticar una solicitud.

Column: created_at
Type: TIMESTAMPTZ
Nullable: NO
Primary Key: NO
Description: Fecha de creación.

Column: revoked_at
Type: TIMESTAMPTZ
Nullable: YES
Primary Key: NO
Description: Fecha de revocación manual de la clave.
