# Guía Completa de Despliegue Productivo en Google Cloud — CollabPulse

Esta guía explica paso a paso cómo desplegar **CollabPulse Enterprise** en producción utilizando **Google Cloud Platform (GCP)** con **Google Cloud Run** y **PostgreSQL** (Cloud SQL o Serverless).

---

## Índice
1. [Arquitectura Productiva](#1-arquitectura-productiva)
2. [Paso Previo: Base de Datos PostgreSQL](#2-paso-previo-base-de-datos-postgresql)
   - [Opción A: Google Cloud SQL (Nativa GCP)](#opción-a-google-cloud-sql-nativa-gcp)
   - [Opción B: PostgreSQL Cloud Gratuito (Supabase / Neon)](#opción-b-postgresql-cloud-gratuito-supabase--neon)
3. [Método 1: Despliegue 100% desde el Navegador con Google Cloud Shell](#3-método-1-despliegue-100-desde-el-navegador-con-google-cloud-shell-recomendado)
4. [Método 2: Despliegue Continuo con GitHub y Cloud Run](#4-método-2-despliegue-continuo-con-github-y-cloud-run)
5. [Variables de Entorno para Producción](#5-variables-de-entorno-para-producción)
6. [Integración con Google AI Studio (Gemini)](#6-integración-con-google-ai-studio-gemini)
7. [Configuración de Dominio Personalizado y SSL](#7-configuración-de-dominio-personalizado-y-ssl)
8. [Monitoreo y Verificación](#8-monitoreo-y-verificación)

---

## 1. Arquitectura Productiva

CollabPulse se empaqueta en una única imagen de contenedor Docker lista para producción:
- **Frontend:** SPA React 19 compilada con Vite (`dist/`).
- **Backend:** Node.js 22 + Express compilado con esbuild (`dist/server.cjs`).
- **Realtime:** Hub Server-Sent Events (SSE) nativo sobre HTTP/2 y HTTPS.
- **Base de Datos:** PostgreSQL con auto-inicialización de 21 tablas relacionales y migraciones DDL automáticas.

---

## 2. Paso Previo: Base de Datos PostgreSQL

Antes de desplegar la aplicación en Cloud Run, necesitas una instancia de PostgreSQL en la nube:

### Opción A: Google Cloud SQL (Nativa GCP)
1. Ingresa a la [Consola de Google Cloud](https://console.cloud.google.com/).
2. En el menú de navegación, ve a **SQL** y haz clic en **Crear Instancia**.
3. Elige **PostgreSQL**.
4. Configuración recomendada:
   - **ID de Instancia:** `collabpulse-db`
   - **Contraseña:** Elige una contraseña segura (ej. `CollabPulse_Prod_2026!`).
   - **Versión:** PostgreSQL 16 o 15.
   - **Configuración predeterminada:** Producción o Desarrollo (según presupuesto).
   - En **Conexiones**, activa **IP pública** o habilita la conexión directa desde Cloud Run mediante el Cloud SQL Auth Proxy integrado.
5. En la pestaña **Bases de datos**, crea una base de datos llamada `collabpulse_prod`.

### Opción B: PostgreSQL Cloud Gratuito (Supabase / Neon)
Si deseas desplegar de inmediato sin costo de instancia fija:
1. Ve a [Supabase](https://supabase.com) o [Neon](https://neon.tech) y crea un proyecto gratuito.
2. Copia la cadena de conexión (Connection String URI):
   ```
   postgres://postgres:[TU_PASSWORD]@[HOST]:5432/postgres?sslmode=require
   ```
3. Esta cadena se usará como variable `DATABASE_URL` en Cloud Run.

---

## 3. Método 1: Despliegue 100% desde el Navegador con Google Cloud Shell (Recomendado)

No necesitas instalar Docker ni gcloud en tu máquina local.

1. Abre [Google Cloud Console](https://console.cloud.google.com/).
2. Haz clic en el ícono de **Cloud Shell** (icono `>_` en la barra superior derecha).
3. Sube la carpeta del proyecto a Cloud Shell (arrastrando el archivo comprimido o mediante Git):
   ```bash
   # Si usas Git:
   git clone <URL_DE_TU_REPOSITORIO>
   cd collabpulse---enterprise-communication-platform
   ```
4. Asigna permisos de ejecución al script de despliegue:
   ```bash
   chmod +x ./devops/scripts/deploy-gcp.sh
   ```
5. Ejecuta el despliegue indicando tu ID de proyecto de Google Cloud:
   ```bash
   ./devops/scripts/deploy-gcp.sh TU_PROJECT_ID us-central1
   ```
6. El script:
   - Habilitará automáticamente las APIs de Cloud Run y Artifact Registry.
   - Compilará la imagen de Docker en la nube con **Cloud Build**.
   - Desplegará el servicio en **Cloud Run** con HTTPS automático.
   - Al finalizar, te mostrará la URL pública de la aplicación.

---

## 4. Método 2: Despliegue Continuo con GitHub y Cloud Run

Si tienes el código en GitHub:

1. En la consola de Google Cloud, ve a **Cloud Run**.
2. Haz clic en **Crear servicio**.
3. Selecciona **Implementar continuamente nuevas revisiones desde un repositorio de código fuente**.
4. Haz clic en **Configurar con Cloud Build**.
5. Selecciona **GitHub**, autoriza el acceso y elige tu repositorio.
6. En tipo de compilación, selecciona **Dockerfile** (ruta: `/Dockerfile`).
7. En configuración del servicio:
   - **Nombre del servicio:** `collabpulse`
   - **Región:** `us-central1` (o la más cercana a tus usuarios).
   - **Autenticación:** Marcar **Permitir invocaciones no autenticadas** (para acceso web público).
   - En **Contenedor > Variables de entorno**, añade las variables descritas en la sección 5.
   - En **Tiempo de espera de la solicitud (timeout):** Configura `3600` segundos (permite mantener conexiones SSE realtime vivas).
8. Haz clic en **Crear**. Cada vez que hagas `git push` a tu rama principal, Cloud Run compilará y actualizará la aplicación automáticamente.

---

## 5. Variables de Entorno para Producción

En Cloud Run > Editar y desplegar nueva revisión > **Variables de entorno y secretos**:

| Variable | Valor de ejemplo | Descripción |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Activa el modo productivo y compresión. |
| `PORT` | `8080` | Puerto asignado por Cloud Run. |
| `DATABASE_URL` | `postgres://user:pass@host:5432/dbname?sslmode=require` | Conexión directa a PostgreSQL con SSL. |
| `POSTGRES_SSL` | `true` | Obliga la encriptación SSL con la base de datos. |
| `JWT_SECRET` | `genera_un_secreto_aleatorio_muy_largo_2026_prod` | Llave para firma de tokens JWT de sesión. |
| `JWT_ISSUER` | `CollabPulse` | Emisor de tokens. |
| `JWT_AUDIENCE` | `CollabPulseUsers` | Audiencia de tokens. |
| `ADMIN_EMAIL` | `admin@tuempresa.com` | Correo del Administrador Principal inicial. |
| `ADMIN_USERNAME` | `admin` | Usuario del Administrador Principal inicial. |
| `ADMIN_PASSWORD` | `TuContrasenaSegura2026!` | Contraseña del Administrador Principal inicial. |
| `GEMINI_API_KEY` | `AIzaSy...` | Llave de Google AI Studio para IA / Gemini. |

*(Nota: Si usas Cloud SQL nativo en lugar de `DATABASE_URL`, puedes especificar alternativamente: `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`).*

---

## 6. Integración con Google AI Studio (Gemini)

Para habilitar las funciones de inteligencia artificial dentro de CollabPulse:
1. Ve a [Google AI Studio](https://aistudio.google.com/).
2. Haz clic en **Get API key** y genera una nueva clave de API.
3. Agrégala en las variables de entorno de Cloud Run con el nombre:
   ```
   GEMINI_API_KEY=AIzaSyTuClaveDeGoogleAIStudio...
   ```
4. El backend usará automáticamente la SDK oficial `@google/genai` configurada en el proyecto.

---

## 7. Configuración de Dominio Personalizado y SSL

Google Cloud Run incluye certificados SSL de Let's Encrypt administrados y gratuitos.

Para conectar tu propio dominio (ej. `chat.miempresa.com`):
1. En Google Cloud Run, haz clic en **Administrar dominios personalizados**.
2. Haz clic en **Agregar asignación**.
3. Selecciona el servicio `collabpulse`.
4. Ingresa tu dominio o subdominio.
5. Google Cloud te dará los registros DNS (tipo `CNAME` o `A`/`AAAA`) para configurar en tu proveedor de dominio (Cloudflare, GoDaddy, Namecheap, etc.).
6. En pocos minutos, el certificado SSL se aprovisiona automáticamente.

---

## 8. Monitoreo y Verificación

Una vez desplegado:
- **Página Principal:** Accede a la URL provista por Cloud Run (`https://collabpulse-xyz.a.run.app`).
- **Verificación de Salud:**
  - `GET https://collabpulse-xyz.a.run.app/health` (Estado global del sistema).
  - `GET https://collabpulse-xyz.a.run.app/health/database` (Latencia y conexión a PostgreSQL).
  - `GET https://collabpulse-xyz.a.run.app/ready` (Verificación de disponibilidad para balanceador).
- **Inicio de Sesión:** Ingresa con las credenciales configuradas en `ADMIN_USERNAME` / `ADMIN_PASSWORD`.

¡Tu aplicación CollabPulse Enterprise está lista para operar en producción!
