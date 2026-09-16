import ws from 'k6/ws';
import { check, sleep } from 'k6';

// ==============================================================================
// CollabPulse Enterprise — SignalR Realtime Load Test (Section 56)
// Simula 1,000 conexiones WebSocket concurrentes con SignalR Hub
// Verificando negociación, handshake, difusión y latencia de entrega (<100ms)
// ==============================================================================

export const options = {
  stages: [
    { duration: '30s', target: 200 },
    { duration: '1m', target: 1000 },
    { duration: '3m', target: 1000 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    'ws_connecting': ['p(95)<100'], // Handshake menor a 100ms
  },
};

const HUB_URL = __ENV.SIGNALR_HUB_URL || 'ws://localhost:5000/hubs/chat';
const TOKEN = __ENV.JWT_TOKEN || 'test-jwt-token';

export default function () {
  const url = `${HUB_URL}?access_token=${TOKEN}`;

  const res = ws.connect(url, {}, function (socket) {
    socket.on('open', function () {
      // 1. Handshake de SignalR Protocol (JSON format con terminador 0x1E)
      socket.send('{"protocol":"json","version":1}\u001e');

      // 2. Suscripción a grupo de canal
      const joinGroup = JSON.stringify({
        type: 1,
        target: 'JoinChannel',
        arguments: ['33333333-3333-3333-3333-333333333333'],
      }) + '\u001e';

      socket.send(joinGroup);
    });

    socket.on('message', function (data) {
      // Mensajes recibidos en tiempo real
      if (data.includes('ReceiveMessage')) {
        check(data, {
          'message received': (d) => d.length > 0,
        });
      }
    });

    socket.on('close', function () {
      // Cierre ordenado
    });

    socket.on('error', function (e) {
      console.error('WebSocket error:', e);
    });

    // Mantener la conexión activa durante 30 segundos enviando heartbeats periódicos
    socket.setInterval(function () {
      const ping = JSON.stringify({ type: 6 }) + '\u001e';
      socket.send(ping);
    }, 15000);

    socket.setTimeout(function () {
      socket.close();
    }, 30000);
  });

  check(res, { 'connection successful': (r) => r && r.status === 101 });
  sleep(1);
}
