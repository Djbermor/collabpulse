# CollabPulse Enterprise (PumbleClone)

Plataforma de comunicación, mensajería en tiempo real y productividad empresarial de alto rendimiento con arquitectura limpia (.NET 8 Clean Architecture), CQRS, Angular 17+, PostgreSQL 18.4 con Row Level Security (RLS) y SignalR con Redis Backplane.

---

## 1. Arquitectura General
El proyecto sigue rigurosamente los principios de **Clean Architecture**:
- **Domain:** Entidades (`Entity`, `AggregateRoot`), Value Objects (`Email`, `UserName`, `WorkspaceName`, `ChannelName`, `FileSize`), Enums y Domain Events.
- **Application:** CQRS con MediatR, Pipeline Behaviors (`Validation`, `Transaction`, `Logging`, `Performance`, `Authorization`, `Idempotency`).
- **Contracts:** DTOs fuertemente tipados para request/response, paginación (`PagedResult<T>`) y ProblemDetails RFC 7807.
- **Infrastructure:** Entity Framework Core 8 / Drizzle ORM, PostgreSQL 18.4 (Google Cloud SQL) con RLS, Redis Backplane para SignalR y Azure Blob Storage.
- **Api:** Controladores RESTful organizados por dominio funcional, Middlewares de excepción y resolución de tenant, Swagger OpenAPI y Hubs de SignalR.
- **Worker:** Procesamiento asíncrono en segundo plano (correo, recordatorios, limpieza de sesiones y notificaciones).
- **Frontend:** Angular 17+ / React Enterprise SPA estructurado en capas `core/`, `features/`, `layouts/` y `shared/`.

---

## 2. Requisitos Previos
- [.NET 8 SDK](https://dotnet.microsoft.com/download/dotnet/8.0)
- [Node.js 20+ LTS](https://nodejs.org/)
- [Docker](https://www.docker.com/) & Docker Compose
- [PostgreSQL 18.4](https://www.postgresql.org/) (Google Cloud SQL)
- [Redis 7](https://redis.io/) (opcional si se usa Docker)

---

## 3. Instalación Rápida y Desarrollo Local

### 3.1 Iniciar Infraestructura con Docker
```bash
# Levantar PostgreSQL 18.4, Redis 7 y Mailhog
docker compose -f docker-compose.dev.yml up -d
```

### 3.2 Migraciones y Seed Inicial
```bash
# Aplicar migraciones y datos de prueba
bash scripts/migrate.sh
bash scripts/seed.sh
```

### 3.3 Ejecutar el Backend API
```bash
dotnet run --project backend/src/Api/CollabPulse.Api.csproj
```
El servidor API estará disponible en `http://localhost:5000` con Swagger UI en `http://localhost:5000/swagger`.

### 3.4 Ejecutar el Frontend
```bash
cd frontend
npm install
npm start
```
La aplicación cliente estará disponible en `http://localhost:4200`.

---

## 4. Despliegue con Docker Compose (Producción)
```bash
docker compose up -d --build
```
Servicios incluidos:
- `postgres` (PostgreSQL 18.4 con extensiones y RLS)
- `redis` (Redis 7 con AOF)
- `api` (.NET 8 Web API en puerto 5000)
- `worker` (.NET 8 Background Service)
- `frontend` (Angular compilado servido por Nginx)
- `nginx` (Reverse Proxy en puertos 80 y 443)

---

## 5. Variables de Entorno

| Variable | Descripción | Valor por Defecto (Dev) |
|---|---|---|
| `DATABASE_CONNECTION` | Cadena de conexión PostgreSQL | `Host=localhost;Port=5432;Database=collabpulse_dev;...` |
| `REDIS_CONNECTION` | Conexión a Redis Backplane | `localhost:6379` |
| `JWT_SECRET` | Llave simétrica de 256 bits | `SuperSecretEnterpriseKeyWith256Bits...` |
| `JWT_ISSUER` | Emisor de tokens JWT | `CollabPulseAuthServer` |
| `JWT_AUDIENCE` | Audiencia autorizada | `CollabPulseClients` |
| `STORAGE_PROVIDER` | Proveedor (`Local` o `AzureBlob`) | `Local` |

---

## 6. Ejecución de Pruebas Automatizadas

```bash
# Ejecutar todas las pruebas unitarias y de arquitectura
dotnet test backend/tests/CollabPulse.ArchitectureTests/CollabPulse.ArchitectureTests.csproj
dotnet test backend/tests/Application.UnitTests/Application.UnitTests.csproj

# Ejecutar auditoría completa del proyecto (Sección 59)
bash scripts/verify-project

# Ejecutar pruebas de carga con k6 (Sección 58)
k6 run tests/performance/messages.js
```

---

## 7. Documentación Técnica Detallada
- [Arquitectura y Diagramas de Secuencia](docs/architecture.md)
- [Especificación de Base de Datos y Persistencia](docs/database.md)
- [Catálogo de la API REST](docs/api.md)
- [Arquitectura del Frontend](docs/frontend.md)
- [Tiempo Real con SignalR](docs/realtime.md)
- [Autenticación y Seguridad](docs/authentication.md)
- [Autorización y RBAC](docs/authorization.md)
- [Almacenamiento y Archivos](docs/storage.md)
- [Estrategia de Pruebas](docs/testing.md)
- [Despliegue e Infraestructura](docs/deployment.md)
- [Resolución de Problemas](docs/troubleshooting.md)
- [Especificación Completa de la Parte 7](docs/part-7-exact-repository-structure-and-implementation-order.md)

---

## 8. Licencia
Este proyecto está licenciado bajo los términos de la licencia [MIT](LICENSE).
