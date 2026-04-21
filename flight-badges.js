/**
 * CockpitOS — 배지/도전 과제 시스템
 * 비행 중 실시간으로 달성 감지 + 시각적 피드백
 */

const FlightBadges = {
  _earned: new Set(),       // 이번 비행에서 딴 배지
  _allEarned: new Set(),    // 전체 보유 배지 (localStorage)
  _visitedPOIs: new Set(),  // 방문한 관광지

  // 다국어 헬퍼
  _t(key) {
    const lang = (typeof App !== 'undefined') ? App.lang : 'ko';
    return (typeof T !== 'undefined' && T[lang] && T[lang][key]) ? T[lang][key] : key;
  },

  // ── 배지 정의 ──
  badges: [
    {
      id: 'first_takeoff',
      icon: '🛫',
      titles: { ko:'첫 이륙', en:'First Takeoff', ja:'初離陸', zh:'首次起飞' },
      check: (data, stats) => data.phase === 'takeoff' && !stats.hadTakeoff
    },
    {
      id: 'altitude_3000',
      icon: '📈',
      titles: { ko:'고도 3000ft 달성', en:'Reached 3000ft', ja:'3000ft到達', zh:'达到3000英尺' },
      check: (data, stats) => data.altitude >= 3000
    },
    {
      id: 'altitude_5000',
      icon: '🦅',
      titles: { ko:'고공 비행 (5000ft)', en:'High Altitude (5000ft)', ja:'高空飛行 (5000ft)', zh:'高空飞行 (5000英尺)' },
      check: (data, stats) => data.altitude >= 5000
    },
    {
      id: 'speed_150',
      icon: '💨',
      titles: { ko:'고속 비행 (150kt)', en:'High Speed (150kt)', ja:'高速飛行 (150kt)', zh:'高速飞行 (150节)' },
      check: (data, stats) => data.airspeed >= 150
    },
    {
      id: 'seoul_tour',
      icon: '🗺️',
      titles: { ko:'서울 투어', en:'Seoul Tour', ja:'ソウルツアー', zh:'首尔之旅' },
      check: (data, stats) => stats.visitedPOIs >= 3
    },
    {
      id: 'all_pois',
      icon: '🏆',
      titles: { ko:'관광지 마스터', en:'POI Master', ja:'観光地マスター', zh:'景点大师' },
      check: (data, stats) => stats.visitedPOIs >= 8
    },
    {
      id: 'soft_landing',
      icon: '🎯',
      titles: { ko:'부드러운 착륙', en:'Soft Landing', ja:'ソフトランディング', zh:'软着陆' },
      check: (data, stats) => data.phase === 'landed' && Math.abs(data.verticalSpeed || 0) < 200
    },
    {
      id: 'complete_flight',
      icon: '✈️',
      titles: { ko:'비행 완주', en:'Flight Complete', ja:'飛行完走', zh:'飞行完成' },
      check: (data, stats) => data.phase === 'landed'
    }
  ],

  // ── 초기화 ──
  init() {
    try {
      const saved = localStorage.getItem('cpos_badges');
      if (saved) this._allEarned = new Set(JSON.parse(saved));
    } catch(e) {}
    this._earned.clear();
    this._visitedPOIs.clear();
  },

  // ── 비행 시작 ──
  reset() {
    this._earned.clear();
    this._visitedPOIs.clear();
  },

  // ── 비행 데이터 들어올 때마다 검사 ──
  check(data) {
    if (!data) return;

    // 방문한 POI 추적
    if (data.nearbyPOI && data.nearbyPOI.name) {
      this._visitedPOIs.add(data.nearbyPOI.name);
    }

    const stats = {
      hadTakeoff: this._earned.has('first_takeoff'),
      visitedPOIs: this._visitedPOIs.size
    };

    for (const badge of this.badges) {
      if (this._earned.has(badge.id)) continue;
      try {
        if (badge.check(data, stats)) {
          this._earn(badge);
        }
      } catch(e) {}
    }
  },

  // ── 배지 획득 처리 ──
  _earn(badge) {
    this._earned.add(badge.id);
    this._allEarned.add(badge.id);

    // localStorage 저장
    try {
      localStorage.setItem('cpos_badges', JSON.stringify([...this._allEarned]));
    } catch(e) {}

    // 효과음
    if (typeof FlightAudio !== 'undefined') FlightAudio.playSFX('badgeEarned');

    // 화면 알림
    this._showNotification(badge);

    // 음성 안내
    if (typeof App !== 'undefined' && App.ttsOn) {
      const lang = App.lang || 'ko';
      const title = badge.titles[lang] || badge.titles.ko;
      const msgs = {
        ko: `축하해요! "${title}" 배지를 획득했어요!`,
        en: `Congratulations! Earned "${title}" badge!`,
        ja: `おめでとう！「${title}」バッジを獲得！`,
        zh: `恭喜！获得"${title}"徽章！`
      };
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(msgs[lang] || msgs.ko);
      u.lang = {ko:'ko-KR',en:'en-US',ja:'ja-JP',zh:'zh-CN'}[lang] || 'ko-KR';
      u.rate = 0.95; u.pitch = 1.1;
      window.speechSynthesis.speak(u);
    }
  },

  // ── 배지 획득 알림 ──
  _showNotification(badge) {
    const lang = (typeof App !== 'undefined') ? App.lang : 'ko';
    const title = badge.titles[lang] || badge.titles.ko;
    const label = {
      ko: '🏆 새 배지!', en: '🏆 New Badge!', ja: '🏆 新バッジ！', zh: '🏆 新徽章！'
    }[lang] || '🏆 새 배지!';

    const notif = document.createElement('div');
    notif.className = 'badge-notification';
    notif.style.cssText = `
      position: fixed;
      top: 80px;
      left: 50%;
      transform: translateX(-50%) translateY(-20px);
      z-index: 600;
      background: linear-gradient(135deg, rgba(245,166,35,0.95), rgba(255,215,0,0.95));
      border: 2px solid #FFD700;
      border-radius: 16px;
      padding: 16px 24px;
      color: #1a0800;
      font-weight: 900;
      text-align: center;
      box-shadow: 0 8px 30px rgba(255,215,0,0.4);
      opacity: 0;
      transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
      min-width: 240px;
      pointer-events: auto;
      cursor: pointer;
    `;
    notif.innerHTML = `
      <div style="font-size:12px;color:rgba(26,8,0,0.7);margin-bottom:4px">${label}</div>
      <div style="font-size:40px;margin:4px 0">${badge.icon}</div>
      <div style="font-size:16px">${title}</div>
    `;
    notif.onclick = () => notif.remove();
    document.body.appendChild(notif);

    // 등장
    requestAnimationFrame(() => {
      notif.style.opacity = '1';
      notif.style.transform = 'translateX(-50%) translateY(0)';
    });

    // 4초 후 사라짐
    setTimeout(() => {
      notif.style.opacity = '0';
      notif.style.transform = 'translateX(-50%) translateY(-20px)';
      setTimeout(() => notif.remove(), 400);
    }, 4000);
  },

  // ── 보유 배지 수 조회 ──
  getTotalCount() {
    return this._allEarned.size;
  },

  getEarnedInThisFlight() {
    return [...this._earned];
  }
};

// FlightHUD 자동 연동
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    FlightBadges.init();
    setTimeout(() => {
      if (typeof FlightHUD !== 'undefined') {
        // 비행 데이터 들어올 때마다 배지 체크
        const originalUpdate = FlightHUD._updateHUD.bind(FlightHUD);
        FlightHUD._updateHUD = function(data, judgment) {
          originalUpdate(data, judgment);
          FlightBadges.check(data);
        };

        // 비행 시작 시 이번 비행 배지 리셋
        const originalStart = FlightHUD.startFlight.bind(FlightHUD);
        FlightHUD.startFlight = function(scenario) {
          FlightBadges.reset();
          originalStart(scenario);
        };
      }
    }, 1300);
  });
}
