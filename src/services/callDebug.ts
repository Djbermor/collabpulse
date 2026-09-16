/**
 * CollabPulse Call Debug Logger
 * Provides structured logging for WebRTC call lifecycle, media acquisition,
 * SDP offer/answer exchange, ICE candidates, and connection states.
 */

export const callLog = (event: string, details?: any) => {
  const ts = new Date().toISOString().substring(11, 23);
  const prefix = `[CALL DEBUG ${ts}] ${event}`;
  
  if (details !== undefined) {
    console.log(
      `%c${prefix}`,
      'color: #10b981; font-weight: bold; background: #064e3b; padding: 2px 6px; border-radius: 4px;',
      details
    );
  } else {
    console.log(
      `%c${prefix}`,
      'color: #10b981; font-weight: bold; background: #064e3b; padding: 2px 6px; border-radius: 4px;'
    );
  }
};
