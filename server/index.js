/**
 * CockpitOS Backend Server
 * - Express HTTP 서버 (Claude API 프록시, 정적 파일)
 * - WebSocket 서버 (실시간 비행 데이터)
 * - Mock 비행 데이터 생성기 (SimConnect 대체)
 */

require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const { WebSocketServer } = require('ws');
const { MockFlightProvider } = require('./mock-flight');
const { FlightJudge } = require('./flight-judge');
const { createApiProxy } = require('./api-proxy');
const { createAdsApi } = require('./ads-api');
const { PCLauncher } = require('./pc-launcher');
const { Watchdog } = require('./watchdog');
const { Notifier } = require('./notifications');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

// ── 미들웨어 ──
app.use(cors());
app.use(express.json({ limit: '5mb' }));

// ── 정적 파일 (프론트엔드) ──
app.use(express.static(path.join(__dirname, '..')));

// ── Claude API 프록시 ──
app.use('/api', createApiProxy());

// ── 광고 API ──
app.use('/api', createAdsApi());

// ── 서버 상태 확인 ──
app.get('/api/status', (req, res) => {
  res.json({
    status: 'ok',
    mode: 'mock',
    message: 'CockpitOS 서버 작동 중 (Mock 모드)'
  });
});

// ── WebSocket 서버 (실시간 비행 데이터) ──
const wss = new WebSocketServer({ server, path: '/ws' });
const flightProvider = new MockFlightProvider();
const flightJudge = new FlightJudge();

// ── PC 자동화 시스템 (Phase 2+ 실제 사용) ──
const pcLauncher = new PCLauncher({ mockMode: true });
const notifier = new Notifier({ mockMode: true });
const watchdog = new Watchdog();
watchdog.setDependencies({ flightProvider, pcLauncher, notifier });
watchdog.start();

// Watchdog 이벤트 → 호스트 대시보드 전송
watchdog.on('health-change', (health) => {
  wss.clients.forEach(c => {
    if (c.readyState === 1) {
      c.send(JSON.stringify({ type: 'watchdog-health', health }));
    }
  });
});
watchdog.on('host-alert', (alert) => {
  notifier.alert({ level: 'ERROR', ...alert });
});

// 부팅 시퀀스 이벤트 → 해당 클라이언트에 전송
function sendBootEvents(ws) {
  const onState = ({ state, step }) => {
    if (ws.readyState === 1) ws.send(JSON.stringify({ type: 'boot-state', state, step }));
  };
  const onProgress = (progress) => {
    if (ws.readyState === 1) ws.send(JSON.stringify({ type: 'boot-progress', progress }));
  };
  const onReady = () => {
    if (ws.readyState === 1) ws.send(JSON.stringify({ type: 'boot-ready' }));
  };
  const onError = (err) => {
    if (ws.readyState === 1) ws.send(JSON.stringify({ type: 'boot-error', error: { message: err.message } }));
  };
  pcLauncher.on('state-change', onState);
  pcLauncher.on('progress', onProgress);
  pcLauncher.on('msfs-ready', onReady);
  pcLauncher.on('error', onError);

  // 정리
  ws.on('close', () => {
    pcLauncher.off('state-change', onState);
    pcLauncher.off('progress', onProgress);
    pcLauncher.off('msfs-ready', onReady);
    pcLauncher.off('error', onError);
  });
}

