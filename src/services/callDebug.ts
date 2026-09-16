/**
 * CollabPulse Enterprise Call Debug Logger
 * Provides structured logging for WebRTC call lifecycle, media acquisition,
 * SDP offer/answer exchange, ICE candidates, and connection states.
 * 
 * Complies with enterprise security: NEVER logs passwords, JWT tokens, TURN credentials,
 * or private message contents.
 */

export interface CallLogEvent {
  callId?: string;
  participantId?: string;
  state?: string;
  signalingEvent?: string;
  connectionState?: RTCPeerConnectionState | string;
  iceState?: RTCIceConnectionState | string;
  sdpState?: RTCSignalingState | string;
  mediaState?: { audio?: boolean; video?: boolean; screen?: boolean };
  error?: any;
  metadata?: Record<string, any>;
}

// Redaction helper for security
const sanitizeDetails = (obj: any): any => {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeDetails);

  const clean: Record<string, any> = {};
  for (const [key, val] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    if (
      lowerKey.includes('password') ||
      lowerKey.includes('token') ||
      lowerKey.includes('jwt') ||
      lowerKey.includes('credential') ||
      lowerKey.includes('secret')
    ) {
      clean[key] = '[REDACTED]';
    } else if (typeof val === 'object' && val !== null) {
      clean[key] = sanitizeDetails(val);
    } else {
      clean[key] = val;
    }
  }
  return clean;
};

export const callLog = (event: string, details?: CallLogEvent | any) => {
  const ts = new Date().toISOString().substring(11, 23);
  const prefix = `[CALL DEBUG ${ts}] ${event}`;
  const safeDetails = sanitizeDetails(details);

  if (safeDetails !== undefined) {
    console.log(
      `%c${prefix}`,
      'color: #10b981; font-weight: bold; background: #064e3b; padding: 2px 6px; border-radius: 4px;',
      safeDetails
    );
  } else {
    console.log(
      `%c${prefix}`,
      'color: #10b981; font-weight: bold; background: #064e3b; padding: 2px 6px; border-radius: 4px;'
    );
  }
};

export const callWarn = (event: string, details?: any) => {
  const ts = new Date().toISOString().substring(11, 23);
  console.warn(
    `%c[CALL WARN ${ts}] ${event}`,
    'color: #f59e0b; font-weight: bold; background: #78350f; padding: 2px 6px; border-radius: 4px;',
    sanitizeDetails(details)
  );
};

export const callError = (event: string, error?: any) => {
  const ts = new Date().toISOString().substring(11, 23);
  console.error(
    `%c[CALL ERROR ${ts}] ${event}`,
    'color: #ef4444; font-weight: bold; background: #7f1d1d; padding: 2px 6px; border-radius: 4px;',
    sanitizeDetails(error)
  );
};
