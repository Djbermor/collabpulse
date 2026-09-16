# Autenticación y Gestión de Sesiones

## 1. Esquema Criptográfico
- **Algoritmo de Hashing:** Argon2id con parámetros recomendados por OWASP (Memory: 64MB, Iterations: 3, Parallelism: 1).
- **Tokens de Acceso:** JSON Web Tokens (JWT) firmados con algoritmo HMAC-SHA256 (mínimo 256 bits). Expiración: 15 a 60 minutos.
- **Refresh Tokens:** Criptográficamente aleatorios (256 bits), almacenados en base de datos con rotación automática y revocación en cascada ante detección de reuso.

## 2. Protección Contra Ataques
- **Rate Limiting:** Máximo 5 intentos fallidos de autenticación por IP antes de bloqueo temporal de 15 minutos.
- **Detección de Reuso:** Si un refresh token ya utilizado se presenta, se invalida toda la familia de tokens del usuario forzando re-autenticación.
