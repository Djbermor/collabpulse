# Arquitectura del Frontend (Angular Enterprise SPA)

## 1. Estructura Modular
El frontend está implementado con Angular 17+ y TypeScript bajo una arquitectura orientada a dominios:
- `src/app/core/`: Servicios singleton globales (AuthService, SignalRService, HttpInterceptor, AuthGuard, ErrorHandler).
- `src/app/features/`: Módulos de funcionalidad desacoplados (Channels, Messages, DirectMessages, Tasks, Calendar, Meetings, Settings).
- `src/app/shared/`: Componentes reutilizables, directivas de teclado, tuberías de formato de fecha y validadores.
- `src/app/layouts/`: Contenedores estructurales (AuthLayout para login/registro, ApplicationLayout con barra de navegación lateral y área de contenido central).

## 2. Gestión de Estado y Reactividad
- **RxJS y Signals:** Utilización de Signals de Angular para estado reactivo local y BehaviorSubjects para streams de eventos en tiempo real.
- **Cache Local:** Almacenamiento en memoria de mensajes y presencia para una transición visual instantánea (cero parpadeos).
- **Desconexión tolerante:** Reconexión automática exponencial con cola de mensajes pendientes.
