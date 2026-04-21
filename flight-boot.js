/**
 * ═══════════════════════════════════════════════════════════════════
 *  CockpitOS — 부팅 시퀀스 UI (프론트엔드)
 * ═══════════════════════════════════════════════════════════════════
 *
 * 역할:
 *   - 게스트가 "서울 가자" 클릭 시
 *   - PC 부팅 → MSFS 실행 → 연결 과정을 화면에 표시
 *   - 진행률, 현재 단계, 예상 시간 표시
 *   - 에러 발생 시 복구 옵션 제공
 *
 * 상태별 UI:
 *   - starting:             "시작합니다"
 *   - checking-pc:          "PC 확인 중"
 *   - waking:               "PC 깨우는 중"
 *   - booting:              "PC 부팅 대기"
 *   - checking-msfs:        "시뮬레이터 확인 중"
 *   - launching-msfs:       "시뮬레이터 시작"
 *   - loading-msfs:         "시뮬레이터 로딩"
 *   - connecting-simconnect:"비행기 연결 중"
 *   - ready:                "준비 완료!"
 *   - error:                "문제 발생"
 *
 * 사용자 경험 원칙:
 *   - 항상 "뭐하고 있는지" 보여줌 (공백 금지)
 *   - 현실적인 시간 표시 (전체 2~5분)
 *   - 친근한 말투 (4개국어)
 *   - 에러 시 명확한 다음 행동 제시
 *
 * ═══════════════════════════════════════════════════════════════════
 */

