/**
 * CockpitOS — 비행 보조 시스템
 * - 속도 조절 버튼 (상황별 동적 표시)
 * - 되돌리기 시스템 (실패/이탈 감지)
 * - AI 기반 상황 감지
 */

const FlightAssist = {
  _speedMultiplier: 1,    // 현재 속도 배율
  _panelVisible: false,
  _lastSuggestion: 0,     // 마지막 제안 시각
  _boringStartTime: null, // 지루한 구간 시작 시각
  _lastPOIMetTime: 0,
  _lastAltitude: 0,
  _lastOnGround: true,

  // 다국어 헬퍼
  _t(key) {
    const lang = (typeof App !== 'undefined') ? App.lang : 'ko';
    return (typeof T !== 'undefined' && T[lang] && T[lang][key]) ? T[lang][key] : key;
  },

  _lang() {
    return (typeof App !== 'undefined') ? App.lang : 'ko';
  },

  // ── 초기화: 보조 패널 UI 생성 (숨김 상태) ──
  init() {
    if (document.getElementById('flight-assist-panel')) return;

    const panel = document.createElement('div');
    panel.id = 'flight-assist-panel';
    panel.style.cssText = `
      position: fixed;
      top: 80px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 450;
      background: rgba(15, 20, 40, 0.95);
      border: 2px solid rgba(96, 165, 250, 0.6);
      border-radius: 16px;
      padding: 12px 16px;
      color: #fff;
      font-family: inherit;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
      display: none;
      max-width: 90vw;
      backdrop-filter: blur(10px);
    `;
    panel.innerHTML = `
      <div id="fa-title" style="font-size:13px;color:#60a5fa;margin-bottom:8px;font-weight:700"></div>
      <div id="fa-msg" style="font-size:14px;margin-bottom:12px;line-height:1.5"></div>
      <div id="fa-buttons" style="display:flex;gap:6px;flex-wrap:wrap;justify-content:center"></div>
      <button onclick="FlightAssist.hidePanel()" style="position:absolute;top:6px;right:8px;background:none;border:none;color:rgba(255,255,255,0.5);font-size:14px;cursor:pointer">✕</button>
    `;
    document.body.appendChild(panel);
  },

  // ── 패널 표시 ──
  showPanel(title, msg, buttons) {
    this.init();
    const panel = document.getElementById('flight-assist-panel');
    const titleEl = document.getElementById('fa-title');
    const msgEl = document.getElementById('fa-msg');
    const btnWrap = document.getElementById('fa-buttons');
    if (!panel || !titleEl || !msgEl || !btnWrap) return;

    titleEl.textContent = title || '';
    msgEl.textContent = msg || '';
    btnWrap.innerHTML = '';
    (buttons || []).forEach(b => {
      const btn = document.createElement('button');
      btn.textContent = b.label;
      btn.style.cssText = `
        padding: 10px 16px;
        border-radius: 10px;
        border: ${b.primary ? 'none' : '1px solid rgba(255,255,255,0.2)'};
        background: ${b.primary ? 'rgba(245,166,35,0.8)' : 'rgba(255,255,255,0.1)'};
        color: ${b.primary ? '#1a0800' : '#fff'};
        font-weight: ${b.primary ? '900' : '600'};
        font-size: 13px;
        cursor: pointer;
        font-family: inherit;
        white-space: nowrap;
      `;
      btn.onclick = () => {
        if (b.action) b.action();
        if (b.closeAfter !== false) this.hidePanel();
      };
      btnWrap.appendChild(btn);
    });
    panel.style.display = 'block';
    this._panelVisible = true;
  },

  hidePanel() {
    const panel = document.getElementById('flight-assist-panel');
    if (panel) panel.style.display = 'none';
    this._panelVisible = false;
  },

  // ── 속도 조절 ──
  setSpeed(multiplier) {
    this._speedMultiplier = multiplier;
    // 서버에 전송
    if (typeof FlightHUD !== 'undefined' && FlightHUD.send) {
      FlightHUD.send('set-speed', { multiplier });
    }
    // 시각적 피드백
    const lang = this._lang();
    const msg = {
      ko: multiplier === 1 ? '정상 속도' : `${multiplier}배 속도`,
      en: multiplier === 1 ? 'Normal Speed' : `${multiplier}x Speed`,
      ja: multiplier === 1 ? '通常速度' : `${multiplier}倍速度`,
      zh: multiplier === 1 ? '正常速度' : `${multiplier}倍速度`
    }[lang] || `${multiplier}x`;
    this._toast(msg);
  },

  // ── 되돌리기 실행 ──
  rewind(type) {
    // SimConnect 있으면 실제 되돌리기 명령 전송
    if (typeof FlightHUD !== 'undefined' && FlightHUD.send) {
      FlightHUD.send('rewind', { type });
    }
    // 음성 안내
    const lang = this._lang();
    const msgs = {
      runway: {
        ko: '활주로 출발 위치로 되돌립니다!',
        en: 'Returning to runway start!',
        ja: '滑走路の出発位置に戻します！',
        zh: '返回跑道起点！'
      },
      air:    {
        ko: '이륙 후 공중 위치로 되돌립니다!',
        en: 'Returning to airborne position!',
        ja: '離陸後の空中位置に戻します！',
        zh: '返回离地空中位置！'
      },
      approach: {
        ko: '착륙 접근 위치로 되돌립니다!',
        en: 'Returning to approach position!',
        ja: '着陸進入位置に戻します！',
        zh: '返回进近位置！'
      }
    };
    const msg = (msgs[type] || msgs.runway)[lang] || msgs.runway.ko;
    this._say(msg);
    this._toast('⏮ ' + msg);
  },

  // ── AI 기반 상황 감지 (매 프레임 호출) ──
  _lastCheckTime: 0,
  check(data) {
    if (!data) return;
    const now = Date.now();

    // 3초마다 한 번만 체크
    if (now - this._lastCheckTime < 3000) return;
    this._lastCheckTime = now;

    // ── 상황 1: 순항 지루 감지 (관광지 없음 + 3분 이상) ──
    if (data.phase === 'cruise' && !data.nearbyPOI) {
      if (!this._boringStartTime) this._boringStartTime = now;
      else if (now - this._boringStartTime > 30000 && now - this._lastSuggestion > 60000) {
        this._suggestSpeedUp();
        this._lastSuggestion = now;
      }
    } else {
      this._boringStartTime = null;
    }

    // ── 상황 2: 관광지 근처 → 자동 1x 복귀 ──
    if (data.nearbyPOI && this._speedMultiplier > 1) {
      this.setSpeed(1);
      this._toast('🎯 관광지 접근 → 정상 속도');
    }

    // ── 상황 3: 이륙 실패 감지 ──
    // 택싱 중인데 30초 이상 속도 20kt 이하 → 이륙 실패
    if (data.phase === 'taxi' && data.airspeed < 20 && this._lastOnGround) {
      if (!this._taxiStuckSince) this._taxiStuckSince = now;
      else if (now - this._taxiStuckSince > 30000) {
        this._suggestRewind('takeoff_fail');
        this._taxiStuckSince = null;
      }
    } else {
      this._taxiStuckSince = null;
    }

    // ── 상황 4: 추락/거친 착륙 감지 ──
    if (data.phase === 'landed') {
      const vs = Math.abs(data.verticalSpeed || 0);
      if (vs > 600 && now - this._lastSuggestion > 30000) {
        this._suggestRewind('hard_landing');
        this._lastSuggestion = now;
      }
    }

    // ── 상황 5: 급격한 고도 변화 (추락 조짐) ──
    if (!this._lastOnGround && data.onGround && this._lastAltitude > 100) {
      // 공중에서 갑자기 지상 (추락)
      this._suggestRewind('crash');
    }

    this._lastAltitude = data.altitude || 0;
    this._lastOnGround = !!data.onGround;
  },

  // ── 제안: 빠르게 진행할까요? ──
  _suggestSpeedUp() {
    const lang = this._lang();
    const title = { ko:'🐣 코코', en:'🐣 Coco', ja:'🐣 ココ', zh:'🐣 可可' }[lang];
    const msg = {
      ko: '다음 관광지까지 좀 걸려요. 빠르게 진행할까요?',
      en: 'A while until next POI. Want to speed up?',
      ja: '次の観光地まで少しかかります。早送りしますか？',
      zh: '到下个景点还要一会。要快进吗？'
    }[lang];
    const labels = {
      ko: { x2:'▶▶ 2배', x5:'▶▶▶ 5배', keep:'그대로' },
      en: { x2:'▶▶ 2x', x5:'▶▶▶ 5x', keep:'Keep' },
      ja: { x2:'▶▶ 2倍', x5:'▶▶▶ 5倍', keep:'そのまま' },
      zh: { x2:'▶▶ 2倍', x5:'▶▶▶ 5倍', keep:'保持' }
    }[lang];

    this.showPanel(title, msg, [
      { label: labels.x2, action: () => this.setSpeed(2) },
      { label: labels.x5, action: () => this.setSpeed(5), primary: true },
      { label: labels.keep, action: () => this.setSpeed(1) }
    ]);
  },

  // ── 제안: 되돌리기 ──
  _suggestRewind(reason) {
    const lang = this._lang();
    const title = { ko:'🐣 코코', en:'🐣 Coco', ja:'🐣 ココ', zh:'🐣 可可' }[lang];
    const scenarios = {
      takeoff_fail: {
        ko: '택싱이 어려우신가요? 활주로 출발 위치로 돌려드릴까요?',
        en: 'Taxi trouble? Return to runway start?',
        ja: '滑走が難しいですか？滑走路出発位置に戻しますか？',
        zh: '滑行有困难？返回跑道起点？'
      },
      hard_landing: {
        ko: '착륙이 거칠었어요. 다시 시도할까요?',
        en: 'Hard landing. Want to try again?',
        ja: '着陸が荒かったです。再挑戦しますか？',
        zh: '着陆有些硬。要再试一次吗？'
      },
      crash: {
        ko: '오잉! 추락했어요. 즉시 되돌릴까요?',
        en: 'Crashed! Rewind now?',
        ja: 'おっと！墜落しました。すぐ戻しますか？',
        zh: '哎呀！坠毁了。立即返回？'
      }
    };
    const labels = {
      ko: { runway:'⏮ 활주로부터', air:'✈️ 공중부터', keep:'계속' },
      en: { runway:'⏮ From Runway', air:'✈️ From Air', keep:'Continue' },
      ja: { runway:'⏮ 滑走路から', air:'✈️ 空中から', keep:'続ける' },
      zh: { runway:'⏮ 从跑道', air:'✈️ 从空中', keep:'继续' }
    }[lang];
    const msg = (scenarios[reason] || scenarios.crash)[lang];

    this.showPanel(title, msg, [
      { label: labels.runway, action: () => this.rewind('runway'), primary: true },
      { label: labels.air, action: () => this.rewind('air') },
      { label: labels.keep }
    ]);

    // 효과음
    if (typeof FlightAudio !== 'undefined') FlightAudio.playSFX('warning');
  },

  // ── 항상 보이는 속도/되돌리기 작은 버튼 (HUD 모서리) ──
  showQuickButtons() {
    if (document.getElementById('fa-quick')) return;
    const wrap = document.createElement('div');
    wrap.id = 'fa-quick';
    wrap.style.cssText = `
      position: fixed;
      top: 52px;
      right: 12px;
      z-index: 60;
      display: flex;
      flex-direction: column;
      gap: 6px;
    `;
    wrap.innerHTML = `
      <button id="fa-speed-btn" onclick="FlightAssist._cycleSpeed()" style="width:44px;height:44px;border-radius:12px;background:rgba(0,0,0,0.6);border:1px solid rgba(96,165,250,0.5);color:#60a5fa;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit" title="속도">1x</button>
      <button onclick="FlightAssist._manualRewind()" style="width:44px;height:44px;border-radius:12px;background:rgba(0,0,0,0.6);border:1px solid rgba(245,166,35,0.5);color:#FFD060;font-size:16px;cursor:pointer;font-family:inherit" title="되돌리기">⏮</button>
    `;
    document.body.appendChild(wrap);
  },

  hideQuickButtons() {
    const q = document.getElementById('fa-quick');
    if (q) q.remove();
  },

  _cycleSpeed() {
    const cycle = [1, 2, 5];
    const i = cycle.indexOf(this._speedMultiplier);
    const next = cycle[(i + 1) % cycle.length];
    this.setSpeed(next);
    const btn = document.getElementById('fa-speed-btn');
    if (btn) btn.textContent = next + 'x';
  },

  _manualRewind() {
    const lang = this._lang();
    const title = { ko:'⏮ 되돌리기', en:'⏮ Rewind', ja:'⏮ 巻き戻し', zh:'⏮ 回退' }[lang];
    const msg = {
      ko: '어디로 돌아갈까요?',
      en: 'Where to rewind?',
      ja: 'どこに戻しますか？',
      zh: '要回到哪里？'
    }[lang];
    const labels = {
      ko: { runway:'⏮ 활주로', air:'✈️ 공중', approach:'🛬 착륙전', cancel:'취소' },
      en: { runway:'⏮ Runway', air:'✈️ Air', approach:'🛬 Approach', cancel:'Cancel' },
      ja: { runway:'⏮ 滑走路', air:'✈️ 空中', approach:'🛬 進入前', cancel:'キャンセル' },
      zh: { runway:'⏮ 跑道', air:'✈️ 空中', approach:'🛬 进近前', cancel:'取消' }
    }[lang];
    this.showPanel(title, msg, [
      { label: labels.runway, action: () => this.rewind('runway'), primary: true },
      { label: labels.air, action: () => this.rewind('air') },
      { label: labels.approach, action: () => this.rewind('approach') },
      { label: labels.cancel }
    ]);
  },

  // ── 토스트 (간단 알림) ──
  _toast(msg) {
    const t = document.createElement('div');
    t.style.cssText = `
      position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);
      z-index:9500;background:rgba(0,0,0,0.85);color:#fff;
      padding:14px 24px;border-radius:24px;font-size:15px;font-weight:700;
      opacity:0;transition:opacity 0.3s;pointer-events:none
    `;
    t.textContent = msg;
    document.body.appendChild(t);
    requestAnimationFrame(() => t.style.opacity = '1');
    setTimeout(() => {
      t.style.opacity = '0';
      setTimeout(() => t.remove(), 300);
    }, 1500);
  },

  // ── 음성 안내 ──
  _say(msg) {
    if (typeof App === 'undefined' || !App.ttsOn) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(msg);
    u.lang = {ko:'ko-KR',en:'en-US',ja:'ja-JP',zh:'zh-CN'}[App.lang] || 'ko-KR';
    u.rate = 0.95; u.pitch = 1.05;
    window.speechSynthesis.speak(u);
  }
};

// FlightHUD 자동 연동
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    setTimeout(() => {
      if (typeof FlightHUD !== 'undefined') {
        // 비행 시작 시 빠른 버튼 표시 + 상황 체크
        const originalStart = FlightHUD.startFlight.bind(FlightHUD);
        FlightHUD.startFlight = function(scenario) {
          originalStart(scenario);
          FlightAssist.showQuickButtons();
        };

        // 비행 종료 시 숨김
        const originalStop = FlightHUD.stopFlight.bind(FlightHUD);
        FlightHUD.stopFlight = function() {
          originalStop();
          FlightAssist.hideQuickButtons();
          FlightAssist.hidePanel();
        };

        // 데이터 들어올 때마다 AI 상황 감지
        const originalUpdate = FlightHUD._updateHUD.bind(FlightHUD);
        FlightHUD._updateHUD = function(data, judgment) {
          originalUpdate(data, judgment);
          FlightAssist.check(data);
        };
      }
    }, 1400);
  });
}
