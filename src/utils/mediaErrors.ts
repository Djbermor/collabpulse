/**
 * User-friendly Media & WebRTC Hardware Error Mapper
 * Translates browser DOMExceptions into clear, actionable messages in Spanish.
 */

export interface FormattedMediaError {
  type: 'permission' | 'not_found' | 'busy' | 'constraint' | 'security' | 'unknown';
  title: string;
  message: string;
}

export function formatMediaError(error: any): FormattedMediaError {
  const errorName = error?.name || error?.constructor?.name || '';
  const errorMessage = error?.message || String(error);

  switch (errorName) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
      return {
        type: 'permission',
        title: 'Permiso Denegado',
        message: 'No se permitió el acceso al micrófono o la cámara. Por favor, habilita los permisos en la barra de direcciones del navegador.'
      };

    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return {
        type: 'not_found',
        title: 'Dispositivo No Encontrado',
        message: 'No se encontró ninguna cámara o micrófono conectado a tu equipo.'
      };

    case 'NotReadableError':
    case 'TrackStartError':
      return {
        type: 'busy',
        title: 'Dispositivo Ocupado',
        message: 'El micrófono o la cámara están siendo utilizados por otra aplicación (ej. Zoom, Teams u otra pestaña).'
      };

    case 'OverconstrainedError':
    case 'ConstraintNotSatisfiedError':
      return {
        type: 'constraint',
        title: 'Configuración No Soportada',
        message: 'El dispositivo no soporta la resolución o frecuencia solicitada.'
      };

    case 'SecurityError':
      return {
        type: 'security',
        title: 'Bloqueo de Seguridad',
        message: 'El acceso a dispositivos multimedia está restringido por las políticas de seguridad del navegador.'
      };

    case 'AbortError':
      return {
        type: 'unknown',
        title: 'Operación Cancelada',
        message: 'La solicitud de captura de medios fue cancelada o interrumpida.'
      };

    default:
      return {
        type: 'unknown',
        title: 'Error Multimedia',
        message: errorMessage || 'Ocurrió un error inesperado al acceder a los dispositivos de audio/video.'
      };
  }
}
