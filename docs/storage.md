# Almacenamiento de Archivos y Objetos

## 1. Proveedores de Almacenamiento
- **Desarrollo / Local:** Sistema de archivos local (`storage_blobs/`).
- **Producción:** Azure Blob Storage o Amazon S3 / MinIO compatible.

## 2. Política de Subida Segura
- Validación estricta de encabezados Magic Bytes y MIME Types en el servidor antes de confirmar.
- Cuota máxima por archivo: 100 MB.
- Generación de nombres de archivo aleatorios UUID v4 para evitar sobreescrituras accidentales o inyecciones de ruta (`directory traversal`).
- Acceso a archivos mediante URLs firmadas temporales (Signed URLs / SAS tokens) con expiración de 1 hora.
