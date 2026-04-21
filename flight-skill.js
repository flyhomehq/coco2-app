/**
 * CockpitOS — 교육 계층 / 숙련도 시스템
 * - 초보/중급/고급 3단계
 * - 비행 횟수 + 배지 수로 자동 해금
 * - 레벨별 UI 요소 표시/숨김
 */

const FlightSkill = {
  _level: 'beginner', // beginner, intermediate, advanced
  _flightCount: 0,

  _lang() {
    return (typeof App !== 'undefined') ? App.lang : 'ko';
  },

  // ── 초기화 ──
  init() {
    try {
      const saved = localStorage.getItem('cpos_skill_level');
      const count = localStorage.getItem('cpos_flight_count');
      if (saved) this._level = saved;
      if (count) this._flightCount = parseInt(count) || 0;
    } catch(e) {}
    this._applyLevel();
  },

  // ── 비행 완료 시 호출 ──
  onFlightComplete() {
    this._flightCount++;
    try { localStorage.setItem('cpos_flight_count', this._flightCount); } catch(e) {}

    // 자동 승급 체크
    const badgeCount = (typeof FlightBadges !== 'undefined') ? FlightBadges.getTotalCount() : 0;
    let newLevel = this._level;
    if (this._flightCount >= 50 && badgeCount >= 6) newLevel = 'advanced';
    else if (this._flightCount >= 10 && badgeCount >= 3) newLevel = 'intermediate';
    else newLevel = 'beginner';

    if (newLevel !== this._level) {
      this._level = newLevel;
      try { localStorage.setItem('cpos_skill_level', newLevel); } catch(e) {}
      this._showLevelUp(newLevel);
      this._applyLevel();
    }
  },

  // ── 레벨별 UI 적용 ──
  _applyLevel() {
    // 데이터 속성으로 body에 설정 → CSS에서 숨김/표시 제어
    document.body.setAttribute('data-skill-level', this._level);
  },

  // ── 레벨업 팝업 ──
  _showLevelUp(level) {
    const lang = this._lang();
    const levels = {
      beginner:    { icon: '🌱', ko:'초보', en:'Beginner', ja:'初心者', zh:'初级' },
      intermediate:{ icon: '✈️', ko:'중급', en:'Intermediate', ja:'中級', zh:'中级' },
      advanced:    { icon: '🏆', ko:'고급', en:'Advanced', ja:'上級', zh:'高级' }
    };
    const info = levels[level];
    const title = {
      ko: `${info.icon} 레벨 업! ${info.ko} 해금!`,
      en: `${info.icon} Level Up! ${info.en} unlocked!`,
      ja: `${info.icon} レベルアップ！${info.ja}解放！`,
      zh: `${info.icon} 升级！解锁${info.zh}！`
    }[lang];

    const notif = document.createElement('div');
    notif.style.cssText = `
      position: fixed; top: 40%; left: 50%;
      transform: translate(-50%, -50%);
      z-index: 700;
      background: linear-gradient(135deg, rgba(96,165,250,0.95), rgba(147,51,234,0.95));
      border: 3px solid #FFD700;
      border-radius: 24px;
      padding: 32px 48px;
      color: #fff;
      font-weight: 900;
      text-align: center;
      box-shadow: 0 20px 60px rgba(147,51,234,0.5);
      font-family: inherit;
      animation: levelup-in 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
    `;
    notif.innerHTML = `
      <div style="font-size:64px;margin-bottom:12px">${info.icon}</div>
      <div style="font-size:20px">${title}</div>
    `;
    document.body.appendChild(notif);

    if (typeof FlightAudio !== 'undefined') FlightAudio.playSFX('badgeEarned');

    setTimeout(() => notif.remove(), 4000);
  },

  // ── 특정 기능 사용 가능 여부 ──
  canUse(feature) {
    const features = {
      // 초보
      basic_map: ['beginner', 'intermediate', 'advanced'],
      auto_pilot: ['beginner', 'intermediate', 'advanced'],
      ai_questions: ['beginner', 'intermediate', 'advanced'],

      // 중급
      detailed_map: ['intermediate', 'advanced'],
      atc_mode: ['intermediate', 'advanced'],
      camera_ai: ['intermediate', 'advanced'],

      // 고급
      navigraph: ['advanced'],
      simbrief: ['advanced'],
      multi_monitor: ['advanced']
    };
    return (features[feature] || []).includes(this._level);
  },

  getLevel() { return this._level; },
  getFlightCount() { return this._flightCount; }
};

// 비행 리포트 닫을 때 자동 호출
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    FlightSkill.init();

    setTimeout(() => {
      if (typeof FlightHUD !== 'undefined') {
        // 비행 종료 시 카운트 증가
        const originalStop = FlightHUD.stopFlight.bind(FlightHUD);
        FlightHUD.stopFlight = function() {
          originalStop();
          FlightSkill.onFlightComplete();
        };
      }
    }, 1600);
  });
}