const FlightBoot = {
  _wrap: null,
  _ws: null,
  _currentState: 'idle',

  _lang() {
    return (typeof App !== 'undefined') ? App.lang : 'ko';
  },

  /**
   * 부팅 화면 표시 시작
   *
   * @param {Object} options
   * @param {string} options.scenario - 'seoul_tour', 'jeju_tour' 등
   */
  start(options = {}) {
    this._createUI();
    this._connectToServer(options);
  },

  /**
   * UI 생성
   */
  _createUI() {
    if (this._wrap) {
      this._wrap.style.display = 'flex';
      return;
    }

    const lang = this._lang();
    const titles = {
      ko: '비행 준비 중', en: 'Preparing Flight',
      ja: '飛行準備中', zh: '准备飞行'
    };

    const wrap = document.createElement('div');
    wrap.id = 'flight-boot-screen';
    wrap.style.cssText = `
      position: fixed;
      inset: 0;
      z-index: 400;
      background: linear-gradient(135deg, #050a14 0%, #0a1530 100%);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px;
      font-family: inherit;
      color: #fff;
    `;
    wrap.innerHTML = `
      <div style="max-width: 500px; width: 100%; text-align: center">

        <div style="font-size: 72px; margin-bottom: 16px; animation: float 3s ease-in-out infinite">✈️</div>

        <h2 id="boot-title" style="font-size: 24px; margin: 0 0 8px 0; color: #FFD060">
          ${titles[lang] || titles.ko}
        </h2>

        <div id="boot-step" style="font-size: 14px; color: rgba(255,255,255,0.7); margin-bottom: 32px">
          ${this._getStepLabel('starting')}
        </div>

        <div style="background: rgba(0,0,0,0.4); border-radius: 12px; height: 8px; overflow: hidden; margin-bottom: 16px">
          <div id="boot-progress" style="height: 100%; background: linear-gradient(90deg, #4ade80, #FFD060, #60a5fa); width: 0%; transition: width 0.5s"></div>
        </div>

        <div style="display: flex; justify-content: space-between; font-size: 11px; color: rgba(255,255,255,0.5); margin-bottom: 32px">
          <span id="boot-pct">0%</span>
          <span id="boot-eta">${this._getETALabel()}</span>
        </div>

        <div id="boot-status-icons" style="display: flex; justify-content: center; gap: 20px; margin-bottom: 24px; font-size: 28px"></div>

        <div id="boot-message" style="font-size: 13px; color: rgba(255,255,255,0.6); line-height: 1.6; padding: 0 20px"></div>

        <div id="boot-actions" style="margin-top: 24px; display: none; flex-direction: column; gap: 8px"></div>
      </div>

      <style>
        @keyframes float { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-10px) } }
      </style>
    `;
    document.body.appendChild(wrap);
    this._wrap = wrap;
    this._renderStatusIcons('starting');
  },

  /**
   * 서버 WebSocket 연결
   */
  _connectToServer(options) {
    if (typeof FlightHUD !== 'undefined' && FlightHUD.ws) {
      // 기존 WebSocket 재사용
      this._ws = FlightHUD.ws;
    } else {
      // 새 WebSocket
      const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
      this._ws = new WebSocket(`${protocol}//${location.host}/ws`);
    }

    // 부팅 요청 전송
    const sendBootStart = () => {
      if (this._ws.readyState === 1) {
        this._ws.send(JSON.stringify({
          type: 'boot-start',
          scenario: options.scenario || 'seoul_tour'
        }));
      } else {
        setTimeout(sendBootStart, 500);
      }
    };

    // 서버 메시지 수신
    const onMessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'boot-state') this._updateState(msg.state, msg.step);
        else if (msg.type === 'boot-progress') this._updateProgress(msg.progress);
        else if (msg.type === 'boot-ready') this._onReady();
        else if (msg.type === 'boot-error') this._onError(msg.error);
      } catch(e) {}
    };

    if (this._ws.readyState === 1) {
      this._ws.addEventListener('message', onMessage);
      sendBootStart();
    } else {
      this._ws.addEventListener('open', () => {
        this._ws.addEventListener('message', onMessage);
        sendBootStart();
      });
    }
  },

  /**
   * 상태 업데이트
   */
  _updateState(state, step) {
    this._currentState = state;
    const stepEl = document.getElementById('boot-step');
    if (stepEl) stepEl.textContent = step || this._getStepLabel(state);
    this._renderStatusIcons(state);
  },

  /**
   * 진행률 업데이트
   */
  _updateProgress(pct) {
    const bar = document.getElementById('boot-progress');
    const label = document.getElementById('boot-pct');
    if (bar) bar.style.width = pct + '%';
    if (label) label.textContent = pct + '%';
  },

  /**
   * 준비 완료
   */
  _onReady() {
    const lang = this._lang();
    const msg = {
      ko: '✅ 준비 완료! 비행을 시작합니다',
      en: '✅ Ready! Starting flight',
      ja: '✅ 準備完了！飛行開始',
      zh: '✅ 准备完毕！开始飞行'
    }[lang] || '';

    const stepEl = document.getElementById('boot-step');
    if (stepEl) {
      stepEl.textContent = msg;
      stepEl.style.color = '#4ade80';
    }

    // 1.5초 후 자동 숨김
    setTimeout(() => {
      if (this._wrap) this._wrap.style.display = 'none';
    }, 1500);
  },

  /**
   * 에러 처리
   */
  _onError(error) {
    const lang = this._lang();
    const titleEl = document.getElementById('boot-title');
    const stepEl = document.getElementById('boot-step');
    const msgEl = document.getElementById('boot-message');
    const actionsEl = document.getElementById('boot-actions');

    if (titleEl) {
      titleEl.textContent = { ko:'문제가 발생했어요', en:'Problem', ja:'問題発生', zh:'出现问题' }[lang];
      titleEl.style.color = '#ef4444';
    }
    if (stepEl) stepEl.textContent = error.message || 'Unknown error';
    if (msgEl) {
      msgEl.innerHTML = {
        ko: '잠시만 기다려주세요. 자동으로 다시 시도하거나<br>호스트에게 연락해드릴 수 있어요.',
        en: 'Please wait. We can retry automatically<br>or notify the host.',
        ja: 'しばらくお待ちください。再試行するか<br>ホストに連絡します。',
        zh: '请稍候。可以自动重试<br>或通知房主。'
      }[lang];
    }

    if (actionsEl) {
      actionsEl.style.display = 'flex';
      actionsEl.innerHTML = `
        <button onclick="FlightBoot.retry()" style="padding:12px;background:rgba(245,166,35,0.8);color:#1a0800;border:none;border-radius:10px;font-weight:700;cursor:pointer;font-family:inherit">${{ ko:'🔄 다시 시도', en:'🔄 Retry', ja:'🔄 再試行', zh:'🔄 重试' }[lang]}</button>
        <button onclick="FlightBoot.callHost()" style="padding:12px;background:rgba(255,255,255,0.1);color:#fff;border:1px solid rgba(255,255,255,0.2);border-radius:10px;cursor:pointer;font-family:inherit">${{ ko:'📞 호스트 호출', en:'📞 Call Host', ja:'📞 ホスト呼出', zh:'📞 呼叫房主' }[lang]}</button>
        <button onclick="FlightBoot.cancel()" style="padding:8px;background:none;color:rgba(255,255,255,0.5);border:none;cursor:pointer;font-family:inherit;font-size:12px">${{ ko:'취소', en:'Cancel', ja:'キャンセル', zh:'取消' }[lang]}</button>
      `;
    }
  },

  retry() {
    location.reload();
  },

  callHost() {
    if (this._ws && this._ws.readyState === 1) {
      this._ws.send(JSON.stringify({ type: 'host-call', reason: 'boot-error' }));
    }
    const msg = { ko:'호스트에게 연락했어요. 잠시만 기다려주세요.', en:'Host has been notified.', ja:'ホストに通知しました。', zh:'已通知房主。' };
    alert(msg[this._lang()] || msg.ko);
  },

  cancel() {
    if (this._wrap) this._wrap.style.display = 'none';
  },

  /**
   * 상태별 아이콘 렌더링
   */
  _renderStatusIcons(state) {
    const el = document.getElementById('boot-status-icons');
    if (!el) return;

    const phases = [
      { key: 'pc',   icon: '💻', states: ['checking-pc', 'waking', 'booting'] },
      { key: 'msfs', icon: '✈️', states: ['checking-msfs', 'launching-msfs', 'loading-msfs'] },
      { key: 'sim',  icon: '🔌', states: ['connecting-simconnect'] },
      { key: 'ready',icon: '🎯', states: ['ready'] }
    ];

    const currentIdx = phases.findIndex(p => p.states.includes(state));

    el.innerHTML = phases.map((p, i) => {
      const isDone = i < currentIdx;
      const isActive = i === currentIdx;
      const opacity = isDone ? '0.5' : (isActive ? '1' : '0.2');
      const animation = isActive ? 'pulse 1.5s ease-in-out infinite' : 'none';
      return `<div style="opacity:${opacity};animation:${animation}">${p.icon}</div>`;
    }).join('<div style="opacity:0.3;align-self:center">→</div>').replace(/(<div[^>]+>[^<]+<\/div>)/g, '$1').replace('><div', `> <div style="opacity:0.3;align-self:center;font-size:14px">→</div> <div`);
  },

  _getStepLabel(state) {
    const lang = this._lang();
    const labels = {
      ko: {
        starting: '시작합니다...',
        'checking-pc': '컴퓨터 확인 중...',
        waking: '컴퓨터를 깨우는 중...',
        booting: '컴퓨터 부팅 대기 중 (약 1~2분)',
        'checking-msfs': '시뮬레이터 확인 중...',
        'launching-msfs': '시뮬레이터 시작 중...',
        'loading-msfs': '시뮬레이터 로딩 중 (약 1~2분)',
        'connecting-simconnect': '비행기에 연결 중...',
        ready: '준비 완료!'
      },
      en: {
        starting: 'Starting...',
        'checking-pc': 'Checking PC...',
        waking: 'Waking up PC...',
        booting: 'Waiting for PC boot (~1-2 min)',
        'checking-msfs': 'Checking simulator...',
        'launching-msfs': 'Launching simulator...',
        'loading-msfs': 'Loading simulator (~1-2 min)',
        'connecting-simconnect': 'Connecting to aircraft...',
        ready: 'Ready!'
      },
      ja: {
        starting: '開始...',
        'checking-pc': 'PC確認中...',
        waking: 'PC起動中...',
        booting: 'PC起動待機中 (約1-2分)',
        'checking-msfs': 'シミュレーター確認中...',
        'launching-msfs': 'シミュレーター開始中...',
        'loading-msfs': 'シミュレーター読み込み中 (約1-2分)',
        'connecting-simconnect': '航空機接続中...',
        ready: '準備完了！'
      },
      zh: {
        starting: '启动中...',
        'checking-pc': '检查电脑...',
        waking: '唤醒电脑...',
        booting: '等待电脑启动 (约1-2分钟)',
        'checking-msfs': '检查模拟器...',
        'launching-msfs': '启动模拟器...',
        'loading-msfs': '加载模拟器 (约1-2分钟)',
        'connecting-simconnect': '连接飞机...',
        ready: '准备完毕!'
      }
    };
    return (labels[lang] || labels.ko)[state] || state;
  },

  _getETALabel() {
    const lang = this._lang();
    return { ko:'예상 시간: 2~5분', en:'Est. 2-5 min', ja:'推定2-5分', zh:'预计2-5分钟' }[lang] || '2-5 min';
  }
};
