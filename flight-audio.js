/**
 * CockpitOS — 비행 사운드 시스템
 * 비행 단계별 배경음악, 효과음, 이벤트 사운드
 * 사운드 파일은 나중에 추가 (지금은 구조만)
 */

const FlightAudio = {
  _currentBGM: null,      // 현재 재생 중인 배경음악
  _bgmVolume: 0.3,         // 배경음악 볼륨 (0~1)
  _sfxVolume: 0.7,         // 효과음 볼륨
  _muted: false,
  _lastPhase: null,

  // ── 사운드 파일 경로 (나중에 실제 파일 추가) ──
  files: {
    // 비행 단계별 배경음악
    phase: {
      parked:   'audio/ambient_ground.mp3',
      ready:    'audio/ambient_ground.mp3',
      taxi:     'audio/engine_taxi.mp3',
      takeoff:  'audio/takeoff_theme.mp3',
      climb:    'audio/climbing.mp3',
      cruise:   'audio/cruise_ambient.mp3',
      descent:  'audio/descent.mp3',
      approach: 'audio/approach.mp3',
      landing:  'audio/landing_tension.mp3',
      landed:   'audio/landed_victory.mp3'
    },

    // 관광지 테마
    poi: {
      seoul:    'audio/seoul_theme.mp3',
      jeju:     'audio/jeju_theme.mp3',
      tokyo:    'audio/tokyo_theme.mp3',
      default:  'audio/tourist_generic.mp3'
    },

    // 이벤트 효과음
    events: {
      takeoffSuccess: 'audio/sfx_ding.mp3',
      landedSoft:     'audio/sfx_applause.mp3',
      landedHard:     'audio/sfx_warning.mp3',
      badgeEarned:    'audio/sfx_achievement.mp3',
      warning:        'audio/sfx_alert.mp3',
      danger:         'audio/sfx_danger.mp3',
      poiNearby:      'audio/sfx_chime.mp3',
      buttonClick:    'audio/sfx_click.mp3'
    }
  },

  // ── 초기화 ──
  init() {
    // localStorage에서 설정 로드
    const savedMuted = localStorage.getItem('cpos_audio_muted');
    const savedBgmVol = localStorage.getItem('cpos_bgm_volume');
    const savedSfxVol = localStorage.getItem('cpos_sfx_volume');
    if (savedMuted) this._muted = savedMuted === 'true';
    if (savedBgmVol) this._bgmVolume = parseFloat(savedBgmVol);
    if (savedSfxVol) this._sfxVolume = parseFloat(savedSfxVol);
  },

  // ── 배경음악 재생 ──
  playBGM(key) {
    if (this._muted) return;
    const file = this.files.phase[key] || this.files.poi[key];
    if (!file) return;

    // 파일이 없으면 조용히 실패 (지금은 파일 없음)
    this._fadeOutBGM(() => {
      try {
        const audio = new Audio(file);
        audio.loop = true;
        audio.volume = this._bgmVolume;
        audio.play().catch(e => {
          // 파일 없거나 재생 실패 — 무시
          console.log('[Audio] BGM not available:', file);
        });
        this._currentBGM = audio;
      } catch(e) {
        // 파일 없음 — 무시
      }
    });
  },

  // ── 효과음 재생 ──
  playSFX(key) {
    if (this._muted) return;
    const file = this.files.events[key];
    if (!file) return;

    try {
      const audio = new Audio(file);
      audio.volume = this._sfxVolume;
      audio.play().catch(e => {
        // 파일 없음 — 무시
        console.log('[Audio] SFX not available:', file);
      });
    } catch(e) {
      // 무시
    }
  },

  // ── 단계 변경에 따른 자동 BGM 전환 ──
  onPhaseChange(phase) {
    if (phase === this._lastPhase) return;
    this._lastPhase = phase;
    this.playBGM(phase);

    // 특별 이벤트 효과음
    if (phase === 'takeoff') this.playSFX('takeoffSuccess');
    if (phase === 'landed') this.playSFX('landedSoft');
  },

  // ── 부드러운 페이드 아웃 ──
  _fadeOutBGM(callback) {
    if (!this._currentBGM) {
      if (callback) callback();
      return;
    }
    const audio = this._currentBGM;
    const step = 0.05;
    const interval = setInterval(() => {
      if (audio.volume > step) {
        audio.volume -= step;
      } else {
        audio.pause();
        audio.src = '';
        clearInterval(interval);
        if (callback) callback();
      }
    }, 50);
  },

  // ── 모두 정지 ──
  stopAll() {
    if (this._currentBGM) {
      this._currentBGM.pause();
      this._currentBGM = null;
    }
    this._lastPhase = null;
  },

  // ── 음소거 토글 ──
  toggleMute() {
    this._muted = !this._muted;
    localStorage.setItem('cpos_audio_muted', this._muted);
    if (this._muted) this.stopAll();
    return this._muted;
  },

  // ── 볼륨 조절 ──
  setBGMVolume(v) {
    this._bgmVolume = Math.max(0, Math.min(1, v));
    localStorage.setItem('cpos_bgm_volume', this._bgmVolume);
    if (this._currentBGM) this._currentBGM.volume = this._bgmVolume;
  },

  setSFXVolume(v) {
    this._sfxVolume = Math.max(0, Math.min(1, v));
    localStorage.setItem('cpos_sfx_volume', this._sfxVolume);
  }
};

// FlightHUD와 자동 연동
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    FlightAudio.init();
    setTimeout(() => {
      if (typeof FlightHUD !== 'undefined') {
        // 비행 단계 바뀔 때 BGM 자동 전환
        const originalUpdate = FlightHUD._updateHUD.bind(FlightHUD);
        FlightHUD._updateHUD = function(data, judgment) {
          originalUpdate(data, judgment);
          if (data && data.phase && FlightHUD.flightActive) {
            FlightAudio.onPhaseChange(data.phase);
          }
        };

        // 비행 종료 시 사운드 정지
        const originalStop = FlightHUD.stopFlight.bind(FlightHUD);
        FlightHUD.stopFlight = function() {
          originalStop();
          FlightAudio.stopAll();
        };
      }
    }, 1200);
  });
}
