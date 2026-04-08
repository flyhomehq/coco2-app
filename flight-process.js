/**
 * CockpitOS — "보여주는 단축키" 엔진
 * 원클릭 비행 시 코코가 준비하는 과정을 단계별로 화면에 표시합니다.
 * 각 단계를 탭하면 코코가 설명해줍니다.
 */

const FlightProcess = {

  // 현재 언어의 번역 텍스트 가져오기
  _t(key) {
    const lang = (typeof App !== 'undefined') ? App.lang : 'ko';
    return (T && T[lang] && T[lang][key]) ? T[lang][key] : (T && T.ko && T.ko[key]) || key;
  },

  // ── 비행 준비 단계 정의 ──
  steps: {
    seoul_tour: [
      { id: 'airport',    label: '김포공항 선택',           detail: '김포국제공항(RKSS)은 서울 서쪽에 있는 공항이에요. 국내선과 일부 국제선이 운항합니다.', duration: 1500, command: null, cameraPreset: null, voice: '김포공항을 선택합니다.' },
      { id: 'aircraft',   label: 'Cessna 172 배치',         detail: 'Cessna 172는 세계에서 가장 많이 쓰이는 훈련용 비행기예요. 초보자에게 가장 좋습니다.', duration: 1500, command: null, cameraPreset: null, voice: '세스나 172를 배치합니다.' },
      { id: 'runway',     label: '활주로 32L 이동',         detail: '활주로 32L은 방향 321도를 뜻해요. L은 왼쪽(Left)입니다. 같은 방향에 활주로가 2개면 L/R로 구분해요.', duration: 2000, command: null, cameraPreset: null, voice: '활주로 32 레프트로 이동합니다.' },
      { id: 'weather',    label: '날씨 확인 (맑음)',         detail: 'METAR라는 항공 기상 정보를 확인합니다. 오늘은 맑고 바람이 약해서 비행하기 좋아요!', duration: 1500, command: null, cameraPreset: null, voice: '날씨를 확인합니다. 오늘은 맑아요!' },
      { id: 'battery',    label: '마스터 배터리 ON',         detail: '비행기의 전원을 켜는 첫 단계예요. 자동차의 시동키를 ACC에 돌리는 것과 같아요.', duration: 1000, command: 'TOGGLE_MASTER_BATTERY', cameraPreset: { target: 'masterBattery', x: -0.3, y: 0.2, z: -0.1 }, voice: '마스터 배터리를 켭니다. 왼쪽 하단의 빨간 스위치예요.' },
      { id: 'avionics',   label: '아비오닉스 ON',           detail: '아비오닉스는 항공 전자장비를 뜻해요. 이걸 켜야 계기판에 불이 들어옵니다.', duration: 1000, command: 'TOGGLE_AVIONICS', cameraPreset: { target: 'avionics', x: -0.3, y: 0.2, z: -0.1 }, voice: '아비오닉스를 켭니다. 계기판에 불이 들어와요.' },
      { id: 'beacon',     label: '비컨 라이트 ON',          detail: '비컨은 빨간 회전 경고등이에요. "지금 엔진을 켤 거니까 가까이 오지 마세요"라는 신호입니다.', duration: 800, command: 'TOGGLE_BEACON_LIGHTS', cameraPreset: { target: 'beaconLight', x: -0.2, y: 0.1, z: -0.1 }, voice: '비컨 라이트를 켭니다. 빨간 경고등이에요.' },
      { id: 'engine',     label: '엔진 시동',               detail: '프로펠러가 돌아가기 시작해요! 실제로는 프라이머, 혼합기, 스타터 순서가 있지만 코코가 한번에 해드려요.', duration: 2000, command: 'ENGINE_AUTO_START', cameraPreset: { target: 'throttle', x: 0.0, y: -0.1, z: 0.0 }, voice: '엔진 시동을 겁니다. 프로펠러가 돌아가기 시작해요!' },
      { id: 'nav_lights', label: 'NAV/스트로브 라이트 ON',  detail: 'NAV 라이트는 왼쪽 빨강, 오른쪽 초록이에요. 다른 비행기가 내 방향을 알 수 있어요.', duration: 800, command: 'TOGGLE_NAV_LIGHTS', cameraPreset: { target: 'navLights', x: -0.2, y: 0.1, z: -0.1 }, voice: '항법 라이트를 켭니다.' },
      { id: 'flaps',      label: '플랩 10° 설정',           detail: '플랩은 날개 뒤쪽의 판이에요. 펼치면 양력이 커져서 낮은 속도에서도 뜰 수 있어요.', duration: 800, command: 'SET_FLAPS_10', cameraPreset: { target: 'flaps', x: 0.1, y: -0.1, z: 0.0 }, voice: '플랩을 10도로 설정합니다.' },
      { id: 'brake_off',  label: '파킹 브레이크 해제',      detail: '주차 브레이크를 풀어야 움직일 수 있어요. 자동차에서 사이드 브레이크 내리는 것과 같아요.', duration: 800, command: 'RELEASE_PARKING_BRAKE', cameraPreset: { target: 'parkingBrake', x: 0.0, y: -0.2, z: 0.0 }, voice: '파킹 브레이크를 해제합니다.' },
      { id: 'ready',      label: '이륙 준비 완료!',         detail: '모든 준비가 끝났어요! 스로틀(엔진 출력)을 올리면 비행기가 달리기 시작합니다.', duration: 1000, command: null, cameraPreset: { target: 'defaultView', x: 0, y: 0, z: 0 }, voice: '이륙 준비가 완료되었습니다! 출발 버튼을 눌러주세요.' }
    ],
    jeju_tour: [
      { id: 'airport',    label: '제주공항 선택',           detail: '제주국제공항(RKPC)은 대한민국에서 가장 붐비는 공항 중 하나예요.', duration: 1500, command: null },
      { id: 'aircraft',   label: 'Cessna 172 배치',         detail: 'Cessna 172는 세계에서 가장 많이 쓰이는 훈련용 비행기예요.', duration: 1500, command: null },
      { id: 'runway',     label: '활주로 07 이동',          detail: '활주로 07은 방향 73도(동쪽)를 뜻해요. 제주공항의 주요 활주로입니다.', duration: 2000, command: null },
      { id: 'weather',    label: '날씨 확인 (맑음)',         detail: '제주는 바람이 조금 있지만 비행하기 좋은 날씨에요!', duration: 1500, command: null },
      { id: 'battery',    label: '마스터 배터리 ON',         detail: '비행기의 전원을 켜는 첫 단계예요.', duration: 1000, command: 'TOGGLE_MASTER_BATTERY' },
      { id: 'avionics',   label: '아비오닉스 ON',           detail: '항공 전자장비를 켭니다.', duration: 1000, command: 'TOGGLE_AVIONICS' },
      { id: 'beacon',     label: '비컨 라이트 ON',          detail: '빨간 회전 경고등을 켭니다.', duration: 800, command: 'TOGGLE_BEACON_LIGHTS' },
      { id: 'engine',     label: '엔진 시동',               detail: '프로펠러가 돌아가기 시작합니다!', duration: 2000, command: 'ENGINE_AUTO_START' },
      { id: 'nav_lights', label: 'NAV/스트로브 라이트 ON',  detail: '항법등을 켭니다.', duration: 800, command: 'TOGGLE_NAV_LIGHTS' },
      { id: 'flaps',      label: '플랩 10° 설정',           detail: '이륙을 위해 플랩을 펼칩니다.', duration: 800, command: 'SET_FLAPS_10' },
      { id: 'brake_off',  label: '파킹 브레이크 해제',      detail: '주차 브레이크를 풉니다.', duration: 800, command: 'RELEASE_PARKING_BRAKE' },
      { id: 'ready',      label: '이륙 준비 완료!',         detail: '모든 준비가 끝났어요! 아름다운 제주 하늘로 출발합니다!', duration: 1000, command: null }
    ]
  },

  _currentStepIndex: 0,
  _currentScenario: null,
  _processTimer: null,
  _overlayEl: null,
  _muted: false,
  _completed: false,

  // ── 과정 시작 ──
  start(scenario = 'seoul_tour') {
    // 이미 완료된 경우 결과만 보여주기 (자동 반복 안 함)
    if (this._completed && this._currentScenario === scenario) {
      this._createOverlay();
      this._showOverlay();
      this._currentStepIndex = this.steps[scenario].length;
      this._renderSteps();
      return;
    }

    this._currentScenario = scenario;
    this._currentStepIndex = 0;
    this._completed = false;
    this._createOverlay();
    this._showOverlay();
    this._runNextStep();
  },

  // ── 과정 중지 ──
  stop() {
    if (this._processTimer) clearTimeout(this._processTimer);
    this._processTimer = null;
    window.speechSynthesis.cancel();
    this._hideOverlay();
  },

  // ── 건너뛰기 (바로 비행 시작) ──
  skip() {
    if (this._processTimer) clearTimeout(this._processTimer);

    // 남은 명령 전부 실행
    const steps = this.steps[this._currentScenario] || [];
    for (let i = this._currentStepIndex; i < steps.length; i++) {
      if (steps[i].command && typeof FlightHUD !== 'undefined') {
        FlightHUD.sendCommand(steps[i].command);
      }
    }

    this._completeAll();
  },

  // ── 오버레이 생성 ──
  _createOverlay() {
    if (document.getElementById('process-overlay')) {
      this._overlayEl = document.getElementById('process-overlay');
      return;
    }

    const overlay = document.createElement('div');
    overlay.id = 'process-overlay';
    overlay.innerHTML = `
      <div id="process-container">
        <div id="process-topbar">
          <button onclick="FlightProcess.stop(); App.goBack();" style="background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);border-radius:10px;color:#fff;padding:8px 16px;cursor:pointer;font-family:inherit;font-size:13px">${this._t('fpBack')}</button>
          <button onclick="FlightProcess._toggleMute()" id="process-mute-btn" style="background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);border-radius:10px;color:#fff;padding:8px 16px;cursor:pointer;font-family:inherit;font-size:13px">${this._t('fpMute')}</button>
        </div>
        <div id="process-header">
          <div id="process-coco">🐣</div>
          <div id="process-title">${this._t('fpPreparing')}</div>
        </div>
        <div id="process-steps"></div>
        <div id="process-detail" style="display:none">
          <div id="process-detail-title"></div>
          <div id="process-detail-text"></div>
          <button onclick="FlightProcess._hideDetail()" style="margin-top:8px;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);border-radius:8px;color:#fff;padding:6px 14px;cursor:pointer;font-family:inherit;font-size:12px">확인</button>
        </div>
        <div id="process-bottom">
          <button onclick="FlightProcess._askCoco()" id="process-ask-btn" style="background:rgba(96,165,250,0.2);border:1px solid rgba(96,165,250,0.4);border-radius:12px;color:#60a5fa;padding:10px 20px;cursor:pointer;font-family:inherit;font-size:13px;margin-bottom:8px;width:100%">${this._t('fpAsk')}</button>
          <button onclick="FlightProcess.skip()" id="process-skip-btn" style="background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);border-radius:12px;color:rgba(255,255,255,0.7);padding:10px 20px;cursor:pointer;font-family:inherit;font-size:13px">${this._t('fpSkip')}</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    this._overlayEl = overlay;
  },

  // ── 단계 렌더링 ──
  _renderSteps() {
    const container = document.getElementById('process-steps');
    if (!container) return;

    const steps = this.steps[this._currentScenario] || [];
    container.innerHTML = steps.map((step, i) => {
      let icon, className;
      if (i < this._currentStepIndex) {
        icon = '✅'; className = 'step-done';
      } else if (i === this._currentStepIndex) {
        icon = '⏳'; className = 'step-active';
      } else {
        icon = '⬜'; className = 'step-pending';
      }

      return `<div class="process-step ${className}" onclick="FlightProcess._showDetail(${i})">
        <span class="step-icon">${icon}</span>
        <span class="step-label">${step.label}</span>
        <span class="step-question">❓</span>
      </div>`;
    }).join('');
  },

  // ── 다음 단계 실행 ──
  _runNextStep() {
    const steps = this.steps[this._currentScenario] || [];

    if (this._currentStepIndex >= steps.length) {
      this._completeAll();
      return;
    }

    this._renderSteps();

    const step = steps[this._currentStepIndex];

    // SimConnect 명령 실행 (스위치 조작)
    if (step.command && typeof FlightHUD !== 'undefined') {
      FlightHUD.sendCommand(step.command);
    }

    // ★ [TODO: SimConnect 연결 시 구현]
    // 큰 화면(MSFS)에 해당 스위치/계기 클로즈업 표시
    // SimConnect 카메라를 해당 위치로 이동시켜서
    // 사용자가 큰 화면에서 직접 눈으로 볼 수 있게 함
    // 태블릿 음성과 큰 화면 클로즈업이 싱크 맞춰야 함
    if (step.cameraPreset && typeof FlightHUD !== 'undefined') {
      FlightHUD.sendCommand('CAMERA_MOVE', step.cameraPreset);
      // 실제 구현 시:
      // 1. SimConnect_SetCameraDefinition6DOF(step.cameraPreset)
      // 2. 2~3초 대기 (사용자가 볼 시간)
      // 3. 카메라 원위치 복귀
    }

    // 음성은 자동 진행 중에는 안 읽음 (카드가 빠르게 넘어가서 끊김)
    // 사용자가 카드를 탭하면 그때 읽어줌 (_showDetail에서 처리)

    // 다음 단계로
    this._processTimer = setTimeout(() => {
      this._currentStepIndex++;
      this._runNextStep();
    }, step.duration);
  },

  // ── 모든 단계 완료 ──
  _completeAll() {
    this._renderSteps();

    const title = document.getElementById('process-title');
    if (title) title.textContent = this._t('fpComplete');

    const skipBtn = document.getElementById('process-skip-btn');
    if (skipBtn) {
      skipBtn.textContent = this._t('fpGo');
      skipBtn.onclick = () => {
        this._hideOverlay();
        // 비행 HUD 전환
        if (typeof FlightHUD !== 'undefined' && FlightHUD.connected) {
          FlightHUD.startFlight(this._currentScenario);
        }
      };
      skipBtn.style.background = 'rgba(245,166,35,0.8)';
      skipBtn.style.color = '#1a0800';
      skipBtn.style.fontWeight = '900';
      skipBtn.style.border = 'none';
    }

    this._completed = true;

    // TTS로 음성 안내
    if (typeof App !== 'undefined' && App.ttsOn && !this._muted) {
      const lang = (typeof App !== 'undefined') ? App.lang : 'ko';
      const utterance = new SpeechSynthesisUtterance(this._t('fpAllDone'));
      utterance.lang = { ko: 'ko-KR', en: 'en-US', ja: 'ja-JP', zh: 'zh-CN' }[lang] || 'ko-KR';
      utterance.rate = 0.92;
      utterance.pitch = 1.05;
      window.speechSynthesis.speak(utterance);
    }
  },

  // ── 상세 설명 표시 ──
  _showDetail(stepIndex) {
    const steps = this.steps[this._currentScenario] || [];
    if (stepIndex >= steps.length) return;

    const step = steps[stepIndex];
    const detailEl = document.getElementById('process-detail');
    const titleEl = document.getElementById('process-detail-title');
    const textEl = document.getElementById('process-detail-text');

    if (detailEl && titleEl && textEl) {
      titleEl.textContent = `💡 ${step.label}`;
      textEl.textContent = step.detail;
      detailEl.style.display = 'block';

      // TTS
      if (typeof App !== 'undefined' && App.ttsOn && !this._muted) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(step.detail);
        utterance.lang = 'ko-KR';
        utterance.rate = 0.92;
        utterance.pitch = 1.05;
        window.speechSynthesis.speak(utterance);
      }
    }
  },

  _hideDetail() {
    const detailEl = document.getElementById('process-detail');
    if (detailEl) detailEl.style.display = 'none';
    window.speechSynthesis.cancel();
  },

  // ── 코코에게 질문하기 (과정 페이지 안 자체 질문창) ──
  _askCoco() {
    let detailEl = document.getElementById('process-detail');
    let titleEl = document.getElementById('process-detail-title');
    let textEl = document.getElementById('process-detail-text');

    // detail 영역이 없으면 생성
    if (!detailEl) {
      const container = document.getElementById('process-container');
      if (!container) return;
      const d = document.createElement('div');
      d.id = 'process-detail';
      d.style.display = 'none';
      d.innerHTML = '<div id="process-detail-title"></div><div id="process-detail-text"></div><button onclick="FlightProcess._hideDetail()" style="margin-top:8px;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);border-radius:8px;color:#fff;padding:6px 14px;cursor:pointer;font-family:inherit;font-size:12px">닫기</button>';
      container.appendChild(d);
      detailEl = d;
      titleEl = document.getElementById('process-detail-title');
      textEl = document.getElementById('process-detail-text');
    }
    if (!titleEl || !textEl) return;

    titleEl.textContent = '🐣 코코에게 질문하세요';
    textEl.innerHTML = `
      <textarea id="pq-input" rows="2" placeholder="말씀하시거나 여기를 탭해서 직접 입력하세요"
        style="width:100%;padding:12px;border-radius:10px;border:1px solid rgba(255,255,255,0.3);background:rgba(255,255,255,0.1);color:#fff;font-size:14px;font-family:inherit;box-sizing:border-box;resize:none;margin-bottom:8px"></textarea>
      <div style="display:flex;gap:8px">
        <button onclick="FlightProcess._submitQ()" style="flex:1;padding:12px;border-radius:10px;border:none;background:rgba(96,165,250,0.7);color:#fff;font-size:14px;cursor:pointer;font-family:inherit">→ 코코에게 물어보기</button>
        <button onclick="FlightProcess._hideDetail()" style="padding:12px 16px;border-radius:10px;border:1px solid rgba(255,255,255,0.2);background:rgba(255,255,255,0.1);color:#fff;font-size:14px;cursor:pointer;font-family:inherit">닫기</button>
      </div>`;
    detailEl.style.display = 'block';

    setTimeout(() => {
      const input = document.getElementById('pq-input');
      if (input) {
        input.focus();
        input.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); FlightProcess._submitQ(); } };
      }
    }, 100);
  },

  _submitQ() {
    const input = document.getElementById('pq-input');
    if (!input || !input.value.trim()) return;
    const question = input.value.trim();

    const titleEl = document.getElementById('process-detail-title');
    const textEl = document.getElementById('process-detail-text');
    titleEl.textContent = '🐣 코코가 답변 중...';
    textEl.textContent = '잠시만 기다려주세요...';

    const steps = this.steps[this._currentScenario] || [];
    const ctx = steps.map(s => `${s.label}: ${s.detail}`).join('\n');

    fetch('/api/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system: `당신은 CockpitOS의 AI 비행 비서 코코입니다.\n체크리스트:\n${ctx}\n\n비행 초보자에게 쉽고 친근하게 2~3문장으로 설명하세요.`,
        messages: [{ role: 'user', content: question }],
        max_tokens: 300
      })
    })
    .then(r => r.json())
    .then(data => {
      const answer = data.content ? data.content[0].text : (data.error || '답변을 받지 못했어요.');
      titleEl.textContent = '🐣 코코의 답변';
      textEl.innerHTML = `<div style="margin-bottom:12px;line-height:1.6">${answer}</div>
        <button onclick="FlightProcess._askCoco()" style="width:100%;padding:10px;border-radius:8px;border:1px solid rgba(96,165,250,0.4);background:rgba(96,165,250,0.2);color:#60a5fa;cursor:pointer;font-family:inherit;font-size:13px;margin-bottom:6px">다시 질문하기</button>
        <button onclick="FlightProcess._hideDetail()" style="width:100%;padding:8px;border-radius:8px;border:1px solid rgba(255,255,255,0.2);background:rgba(255,255,255,0.05);color:rgba(255,255,255,0.6);cursor:pointer;font-family:inherit;font-size:12px">닫기</button>`;
      if (!FlightProcess._muted) {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(answer);
        u.lang = 'ko-KR'; u.rate = 0.92; u.pitch = 1.05;
        window.speechSynthesis.speak(u);
      }
    })
    .catch(() => {
      titleEl.textContent = '🐣 코코';
      textEl.textContent = 'API 키가 설정되지 않았어요. server/.env 파일을 확인해주세요.';
    });
  },

  // ── 음성 차단 토글 ──
  _toggleMute() {
    this._muted = !this._muted;
    const btn = document.getElementById('process-mute-btn');
    if (btn) btn.textContent = this._muted ? this._t('fpMuted') : this._t('fpMute');
    if (this._muted) window.speechSynthesis.cancel();
  },

  // ── 오버레이 보이기/숨기기 ──
  _showOverlay() {
    if (this._overlayEl) this._overlayEl.style.display = 'flex';
  },

  _hideOverlay() {
    if (this._overlayEl) this._overlayEl.style.display = 'none';
  }
};
