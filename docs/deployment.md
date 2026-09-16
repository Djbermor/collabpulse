# Guía de Despliegue e Infraestructura

## 1. Despliegue Local con Docker Compose
```bash
# Iniciar servicios de infraestructura (PostgreSQL, Redis, Mailhog)
docker compose -f docker-compose.dev.yml up -d

# Iniciar la solución completa (API, Worker, Frontend, Nginx, DB, Redis)
docker compose up -d --build
```

## 2. Variables de Entorno de Producción
- `DATABASE_CONNECTION`: Cadena de conexión a PostgreSQL.
- `REDIS_CONNECTION`: Host, puerto y contraseña de Redis.
- `JWT_SECRET`: Llave simétrica de al menos 256 bits.
- `JWT_ISSUER`: Identificador del emisor.
- `JWT_AUDIENCE`: Clientes autorizados.
- `STORAGE_CONNECTION`: Cadena de conexión al almacenamiento de blobs.

## 3. Orquestación y Kubernetes
- Manifiestos listos en `infrastructure/kubernetes/` para despliegues escalables con Horizontal Pod Autoscaler (HPA) e Ingress NGINX con terminación TLS.
