# PARTE 7 — ESTRUCTURA EXACTA DEL REPOSITORIO Y ORDEN DE IMPLEMENTACIÓN

## 1. OBJETIVO DE ESTA PARTE
A partir de esta parte, el agente de desarrollo cuenta con la especificación completa y canónica para la construcción real del sistema. Para evitar implementaciones desordenadas, decisiones inconsistentes o componentes faltantes, este documento define:
1. La estructura completa del repositorio y de cada proyecto.
2. La ubicación exacta de cada archivo relevante.
3. El orden cronológico y modular de construcción e implementación (25 fases).
4. El conjunto de documentación técnica requerida.
5. Las verificaciones arquitectónicas y operativas automáticas.

---

## 2. REPOSITORIO PRINCIPAL
```text
pumble-clone/
├── backend/
│   ├── src/
│   │   ├── CollabPulse.Api/
│   │   ├── CollabPulse.Application/
│   │   ├── CollabPulse.Domain/
│   │   ├── CollabPulse.Infrastructure/
│   │   ├── CollabPulse.Contracts/
│   │   └── CollabPulse.Worker/
│   └── tests/
│       ├── CollabPulse.UnitTests/
│       ├── CollabPulse.IntegrationTests/
│       └── CollabPulse.ArchitectureTests/
├── frontend/
│   └── pumble-clone-web/ (Angular 17+ Enterprise SPA)
│       ├── src/app/core/
│       ├── src/app/features/
│       ├── src/app/layouts/
│       └── src/app/shared/
├── infrastructure/
│   ├── docker/
│   ├── kubernetes/
│   └── terraform/
├── database/
│   ├── migrations/
│   ├── schema/
│   └── seeds/
├── tests/
│   ├── performance/ (k6 suites)
│   ├── contract/
│   └── e2e/ (Playwright)
├── docs/
│   ├── architecture.md
│   ├── database.md
│   ├── api.md
│   ├── frontend.md
│   ├── realtime.md
│   ├── authentication.md
│   ├── authorization.md
│   ├── storage.md
│   ├── testing.md
│   ├── deployment.md
│   └── troubleshooting.md
├── scripts/
│   ├── migrate.sh
│   ├── seed.sh
│   ├── reset-db.sh
│   └── verify-project
├── docker/
│   ├── Dockerfile.api
│   ├── Dockerfile.worker
│   ├── Dockerfile.frontend
│   └── nginx/nginx.conf
├── .editorconfig
├── .gitignore
├── README.md
├── LICENSE
├── docker-compose.yml
└── docker-compose.dev.yml
```

---

## 3. ORDEN CANÓNICO DE IMPLEMENTACIÓN (25 PASOS)

| Paso | Módulo / Fase | Entregable Clave |
|---|---|---|
| **01** | Inicialización de Repositorio | Estructura base, `.editorconfig`, `.gitignore`, `docker-compose.yml`, `README.md` |
| **02** | Base de Datos Base | Esquemas SQL, extensiones (pgcrypto, uuid-ossp), RLS |
| **03** | Dominio Núcleo | Entidades base, Value Objects, Enums, Eventos, Reglas de negocio |
| **04** | Capa de Contratos | DTOs de Request/Response, PagedResult, ProblemDetails |
| **05** | Aplicación: Autenticación | Comandos y queries MediatR: Register, Login, RefreshToken |
| **06** | Infraestructura: Persistencia | `ApplicationDbContext`, Mapeos EF Core, Migraciones, Repositorios |
| **07** | Infraestructura: Auth & Seguridad | Argon2id PasswordHasher, JwtTokenGenerator, CurrentUserService |
| **08** | API: Autenticación & Middlewares | `AuthController`, ExceptionHandling, TenantResolution, Swagger |
| **09** | Dominio y Aplicación: Workspaces | Creación de workspace, invitaciones, roles (Owner, Admin, Member, Guest) |
| **10** | Dominio y Aplicación: Canales | Canales públicos/privados, membresía, permisos |
| **11** | Dominio y Aplicación: Mensajería | Mensajes directos y de canal, hilos, reacciones, edición, borrado suave |
| **12** | Infraestructura: Realtime (SignalR) | `ChatHub`, Redis Backplane, eventos de mensaje, tipeo y presencia |
| **13** | Aplicación: Búsqueda | Búsqueda Full-Text con tsvector/GIN en mensajes, canales y archivos |
| **14** | Dominio y Aplicación: Archivos | Validación de extensiones, tamaños, almacenamiento local y Azure Blob |
| **15** | Dominio y Aplicación: Tareas | Creación, asignación, prioridades, fechas de vencimiento, estados |
| **16** | Dominio y Aplicación: Calendario | Eventos, asistentes, recordatorios, integración de zonas horarias |
| **17** | Dominio y Aplicación: Videollamadas | Creación de salas, tokens WebRTC (LiveKit / Twilio), estado de llamada |
| **18** | Dominio y Aplicación: Notificaciones | Despacho en tiempo real, alertas por mención, correo transaccional |
| **19** | Capa Worker (Background Jobs) | Despacho de emails, limpieza de sesiones expiradas, recordatorios |
| **20** | Frontend: Core & Layouts | Autenticación, interceptores JWT, guards, layout con barra lateral |
| **21** | Frontend: Canales & Mensajería | Vista de canal, chat en tiempo real, indicador de tipeo, editor markdown |
| **22** | Frontend: Tareas & Calendario | Tablero Kanban / listas de tareas, vista de agenda de calendario |
| **23** | Frontend: Videollamadas & Config | Integración de audio/video, ajustes de perfil, administración |
| **24** | Pruebas Integrales & Rendimiento | Suites xUnit, ArchitectureTests, Testcontainers, k6 (p95 < 200ms) |
| **25** | Hardening & Auditoría Final | Verificación con `scripts/verify-project`, logs estructurados, checklist |

---

## 4. CHECKLIST DE CONFORMIDAD DE REPOSITORIO
- [x] Repositorio limpio y modular (Clean Architecture .NET 8).
- [x] Frontend desacoplado con Angular 17+ y arquitectura de módulos (`core`, `features`, `shared`, `layouts`).
- [x] Contenedores de desarrollo y producción listos (`docker-compose.yml`, `docker-compose.dev.yml`).
- [x] Scripts operacionales (`migrate.sh`, `seed.sh`, `reset-db.sh`, `verify-project`).
- [x] Documentación técnica de referencia (`docs/*.md`).
- [x] Cobertura de pruebas unitarias, arquitectónicas, de integración y de carga.
