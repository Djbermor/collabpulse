const BASE_URL = 'http://localhost:3000';

interface RealtimeMessage {
  event: string;
  payload: any;
}

class SSEClient {
  private url: string;
  private token: string;
  private abortController: AbortController;
  public messages: RealtimeMessage[] = [];
  private listeners: Array<(msg: RealtimeMessage) => void> = [];

  constructor(url: string, token: string) {
    this.url = url;
    this.token = token;
    this.abortController = new AbortController();
  }

  async connect(): Promise<void> {
    const res = await fetch(this.url, {
      headers: { 'Authorization': `Bearer ${this.token}` },
      signal: this.abortController.signal
    });

    if (!res.ok || !res.body) {
      throw new Error(`SSE connect failed with status ${res.status}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    (async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('data:')) {
              const jsonStr = trimmed.substring(5).trim();
              try {
                const parsed = JSON.parse(jsonStr);
                if (parsed && parsed.event) {
                  this.messages.push(parsed);
                  this.listeners.forEach(fn => fn(parsed));
                }
              } catch (e) {
                // Ignore non-json comments
              }
            }
          }
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error('[SSEClient] stream error:', err);
        }
      }
    })();
  }

  waitForEvent(eventName: string, timeoutMs: number = 5000): Promise<RealtimeMessage> {
    const idx = this.messages.findIndex(m => m.event === eventName);
    if (idx !== -1) {
      const found = this.messages[idx];
      this.messages.splice(idx, 1);
      return Promise.resolve(found);
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.listeners = this.listeners.filter(fn => fn !== listener);
        reject(new Error(`Timeout (${timeoutMs}ms) waiting for event '${eventName}'`));
      }, timeoutMs);

      const listener = (msg: RealtimeMessage) => {
        if (msg.event === eventName) {
          clearTimeout(timer);
          this.listeners = this.listeners.filter(fn => fn !== listener);
          const foundIdx = this.messages.indexOf(msg);
          if (foundIdx !== -1) this.messages.splice(foundIdx, 1);
          resolve(msg);
        }
      };

      this.listeners.push(listener);
    });
  }

  waitForSignal(signalType: string, timeoutMs: number = 5000): Promise<RealtimeMessage> {
    const idx = this.messages.findIndex(m => m.event === 'WebRTCSignal' && m.payload?.signalType === signalType);
    if (idx !== -1) {
      const found = this.messages[idx];
      this.messages.splice(idx, 1);
      return Promise.resolve(found);
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.listeners = this.listeners.filter(fn => fn !== listener);
        reject(new Error(`Timeout (${timeoutMs}ms) waiting for signalType '${signalType}'`));
      }, timeoutMs);

      const listener = (msg: RealtimeMessage) => {
        if (msg.event === 'WebRTCSignal' && msg.payload?.signalType === signalType) {
          clearTimeout(timer);
          this.listeners = this.listeners.filter(fn => fn !== listener);
          const foundIdx = this.messages.indexOf(msg);
          if (foundIdx !== -1) this.messages.splice(foundIdx, 1);
          resolve(msg);
        }
      };

      this.listeners.push(listener);
    });
  }

  close() {
    this.abortController.abort();
  }
}

async function runWebRTCTestSuite() {
  console.log('=== STARTING WEBRTC REAL CALL TEST SUITE ===\n');

  let passed = 0;
  let total = 0;

  function assert(cond: boolean, msg: string) {
    total++;
    if (cond) {
      console.log(`✓ PASS: ${msg}`);
      passed++;
    } else {
      console.error(`✗ FAIL: ${msg}`);
      throw new Error(`Assertion failed: ${msg}`);
    }
  }

  async function login(email: string, password = 'CollabPulse2026!Admin') {
    const res = await fetch(`${BASE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    return await res.json();
  }

  // 1. Authenticate User A (Admin / Caller) and User B (Maria / Callee)
  console.log('--- 1. Authenticate Dual Users ---');
  const loginA = await login('admin@collabpulse.local');
  assert(loginA.success && !!loginA.data?.token, 'User A (Caller: Admin) authenticated');
  const userA = loginA.data.user;
  const tokenA = loginA.data.token;

  const loginB = await login('maria.santos@collabpulse.local');
  assert(loginB.success && !!loginB.data?.token, 'User B (Callee: Maria Santos) authenticated');
  const userB = loginB.data.user;
  const tokenB = loginB.data.token;

  const authA = { 'Authorization': `Bearer ${tokenA}`, 'Content-Type': 'application/json' };
  const authB = { 'Authorization': `Bearer ${tokenB}`, 'Content-Type': 'application/json' };

  // 2. Establish Realtime SSE Streams for both users
  console.log('\n--- 2. Establish SignalR / SSE Realtime Connections ---');
  const sseA = new SSEClient(`${BASE_URL}/api/v1/realtime/stream?tenantId=${userA.tenantId}&userId=${userA.id}`, tokenA);
  const sseB = new SSEClient(`${BASE_URL}/api/v1/realtime/stream?tenantId=${userB.tenantId}&userId=${userB.id}`, tokenB);

  await sseA.connect();
  await sseB.connect();

  const connA = await sseA.waitForEvent('Connected');
  assert(!!connA, 'User A received Connected SSE handshake');

  const connB = await sseB.waitForEvent('Connected');
  assert(!!connB, 'User B received Connected SSE handshake');

  // 3. User A initiates Call (Invite)
  console.log('\n--- 3. Call Invitation (User A calls User B) ---');
  const roomId = `room-webrtc-${Date.now()}`;
  const inviteRes = await fetch(`${BASE_URL}/api/v1/realtime/signal/call/invite`, {
    method: 'POST',
    headers: authA,
    body: JSON.stringify({
      targetUserId: userB.id,
      roomId,
      isVideo: true,
      title: 'Llamada con Maria Santos'
    })
  });
  const inviteData: any = await inviteRes.json();
  assert(inviteData.success, 'Call invite successfully sent from User A to User B');

  // User B must receive IncomingCall event immediately
  const incomingCallEvt = await sseB.waitForEvent('IncomingCall', 3000);
  assert(
    incomingCallEvt.payload.roomId === roomId &&
    incomingCallEvt.payload.caller.id === userA.id &&
    incomingCallEvt.payload.isVideo === true,
    'User B received IncomingCall event with correct roomId, callerId, and isVideo: true'
  );
  const callId = incomingCallEvt.payload.callId;

  // 4. User B Accepts Call
  console.log('\n--- 4. Call Acceptance (User B answers) ---');
  const acceptRes = await fetch(`${BASE_URL}/api/v1/realtime/signal/call/response`, {
    method: 'POST',
    headers: authB,
    body: JSON.stringify({
      callerId: userA.id,
      callId,
      roomId,
      accepted: true
    })
  });
  const acceptData: any = await acceptRes.json();
  assert(acceptData.success, 'User B posted acceptance response');

  // User A receives CallResponse accepted: true
  const callResponseEvt = await sseA.waitForEvent('CallResponse', 3000);
  assert(
    callResponseEvt.payload.accepted === true &&
    callResponseEvt.payload.roomId === roomId &&
    callResponseEvt.payload.callee.id === userB.id,
    'User A received CallResponse event: accepted = true'
  );

  // Join meeting room for both users
  await fetch(`${BASE_URL}/api/v1/realtime/groups/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ group: `meeting:${roomId}`, userId: userA.id })
  });
  await fetch(`${BASE_URL}/api/v1/realtime/groups/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ group: `meeting:${roomId}`, userId: userB.id })
  });

