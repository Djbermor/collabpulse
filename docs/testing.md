# Estrategia Integral de Testing y QA

## 1. Niveles de Pruebas
1. **Pruebas Unitarias (xUnit, Moq, FluentAssertions):**
   - Verificación de lógica de entidades de dominio y reglas de negocio.
   - Handlers y validadores de MediatR en la capa Application.
2. **Pruebas de Arquitectura (CollabPulse.ArchitectureTests):**
   - Validación automática de reglas de Clean Architecture (Domain no depende de capas externas).
3. **Pruebas de Integración (WebApplicationFactory, Testcontainers):**
   - Validación de endpoints HTTP reales y persistencia contra contenedor PostgreSQL.
4. **Pruebas End-to-End (Playwright):**
   - Flujos completos de usuario: Registro -> Crear Workspace -> Enviar Mensaje -> Crear Tarea.
5. **Pruebas de Rendimiento y Carga (k6):**
   - Evaluación bajo concurrencia masiva (tests/performance/messages.js) garantizando p95 < 200ms.