wss.on('connection', (ws) => {
  console.log('[WS] 클라이언트 연결됨');

  // 연결 시 현재 상태 전송
  ws.send(JSON.stringify({
    type: 'connected',
    mode: 'mock',
    message: 'CockpitOS 서버에 연결되었습니다'
  }));

  // 비행 데이터 수신 리스너
  const onFlightData = (data) => {
    if (ws.readyState === 1) {
      // 비행 상태 판단
      const judgment = flightJudge.judge(data);

      ws.send(JSON.stringify({
        type: 'flight-data',
        data: data,
        judgment: judgment
      }));
    }
  };

  flightProvider.on('data', onFlightData);

  // 클라이언트 명령 수신
  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw);

      switch (msg.type) {
        case 'command':
          // SimConnect 명령 (Mock에서는 상태 변경)
          const result = flightProvider.sendCommand(msg.event, msg.value);
          ws.send(JSON.stringify({ type: 'command-result', ...result }));
          break;

        case 'start-flight':
          // 비행 시작 (시나리오 로드)
          flightProvider.startFlight(msg.scenario || 'default');
          ws.send(JSON.stringify({ type: 'flight-started', scenario: msg.scenario }));
          break;

        case 'stop-flight':
          // 비행 종료 + 리포트 생성
          const recording = flightProvider.stopFlight();
          const report = flightJudge.generateReport(recording || []);
          ws.send(JSON.stringify({ type: 'flight-stopped', report }));
          break;

        case 'get-report':
          // 리포트 요청 (현재 기록 기준)
          const currentRecording = flightProvider.getRecording();
          const currentReport = flightJudge.generateReport(currentRecording || []);
          ws.send(JSON.stringify({ type: 'flight-report', report: currentReport }));
          break;

        case 'demo-start':
          // 시범 모드 시작 (코코가 직접 조작)
          flightProvider.startDemo(msg.procedure || 'preflight');
          ws.send(JSON.stringify({ type: 'demo-started', procedure: msg.procedure }));
          break;

        case 'demo-stop':
          flightProvider.stopDemo();
          ws.send(JSON.stringify({ type: 'demo-stopped' }));
          break;

        case 'get-checklist':
          // 체크리스트 요청
          const checklist = flightProvider.getChecklist(msg.phase);
          ws.send(JSON.stringify({ type: 'checklist', phase: msg.phase, items: checklist }));
          break;

        case 'set-speed':
          // 속도 배율 변경 (Mock용 - 실제 SimConnect에서는 R키 자동 입력으로 구현)
          if (flightProvider.setSpeedMultiplier) {
            flightProvider.setSpeedMultiplier(msg.multiplier || 1);
          }
          ws.send(JSON.stringify({ type: 'speed-set', multiplier: msg.multiplier }));
          break;

        case 'rewind':
          // 되돌리기 (Mock용 - 실제 SimConnect에서는 위치 리셋 명령)
          if (flightProvider.rewindTo) {
            flightProvider.rewindTo(msg.type || 'runway');
          }
          ws.send(JSON.stringify({ type: 'rewound', to: msg.type }));
          break;

        case 'boot-start':
          // PC 부팅 시퀀스 시작
          sendBootEvents(ws);
          pcLauncher.bootSequence();
          break;

        case 'boot-abort':
          pcLauncher.abort();
          break;

        case 'host-call':
          // 게스트가 호스트 호출
          notifier.alert({
            level: 'WARNING',
            message: `게스트가 도움 요청: ${msg.reason || '알 수 없음'}`,
            room: msg.room || 'unknown'
          });
          ws.send(JSON.stringify({ type: 'host-called' }));
          break;

        case 'watchdog-status':
          // Watchdog 상태 조회
          ws.send(JSON.stringify({ type: 'watchdog-status', status: watchdog.getHealth() }));
          break;
      }
    } catch (e) {
      console.error('[WS] 메시지 파싱 에러:', e.message);
    }
  });

  ws.on('close', () => {
    flightProvider.off('data', onFlightData);
    console.log('[WS] 클라이언트 연결 해제');
  });
});

// ── 서버 시작 ──
server.listen(PORT, () => {
  console.log('');
  console.log('╔══════════════════════════════════════════╗');
  console.log('║       CockpitOS Server Started!          ║');
  console.log('║                                          ║');
  console.log(`║  🌐 앱 주소: http://localhost:${PORT}        ║`);
  console.log(`║  🔌 WebSocket: ws://localhost:${PORT}/ws     ║`);
  console.log('║  ✈️  모드: Mock (SimConnect 없이 개발)     ║');
  console.log('║                                          ║');
  console.log('║  브라우저에서 위 주소를 열어보세요!       ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log('');
});
