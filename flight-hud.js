/**
 * CockpitOS Flight HUD
 * 비행 데이터를 실시간으로 화면에 표시합니다.
 * WebSocket으로 서버와 통신합니다.
 */

const FlightHUD = {
  ws: null,
  connected: false,
  flightActive: false,
  lastData: null,

  // 다국어 헬퍼
  _t(key) {
    const lang = (typeof App !== 'undefined') ? App.lang : 'ko';
    return (T && T[lang] && T[lang][key]) ? T[lang][key] : (T && T.ko && T.ko[key]) || key;
  },
  hudElement: null,

  // ── WebSocket 연결 ──
  connect() {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${location.host}/ws`;

    try {
      this.ws = new WebSocket(wsUrl);
    } catch (e) {
      console.log('[HUD] WebSocket 연결 불가 (서버 미실행)');
      return;
    }

    this.ws.onopen = () => {
      this.connected = true;
      console.log('[HUD] 서버 연결됨');
      this._updateConnectionStatus(true);
    };

    this.ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        this._handleMessage(msg);
      } catch (err) {
        console.error('[HUD] 메시지 파싱 에러:', err);
      }
    };

    this.ws.onclose = () => {
      this.connected = false;
      console.log('[HUD] 서버 연결 해제');
      this._updateConnectionStatus(false);
      // 3초 후 재연결 시도
      setTimeout(() => this.connect(), 3000);
    };

    this.ws.onerror = () => {
      console.log('[HUD] WebSocket 에러 (서버가 꺼져 있을 수 있음)');
    };
  },

  // ── 서버로 명령 전송 ──
  send(type, data = {}) {
    if (this.ws && this.ws.readyState === 1) {
      this.ws.send(JSON.stringify({ type, ...data }));
    }
  },

  // ── 비행 시작 ──
  startFlight(scenario = 'default') {
    this.flightActive = true;
    this.send('start-flight', { scenario });
    this._showHUD();
  },

  // ── 비행 종료 ──
  stopFlight() {
    this.flightActive = false;
    this.send('stop-flight');
    this._hideHUD();
  },

  // ── 시범 모드 시작 ──
  startDemo(procedure = 'preflight') {
    this.send('demo-start', { procedure });
  },

  // ── 시범 모드 중지 ──
  stopDemo() {
    this.send('demo-stop');
  },

  // ── SimConnect 명령 ──
  sendCommand(eventName, value) {
    this.send('command', { event: eventName, value });
  },

  // ── 체크리스트 요청 ──
  requestChecklist(phase) {
    this.send('get-checklist', { phase });
  },

  // ── 메시지 처리 ──
  _handleMessage(msg) {
    switch (msg.type) {
      case 'connected':
        console.log('[HUD]', msg.message);
        break;

      case 'flight-data':
        this.lastData = msg.data;
        if (this.flightActive) {
          this._updateHUD(msg.data, msg.judgment);
        }
        break;

      case 'command-result':
        console.log('[HUD] 명령 결과:', msg.event, msg.success);
        break;

      case 'checklist':
        this._updateChecklist(msg.phase, msg.items);
        break;

      case 'flight-started':
        console.log('[HUD] 비행 시작:', msg.scenario);
        break;

      case 'flight-stopped':
        console.log('[HUD] 비행 종료');
        if (msg.report) this._showReport(msg.report);
        break;

      case 'flight-report':
        if (msg.report) this._showReport(msg.report);
        break;

      case 'demo-started':
        console.log('[HUD] 시범 시작:', msg.procedure);
        break;
    }
  },

  // ── HUD 생성 ──
  _createHUD() {
    if (document.getElementById('flight-hud')) return;

    const hud = document.createElement('div');
    hud.id = 'flight-hud';
    hud.innerHTML = `
      <!-- 배경 (비행 영상 또는 검은색) -->
      <div id="hud-bg-layer" style="position:absolute;inset:0;background:#050a14;z-index:-2;pointer-events:none"></div>
      <video id="hud-bg-video" autoplay loop muted playsinline
        style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0.9;z-index:-1;pointer-events:none">
        <source src="video/dashbord.mp4" type="video/mp4">
      </video>
      <div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(5,10,24,0.2) 0%,rgba(5,10,24,0) 30%,rgba(5,10,24,0.3) 100%);z-index:-1;pointer-events:none"></div>

      <!-- 비행 데이터 패널 (좌상단) -->
      <div id="hud-data-panel">
        <div class="hud-row">
          <span class="hud-label">ALT</span>
          <span class="hud-value" id="hud-alt">0</span>
          <span class="hud-unit">ft</span>
        </div>
        <div class="hud-row">
          <span class="hud-label">SPD</span>
          <span class="hud-value" id="hud-spd">0</span>
          <span class="hud-unit">kt</span>
        </div>
        <div class="hud-row">
          <span class="hud-label">HDG</span>
          <span class="hud-value" id="hud-hdg">000</span>
          <span class="hud-unit">°</span>
        </div>
        <div class="hud-row">
          <span class="hud-label">VS</span>
          <span class="hud-value" id="hud-vs">0</span>
          <span class="hud-unit">fpm</span>
        </div>
        <div class="hud-row">
          <span class="hud-label">FUEL</span>
          <span class="hud-value" id="hud-fuel">100</span>
          <span class="hud-unit">%</span>
        </div>
      </div>

      <!-- 비행 단계 표시 (상단 중앙) -->
      <div id="hud-phase-bar">
        <span id="hud-phase-icon">✈</span>
        <span id="hud-phase-text">대기 중</span>
        <span id="hud-flight-time">00:00</span>
      </div>

      <!-- 연결 상태 (우상단) -->
      <div id="hud-connection">
        <span id="hud-conn-dot">●</span>
        <span id="hud-conn-text">연결 중...</span>
      </div>

      <!-- 코칭 카드 (하단) -->
      <div id="hud-coaching" style="display:none">
        <div id="hud-coaching-header">
          <span id="hud-coaching-title">🐣 코코</span>
          <button onclick="FlightHUD._toggleCoaching()" style="background:none;border:none;color:#fff;font-size:16px;cursor:pointer">▼</button>
        </div>
        <div id="hud-coaching-body">
          <div id="hud-coaching-message"></div>
        </div>
      </div>

      <!-- 경고 오버레이 -->
      <div id="hud-warning-overlay" style="display:none"></div>

      <!-- 관광지 카드 -->
      <div id="hud-poi-card" style="display:none">
        <div id="hud-poi-name"></div>
        <div id="hud-poi-desc"></div>
      </div>

      <!-- 비행 컨트롤 버튼 -->
      <div id="hud-controls">
        <button class="hud-ctrl-btn" onclick="FlightHUD.startDemo('preflight')">👀 ${this._t('hudDemo')}</button>
        <button class="hud-ctrl-btn" onclick="FlightHUD.requestChecklist('preflight')">📋 ${this._t('hudCheck')}</button>
        <button class="hud-ctrl-btn" onclick="FlightHUD._toggleThrottle()">🔥 ${this._t('hudThrottle')}</button>
      </div>

      <!-- 스로틀 슬라이더 (숨김) -->
      <div id="hud-throttle-panel" style="display:none">
        <div style="font-size:12px;color:#FFD060;margin-bottom:6px">${this._t('hudThrottle')}</div>
        <input type="range" id="hud-throttle-slider" min="0" max="100" value="0"
          oninput="FlightHUD.sendCommand('THROTTLE_SET', Number(this.value))"
          style="width:100%;accent-color:#FFD060">
        <div style="display:flex;justify-content:space-between;font-size:11px;color:rgba(255,255,255,0.5)">
          <span>IDLE</span><span id="hud-throttle-val">0%</span><span>FULL</span>
        </div>
      </div>
    `;

    document.body.appendChild(hud);
    this.hudElement = hud;
  },

  // ── HUD 보이기/숨기기 ──
  _showHUD() {
    this._createHUD();
    const hud = document.getElementById('flight-hud');
    if (hud) hud.style.display = 'block';
  },

  _hideHUD() {
    const hud = document.getElementById('flight-hud');
    if (hud) hud.style.display = 'none';
  },

  // ── HUD 데이터 업데이트 ──
  _updateHUD(data, judgment) {
    // 숫자 업데이트
    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    setVal('hud-alt', Math.round(data.altitude).toLocaleString());
    setVal('hud-spd', Math.round(data.airspeed));
    setVal('hud-hdg', String(Math.round(data.heading)).padStart(3, '0'));
    setVal('hud-vs', (data.verticalSpeed >= 0 ? '+' : '') + Math.round(data.verticalSpeed));
    setVal('hud-fuel', Math.round(data.fuel));

    // 비행 시간
    const mins = Math.floor(data.flightTime / 60);
    const secs = Math.floor(data.flightTime % 60);
    setVal('hud-flight-time', `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`);

    // 스로틀 슬라이더 동기화
    const slider = document.getElementById('hud-throttle-slider');
    if (slider && !slider.matches(':active')) slider.value = data.throttle;
    setVal('hud-throttle-val', Math.round(data.throttle) + '%');

    // 색상 코딩
    this._colorCode('hud-alt', data.altitudeAGL, [
      [200, '#ef4444'], [500, '#FFD060'], [Infinity, '#4ade80']
    ]);
    this._colorCode('hud-spd', data.airspeed, [
      [45, '#ef4444'], [60, '#FFD060'], [160, '#4ade80'], [Infinity, '#ef4444']
    ]);
    this._colorCode('hud-vs', data.verticalSpeed, [
      [-2000, '#ef4444'], [-1000, '#FFD060'], [1500, '#4ade80'], [Infinity, '#FFD060']
    ], true);
    this._colorCode('hud-fuel', data.fuel, [
      [10, '#ef4444'], [20, '#FFD060'], [Infinity, '#4ade80']
    ]);

    // 비행 단계 (다국어)
    const _ht = (key) => {
      const lang = (typeof App !== 'undefined') ? App.lang : 'ko';
      return (T && T[lang] && T[lang][key]) ? T[lang][key] : (T && T.ko && T.ko[key]) || key;
    };
    const phases = {
      parked: { icon: '🅿️', text: _ht('hudParked') },
      ready: { icon: '🔑', text: _ht('hudReady') },
      taxi: { icon: '🚕', text: _ht('hudTaxi') },
      takeoff: { icon: '🛫', text: _ht('hudTakeoff') },
      climb: { icon: '📈', text: _ht('hudClimb') },
      cruise: { icon: '✈️', text: _ht('hudCruise') },
      descent: { icon: '📉', text: _ht('hudDescent') },
      approach: { icon: '🛬', text: _ht('hudApproach') },
      landing: { icon: '🎯', text: _ht('hudLanding') },
      landed: { icon: '✅', text: _ht('hudLanded') }
    };
    const phase = phases[data.phase] || phases.parked;
    setVal('hud-phase-icon', phase.icon);
    setVal('hud-phase-text', phase.text);

    // 단계별 코칭 카드 (단계가 바뀔 때만 업데이트)
    if (data.phase !== this._lastPhase) {
      this._lastPhase = data.phase;
      this._showPhaseCoaching(data.phase);
    }

    // 경고 처리
    if (judgment && judgment.messages.length > 0) {
      this._showWarnings(judgment);
    } else {
      this._hideWarnings();
    }

    // 시범 모드 표시
    if (data.demoAction) {
      this._showDemoStep(data);
    }

    // 관광지 카드
    if (data.nearbyPOI) {
      this._showPOI(data.nearbyPOI);
    } else {
      this._hidePOI();
    }
  },

  // ── 색상 코딩 ──
  _colorCode(id, value, ranges, useAbs = false) {
    const el = document.getElementById(id);
    if (!el) return;
    const v = useAbs ? value : value;
    for (const [threshold, color] of ranges) {
      if (v < threshold) {
        el.style.color = color;
        return;
      }
    }
  },

  // ── 경고 표시 ──
  _showWarnings(judgment) {
    const overlay = document.getElementById('hud-warning-overlay');
    if (!overlay) return;

    const dangerMsgs = judgment.messages.filter(m => m.level === 'danger');
    const cautionMsgs = judgment.messages.filter(m => m.level === 'caution');
    const infoMsgs = judgment.messages.filter(m => m.level === 'info' || m.level === 'normal');

    if (dangerMsgs.length > 0) {
      overlay.style.display = 'flex';
      overlay.className = 'hud-danger';
      overlay.innerHTML = dangerMsgs.map(m =>
        `<div class="hud-warning-msg">🚨 ${m.message}</div>`
      ).join('');
    } else if (cautionMsgs.length > 0) {
      overlay.style.display = 'flex';
      overlay.className = 'hud-caution';
      overlay.innerHTML = cautionMsgs.map(m =>
        `<div class="hud-warning-msg">⚠️ ${m.message}</div>`
      ).join('');
    } else {
      overlay.style.display = 'none';
    }

    // 코칭 메시지 (정보/격려)
    if (infoMsgs.length > 0) {
      const coaching = document.getElementById('hud-coaching');
      const msgEl = document.getElementById('hud-coaching-message');
      if (coaching && msgEl) {
        coaching.style.display = 'block';
        msgEl.textContent = infoMsgs[0].message;
      }
    }
  },

  _hideWarnings() {
    const overlay = document.getElementById('hud-warning-overlay');
    if (overlay) overlay.style.display = 'none';
  },

  // ── 시범 모드 표시 ──
  _showDemoStep(data) {
    const coaching = document.getElementById('hud-coaching');
    const msgEl = document.getElementById('hud-coaching-message');
    const titleEl = document.getElementById('hud-coaching-title');
    if (!coaching || !msgEl) return;

    coaching.style.display = 'block';
    titleEl.textContent = `👀 시범 모드 (${data.demoStep}/${data.demoTotal})`;

    let keyHint = data.demoKey ? `\n키보드: ${data.demoKey}` : '';
    msgEl.innerHTML = `<div style="color:#FFD060;font-weight:700;margin-bottom:4px">${data.demoAction}</div>` +
      `<div style="color:rgba(255,255,255,0.7);font-size:12px">코코가 시범을 보여주고 있어요. 잘 지켜보세요!${keyHint}</div>`;

    if (data.demoComplete) {
      titleEl.textContent = '👀 시범 완료!';
      msgEl.innerHTML = `<div style="color:#4ade80;font-weight:700">시범이 끝났어요!</div>` +
        `<div style="color:rgba(255,255,255,0.7);font-size:12px;margin-top:4px">이제 직접 해보시겠어요?</div>`;
    }
  },

  // ── 비행 단계별 코칭 카드 ──
  _lastPhase: null,
  _showPhaseCoaching(phase) {
    const coaching = document.getElementById('hud-coaching');
    const msgEl = document.getElementById('hud-coaching-message');
    const titleEl = document.getElementById('hud-coaching-title');
    if (!coaching || !msgEl) return;

    const key = 'coach' + phase.charAt(0).toUpperCase() + phase.slice(1);
    const msg = this._t(key);
    if (!msg || msg === key) return; // 번역 키 없으면 표시 안 함

    coaching.style.display = 'block';
    if (titleEl) titleEl.textContent = '🐣 ' + this._t('cocoName');
    msgEl.innerHTML = `<div style="line-height:1.5">${msg}</div>`;

    // 음성 안내 (ttsOn 일 때)
    if (typeof App !== 'undefined' && App.ttsOn) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(msg.replace(/[🅿️🔑🚕🛫📈✈️📉🛬🎯✅]/g, ''));
      u.lang = {ko:'ko-KR',en:'en-US',ja:'ja-JP',zh:'zh-CN'}[App.lang] || 'ko-KR';
      u.rate = 0.92; u.pitch = 1.05;
      window.speechSynthesis.speak(u);
    }
  },

  // ── 비행 리포트 화면 ──
  _showReport(report) {
    // 기존 리포트 제거
    const old = document.getElementById('flight-report');
    if (old) old.remove();

    const stars = (n) => '⭐'.repeat(n) + '☆'.repeat(5 - n);
    const s = report.scores || {};

    const report_el = document.createElement('div');
    report_el.id = 'flight-report';
    report_el.style.cssText = 'position:fixed;inset:0;z-index:500;background:rgba(5,10,24,0.97);backdrop-filter:blur(20px);display:flex;align-items:center;justify-content:center;padding:20px;overflow-y:auto';
    report_el.innerHTML = `
      <div style="max-width:500px;width:100%;background:rgba(15,20,40,0.95);border:2px solid rgba(245,166,35,0.6);border-radius:20px;padding:24px;box-shadow:0 10px 40px rgba(0,0,0,0.5)">
        <div style="text-align:center;margin-bottom:20px">
          <div style="font-size:48px;margin-bottom:8px">📊</div>
          <div style="font-size:24px;font-weight:900;color:#FFD700">${this._t('reportTitle') || '비행 리포트'}</div>
          <div style="font-size:32px;margin-top:8px">${stars(report.totalStars || 0)}</div>
          <div style="font-size:14px;color:rgba(255,255,255,0.6);margin-top:4px">${this._t('reportScore') || '총점'}: ${report.totalScore || 0}/5</div>
        </div>

        <div style="background:rgba(0,0,0,0.3);border-radius:12px;padding:14px;margin-bottom:12px">
          <div style="font-size:13px;color:rgba(255,255,255,0.7);margin-bottom:6px">${this._t('reportSummary') || '비행 요약'}</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:13px">
            <div>⏱ ${this._t('reportTime') || '비행시간'}: <b>${Math.round((report.flightTime || 0) / 60)}분</b></div>
            <div>🔝 ${this._t('reportMaxAlt') || '최고고도'}: <b>${report.maxAltitude || 0}ft</b></div>
            <div>💨 ${this._t('reportMaxSpd') || '최고속도'}: <b>${report.maxSpeed || 0}kt</b></div>
            <div>⛽ ${this._t('reportFuel') || '연료사용'}: <b>${report.fuelUsed || 0}%</b></div>
          </div>
        </div>

        <div style="background:rgba(0,0,0,0.3);border-radius:12px;padding:14px;margin-bottom:12px">
          <div style="font-size:13px;color:rgba(255,255,255,0.7);margin-bottom:8px">${this._t('reportScores') || '항목별 점수'}</div>
          <div style="display:flex;flex-direction:column;gap:6px;font-size:13px">
            <div style="display:flex;justify-content:space-between;align-items:center"><span>${this._t('reportAltKeep') || '고도 유지'}</span><span>${stars(s.altitudeKeeping?.stars || 0)}</span></div>
            <div style="display:flex;justify-content:space-between;align-items:center"><span>${this._t('reportSpdCtrl') || '속도 조절'}</span><span>${stars(s.speedControl?.stars || 0)}</span></div>
            <div style="display:flex;justify-content:space-between;align-items:center"><span>${this._t('reportBankCtrl') || '선회'}</span><span>${stars(s.bankControl?.stars || 0)}</span></div>
            <div style="display:flex;justify-content:space-between;align-items:center"><span>${this._t('reportLanding') || '착륙'}</span><span>${stars(s.landing?.stars || 0)} ${s.landing?.grade || ''}</span></div>
          </div>
        </div>

        <div style="background:rgba(245,166,35,0.1);border:1px solid rgba(245,166,35,0.3);border-radius:12px;padding:14px;margin-bottom:16px">
          <div style="font-size:13px;line-height:1.6">🐣 ${this._getReportMessage(report)}</div>
        </div>

        <div style="display:flex;gap:8px">
          <button onclick="document.getElementById('flight-report').remove();if(typeof App!=='undefined')App.goBack();App.goBack()" style="flex:1;padding:14px;border-radius:12px;border:none;background:rgba(245,166,35,0.8);color:#1a0800;font-weight:900;font-size:14px;cursor:pointer;font-family:inherit">🏠 ${this._t('reportHome') || '메인으로'}</button>
          <button onclick="document.getElementById('flight-report').remove()" style="padding:14px 20px;border-radius:12px;border:1px solid rgba(255,255,255,0.2);background:rgba(255,255,255,0.1);color:#fff;font-size:14px;cursor:pointer;font-family:inherit">✕</button>
        </div>
      </div>
    `;
    document.body.appendChild(report_el);

    // 음성 안내
    if (typeof App !== 'undefined' && App.ttsOn) {
      const msg = this._getReportMessage(report);
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(msg);
      u.lang = {ko:'ko-KR',en:'en-US',ja:'ja-JP',zh:'zh-CN'}[App.lang] || 'ko-KR';
      u.rate = 0.92; u.pitch = 1.05;
      window.speechSynthesis.speak(u);
    }
  },

  _getReportMessage(report) {
    const stars = report.totalStars || 0;
    const lang = (typeof App !== 'undefined') ? App.lang : 'ko';
    const msgs = {
      ko: [
        '다시 도전해보세요! 연습이 필요해요.',
        '조금 더 연습하면 잘할 수 있어요!',
        '좋아요! 잘하고 계세요.',
        '훌륭해요! 프로 조종사 같아요!',
        '완벽해요! 정말 대단하세요!'
      ],
      en: [
        'Keep trying! Practice makes perfect.',
        'A bit more practice and you will do great!',
        'Nice! You are doing well.',
        'Excellent! Like a pro pilot!',
        'Perfect! Amazing flight!'
      ],
      ja: [
        'もう一度挑戦！練習が必要です。',
        'もう少し練習すればうまくできます！',
        'いいですね！うまくやっています。',
        '素晴らしい！プロ級です！',
        '完璧です！すごい飛行でした！'
      ],
      zh: [
        '再试一次！需要更多练习。',
        '再练习一下就能做得很好！',
        '不错！做得很好。',
        '出色！像专业飞行员！',
        '完美！太棒了！'
      ]
    };
    return (msgs[lang] || msgs.ko)[Math.min(stars, 4)];
  },

  // ── 관광지 카드 ──
  _showPOI(poi) {
    const card = document.getElementById('hud-poi-card');
    if (!card) return;
    card.style.display = 'block';
    document.getElementById('hud-poi-name').textContent = `📍 ${poi.name}`;
    document.getElementById('hud-poi-desc').textContent = poi.desc;
  },

  _hidePOI() {
    const card = document.getElementById('hud-poi-card');
    if (card) card.style.display = 'none';
  },

  // ── 체크리스트 표시 ──
  _updateChecklist(phase, items) {
    const coaching = document.getElementById('hud-coaching');
    const msgEl = document.getElementById('hud-coaching-message');
    const titleEl = document.getElementById('hud-coaching-title');
    if (!coaching || !msgEl) return;

    const phaseNames = {
      preflight: '비행 전 점검', taxi: '지상 활주', takeoff: '이륙',
      cruise: '순항', landing: '착륙'
    };

    coaching.style.display = 'block';
    titleEl.textContent = `📋 ${phaseNames[phase] || phase}`;

    msgEl.innerHTML = items.map((item, i) => {
      const checked = this._checkItem(item);
      const icon = checked ? '✅' : '⬜';
      const style = checked ? 'color:rgba(255,255,255,0.4);text-decoration:line-through' : 'color:#fff';
      const keyHint = item.key ? ` <span style="color:#FFD060;font-size:11px">[${item.key}]</span>` : '';
      return `<div style="${style};padding:3px 0;font-size:13px">${icon} ${item.label}${keyHint}</div>`;
    }).join('');
  },

  _checkItem(item) {
    if (!this.lastData) return false;
    const val = this.lastData[item.simvar];
    if (val === undefined) return false;

    if (item.compare === '>=') return val >= item.expect;
    if (item.compare === '<=') return val <= item.expect;
    if (item.compare === 'near') return Math.abs(val - item.expect) < 50;
    return val === item.expect;
  },

  // ── 연결 상태 표시 ──
  _updateConnectionStatus(connected) {
    const dot = document.getElementById('hud-conn-dot');
    const text = document.getElementById('hud-conn-text');
    if (!dot || !text) return;

    if (connected) {
      dot.style.color = '#4ade80';
      text.textContent = this._t('hudConnected');
    } else {
      dot.style.color = '#ef4444';
      text.textContent = this._t('hudDisconnected');
    }
  },

  // ── 토글 함수들 ──
  _toggleCoaching() {
    const body = document.getElementById('hud-coaching-body');
    if (body) body.style.display = body.style.display === 'none' ? 'block' : 'none';
  },

  _toggleThrottle() {
    const panel = document.getElementById('hud-throttle-panel');
    if (panel) panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
  }
};

// 페이지 로드 시 자동 연결 시도
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    // 서버 모드에서만 연결 (localhost:3000)
    if (location.port === '3000' || location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
      // 서버 모드가 아닌 경우 (파일 직접 열기) 연결하지 않음
      if (location.protocol === 'file:') return;
      FlightHUD.connect();
    } else if (location.port === '3000') {
      FlightHUD.connect();
    }
  });
}
