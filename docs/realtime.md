# Arquitectura de Tiempo Real (SignalR y Redis Backplane)

## 1. Hub Central (`ChatHub`)
- Endpoint WebSocket: `/hubs/chat`
- Transporte: WebSockets como preferencia primaria, con degradación automática a Server-Sent Events (SSE) o Long Polling.
- Autenticación en WebSocket: El token JWT se transmite mediante el query parameter `access_token` en el handshake inicial.

## 2. Escalabilidad Horizontal (Redis Backplane)
- Cuando la aplicación escala a múltiples instancias en Kubernetes / Cloud Run, SignalR utiliza Redis Pub/Sub como bus de mensajes para asegurar que un mensaje emitido en el nodo A sea distribuido a los clientes conectados en el nodo B.

## 3. Catálogo de Eventos en Tiempo Real
- `ReceiveMessage(message)`: Difusión inmediata de nuevo mensaje en un canal o chat privado.
- `MessageUpdated(message)`: Actualización en vivo de contenido editado.
- `MessageDeleted(messageId)`: Notificación para remover el mensaje en la vista.
- `UserTyping(channelId, userId, userName)`: Indicador efímero de tipeo (auto-expira a los 3 segundos).
- `UserPresenceChanged(userId, status)`: Sincronización de presencia (Online, Away, Busy, Dnd, Offline).
- `NotificationReceived(notification)`: Alerta en vivo para campana de notificaciones.