  // 5. SDP Offer / Answer Exchange
  console.log('\n--- 5. Deterministic SDP Offer / Answer Negotiation ---');
  // Caller (User A) creates and sends Offer
  const dummyOffer = {
    type: 'offer',
    sdp: 'v=0\r\no=- 4611731400430051336 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\nm=video 9 UDP/TLS/RTP/SAVPF 96\r\n'
  };

  const sendOfferRes = await fetch(`${BASE_URL}/api/v1/realtime/signal`, {
    method: 'POST',
    headers: authA,
    body: JSON.stringify({
      targetUserId: userB.id,
      roomId,
      signalType: 'webrtc-offer',
      data: dummyOffer
    })
  });
  const sendOfferData: any = await sendOfferRes.json();
  assert(sendOfferData.success, 'User A dispatched webrtc-offer signal to User B');

  // User B receives webrtc-offer
  const offerEvt = await sseB.waitForSignal('webrtc-offer', 3000);
  assert(
    offerEvt.payload.signalType === 'webrtc-offer' &&
    offerEvt.payload.senderId === userA.id &&
    offerEvt.payload.data?.type === 'offer',
    'User B received webrtc-offer signal with SDP content'
  );

  // Callee (User B) creates and sends Answer
  const dummyAnswer = {
    type: 'answer',
    sdp: 'v=0\r\no=- 7819238912389128391 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\nm=video 9 UDP/TLS/RTP/SAVPF 96\r\n'
  };

