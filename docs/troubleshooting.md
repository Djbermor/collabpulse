# Guía de Resolución de Problemas (Troubleshooting)

## 1. Problemas Frecuentes

### 1.1 Error de Conexión a Base de Datos
- **Síntoma:** `NpgsqlException: Connection refused`
- **Causa:** El contenedor de PostgreSQL aún no ha completado el inicio.
- **Solución:** Comprobar estado con `docker ps` y verificar logs con `docker logs collabpulse-postgres`.

### 1.2 Handshake de SignalR Fallido
- **Síntoma:** WebSocket connection failed / 401 Unauthorized en `/hubs/chat`.
- **Causa:** El token JWT no se pasó en la cabecera `access_token` durante el handshake inicial.
- **Solución:** Comprobar que `SignalRService` configure `accessTokenFactory`.

### 1.3 Violación de Política RLS (PostgreSQL)
- **Síntoma:** Las consultas SELECT devuelven 0 filas a pesar de existir registros.
- **Causa:** La variable de sesión `app.current_tenant_id` no fue establecida por el middleware antes de ejecutar la consulta.
- **Solución:** Asegurar que `TenantResolutionMiddleware` y el interceptor de DbContext configuren `SET LOCAL app.current_tenant_id`.

## 2. Script de Reseteo Rápido
```bash
bash scripts/reset-db.sh
```