  const sendAnswerRes = await fetch(`${BASE_URL}/api/v1/realtime/signal`, {
    method: 'POST',
    headers: authB,
    body: JSON.stringify({
      targetUserId: userA.id,
      roomId,
      signalType: 'webrtc-answer',
      data: dummyAnswer
    })
  });
  const sendAnswerData: any = await sendAnswerRes.json();
  assert(sendAnswerData.success, 'User B dispatched webrtc-answer signal to User A');

  // User A receives webrtc-answer
  const answerEvt = await sseA.waitForSignal('webrtc-answer', 3000);
  assert(
    answerEvt.payload.signalType === 'webrtc-answer' &&
    answerEvt.payload.senderId === userB.id &&
    answerEvt.payload.data?.type === 'answer',
    'User A received webrtc-answer signal with SDP content'
  );

  // 6. ICE Candidate Exchange
  console.log('\n--- 6. ICE Candidate Exchange ---');
  const candidateA = {
    candidate: 'candidate:1 1 UDP 2122260223 192.168.1.10 54321 typ host',
    sdpMid: '0',
    sdpMLineIndex: 0,
    usernameFragment: 'userAfrag'
  };

  await fetch(`${BASE_URL}/api/v1/realtime/signal`, {
    method: 'POST',
    headers: authA,
    body: JSON.stringify({
      targetUserId: userB.id,
      roomId,
      signalType: 'webrtc-ice',
      data: candidateA
    })
  });

  const iceEvtB = await sseB.waitForSignal('webrtc-ice', 3000);
  assert(
    iceEvtB.payload.signalType === 'webrtc-ice' &&
    iceEvtB.payload.data.candidate.includes('192.168.1.10'),
    'User B received User A ICE candidate'
  );

  const candidateB = {
    candidate: 'candidate:2 1 UDP 2122260223 192.168.1.20 54322 typ host',
    sdpMid: '0',
    sdpMLineIndex: 0,
    usernameFragment: 'userBfrag'
  };

  await fetch(`${BASE_URL}/api/v1/realtime/signal`, {
    method: 'POST',
    headers: authB,
    body: JSON.stringify({
      targetUserId: userA.id,
      roomId,
      signalType: 'webrtc-ice',
      data: candidateB
    })
  });

  const iceEvtA = await sseA.waitForSignal('webrtc-ice', 3000);
  assert(
    iceEvtA.payload.signalType === 'webrtc-ice' &&
    iceEvtA.payload.data.candidate.includes('192.168.1.20'),
    'User A received User B ICE candidate'
  );

  // 7. Media State Synchronization (Mute / Camera Toggle)
  console.log('\n--- 7. Media State Synchronization (Mute & Camera Toggle) ---');
  // User A mutes mic
  await fetch(`${BASE_URL}/api/v1/realtime/signal`, {
    method: 'POST',
    headers: authA,
    body: JSON.stringify({
      targetUserId: userB.id,
      roomId,
      signalType: 'media-state',
      data: { isAudioMuted: true }
    })
  });

  const mediaEvt1 = await sseB.waitForSignal('media-state', 3000);
  assert(
    mediaEvt1.payload.signalType === 'media-state' &&
    mediaEvt1.payload.data?.isAudioMuted === true,
    'User B received User A muted audio signal'
  );

  // User A turns off camera
  await fetch(`${BASE_URL}/api/v1/realtime/signal`, {
    method: 'POST',
    headers: authA,
    body: JSON.stringify({
      targetUserId: userB.id,
      roomId,
      signalType: 'media-state',
      data: { isVideoOff: true }
    })
  });

  const mediaEvt2 = await sseB.waitForSignal('media-state', 3000);
  assert(
    mediaEvt2.payload.signalType === 'media-state' &&
    mediaEvt2.payload.data?.isVideoOff === true,
    'User B received User A camera off signal'
  );

  // 8. Clean Call Hangup & Teardown
  console.log('\n--- 8. Call Teardown and Hangup ---');
  const endRes = await fetch(`${BASE_URL}/api/v1/realtime/signal/call/end`, {
    method: 'POST',
    headers: authA,
    body: JSON.stringify({
      roomId,
      targetUserId: userB.id
    })
  });
  const endData: any = await endRes.json();
  assert(endData.success, 'User A called endCall endpoint');

  // Both users receive CallEnded
  const endEvtB = await sseB.waitForEvent('CallEnded', 3000);
  assert(endEvtB.payload.roomId === roomId, 'User B received CallEnded event');

  sseA.close();
  sseB.close();

  console.log(`\n=== WEBRTC TEST SUITE COMPLETED: ${passed}/${total} TESTS PASSED ===\n`);
}

runWebRTCTestSuite().catch((err) => {
  console.error('WebRTC Test Suite Failed:', err);
  process.exit(1);
});
