/**
 * Mock Flight Data Provider
 * SimConnect 없이 가짜 비행 데이터를 생성합니다.
 * 나중에 SimConnect 연결 시 이 파일만 교체하면 됩니다.
 *
 * 시나리오: 이륙 → 상승 → 순항 → 하강 → 착륙
 */

const EventEmitter = require('events');

// ── 서울/제주 공항 데이터 ──
const AIRPORTS = {
  RKSS: { name: '김포국제공항', lat: 37.5586, lon: 126.7906, alt: 58, rwy: '32L', rwyHdg: 321, freq: '118.60' },
  RKPC: { name: '제주국제공항', lat: 33.5114, lon: 126.4929, alt: 36, rwy: '07', rwyHdg: 73, freq: '118.00' },
  RKSI: { name: '인천국제공항', lat: 37.4691, lon: 126.4505, alt: 23, rwy: '33L', rwyHdg: 328, freq: '118.20' }
};

// ── 서울 관광지 좌표 ──
const SEOUL_POIS = [
  { name: '남산타워', lat: 37.5512, lon: 126.9882, alt: 236, desc: '서울의 상징, 높이 236m' },
  { name: '한강', lat: 37.5283, lon: 126.9346, alt: 0, desc: '서울을 가로지르는 한강' },
  { name: '롯데월드타워', lat: 37.5126, lon: 127.1026, alt: 555, desc: '높이 555m, 한국 최고층' },
  { name: '경복궁', lat: 37.5796, lon: 126.9770, alt: 0, desc: '조선 왕궁, 600년 역사' },
  { name: '동대문DDP', lat: 37.5673, lon: 127.0095, alt: 0, desc: '자하 하디드 설계 건축물' },
  { name: '북한산', lat: 37.6584, lon: 126.9780, alt: 836, desc: '서울 북쪽 국립공원' },
  { name: '여의도', lat: 37.5219, lon: 126.9245, alt: 0, desc: '국회의사당, 63빌딩' },
  { name: '잠실올림픽공원', lat: 37.5209, lon: 127.1153, alt: 0, desc: '88올림픽 기념공원' }
];

// ── 제주 관광지 좌표 ──
const JEJU_POIS = [
  { name: '한라산', lat: 33.3617, lon: 126.5292, alt: 1947, desc: '제주의 상징, 높이 1,947m' },
  { name: '성산일출봉', lat: 33.4583, lon: 126.9403, alt: 182, desc: '유네스코 세계자연유산' },
  { name: '주상절리', lat: 33.2378, lon: 126.4253, alt: 0, desc: '해안 절벽 기둥 바위' },
  { name: '천지연폭포', lat: 33.2456, lon: 126.5548, alt: 0, desc: '높이 22m 폭포' },
  { name: '우도', lat: 33.5000, lon: 126.9500, alt: 0, desc: '소가 누운 모양의 섬' },
  { name: '협재해수욕장', lat: 33.3939, lon: 126.2397, alt: 0, desc: '에메랄드빛 해변' },
  { name: '서귀포항', lat: 33.2397, lon: 126.5615, alt: 0, desc: '서귀포 중심 항구' }
];

// ── 비행 시나리오 ──
const SCENARIOS = {
  // 김포 → 서울 관광 비행
  seoul_tour: {
    departure: AIRPORTS.RKSS,
    pois: SEOUL_POIS,
    cruiseAlt: 3000,
    cruiseSpd: 120,
    duration: 25 * 60 // 25분 (초)
  },
  // 제주 관광 비행
  jeju_tour: {
    departure: AIRPORTS.RKPC,
    pois: JEJU_POIS,
    cruiseAlt: 3500,
    cruiseSpd: 130,
    duration: 30 * 60
  },
  // 기본 (훈련)
  default: {
    departure: AIRPORTS.RKSS,
    pois: SEOUL_POIS,
    cruiseAlt: 3000,
    cruiseSpd: 120,
    duration: 20 * 60
  }
};

// ── 체크리스트 데이터 ──
const CHECKLISTS = {
  preflight: [
    { id: 1, action: 'TOGGLE_MASTER_BATTERY', label: '마스터 배터리 ON', simvar: 'masterBattery', expect: true, key: 'Alt+B' },
    { id: 2, action: 'TOGGLE_AVIONICS', label: '아비오닉스 마스터 ON', simvar: 'avionicsMaster', expect: true, key: 'Alt+A' },
    { id: 3, action: 'TOGGLE_BEACON_LIGHTS', label: '비컨 라이트 ON', simvar: 'beaconLight', expect: true, key: 'Alt+H' },
    { id: 4, action: 'CHECK_FUEL', label: '연료 확인 (80% 이상)', simvar: 'fuel', expect: 80, compare: '>=' },
    { id: 5, action: 'CHECK_FLAPS', label: '플랩 0° 확인', simvar: 'flaps', expect: 0 },
    { id: 6, action: 'CHECK_PARKING_BRAKE', label: '파킹 브레이크 ON 확인', simvar: 'parkingBrake', expect: true },
    { id: 7, action: 'ENGINE_AUTO_START', label: '엔진 시동', simvar: 'engineRunning', expect: true, key: 'Ctrl+E' },
    { id: 8, action: 'CHECK_OIL', label: '오일 압력 확인 (정상)', simvar: 'oilPressure', expect: 50, compare: '>=' },
    { id: 9, action: 'TOGGLE_NAV_LIGHTS', label: 'NAV 라이트 ON', simvar: 'navLight', expect: true, key: 'Alt+N' },
    { id: 10, action: 'TOGGLE_STROBE_LIGHTS', label: '스트로브 라이트 ON', simvar: 'strobeLight', expect: true, key: 'Alt+O' }
  ],
  taxi: [
    { id: 1, action: 'RELEASE_PARKING_BRAKE', label: '파킹 브레이크 해제', simvar: 'parkingBrake', expect: false, key: 'Ctrl+.' },
    { id: 2, action: 'TOGGLE_TAXI_LIGHTS', label: '택시 라이트 ON', simvar: 'taxiLight', expect: true },
    { id: 3, action: 'CHECK_HEADING', label: '활주로 방향 확인', simvar: 'heading', expect: 'runway' }
  ],
  takeoff: [
    { id: 1, action: 'SET_FLAPS_10', label: '플랩 10° 설정', simvar: 'flaps', expect: 10 },
    { id: 2, action: 'TOGGLE_LANDING_LIGHTS', label: '랜딩 라이트 ON', simvar: 'landingLight', expect: true },
    { id: 3, action: 'THROTTLE_FULL', label: '스로틀 풀 파워', simvar: 'throttle', expect: 90, compare: '>=' },
    { id: 4, action: 'CHECK_ROTATION', label: '로테이션 (55kt에서 기수 올리기)', simvar: 'airspeed', expect: 55, compare: '>=' },
    { id: 5, action: 'POSITIVE_CLIMB', label: '양의 상승률 확인', simvar: 'verticalSpeed', expect: 100, compare: '>=' },
    { id: 6, action: 'GEAR_UP', label: '기어 올리기 (해당 시)', simvar: 'gear', expect: false, key: 'G' }
  ],
  cruise: [
    { id: 1, action: 'CHECK_ALTITUDE', label: '목표 고도 도달', simvar: 'altitude', expect: 'target' },
    { id: 2, action: 'LEVEL_FLIGHT', label: '수평 비행 전환', simvar: 'verticalSpeed', expect: 0, compare: 'near' },
    { id: 3, action: 'SET_THROTTLE_CRUISE', label: '순항 스로틀 설정', simvar: 'throttle', expect: 70, compare: 'near' },
    { id: 4, action: 'SET_FLAPS_0', label: '플랩 올리기 (0°)', simvar: 'flaps', expect: 0 }
  ],
  landing: [
    { id: 1, action: 'REDUCE_SPEED', label: '접근 속도 줄이기 (90kt)', simvar: 'airspeed', expect: 90, compare: '<=' },
    { id: 2, action: 'SET_FLAPS_10', label: '플랩 1단 (10°)', simvar: 'flaps', expect: 10 },
    { id: 3, action: 'GEAR_DOWN', label: '기어 내리기', simvar: 'gear', expect: true, key: 'G' },
    { id: 4, action: 'SET_FLAPS_FULL', label: '플랩 풀 (30°)', simvar: 'flaps', expect: 30 },
    { id: 5, action: 'TOGGLE_LANDING_LIGHTS', label: '랜딩 라이트 ON', simvar: 'landingLight', expect: true },
    { id: 6, action: 'CHECK_GLIDESLOPE', label: '글라이드슬로프 유지 (-500fpm)', simvar: 'verticalSpeed', expect: -700, compare: '>=' },
    { id: 7, action: 'FLARE', label: '플레어 (기수 살짝 올리기)', simvar: 'pitch', expect: 3, compare: '>=' },
    { id: 8, action: 'TOUCHDOWN', label: '터치다운!', simvar: 'onGround', expect: true },
    { id: 9, action: 'BRAKE', label: '브레이크 + 스로틀 아이들', simvar: 'airspeed', expect: 30, compare: '<=' },
    { id: 10, action: 'SET_PARKING_BRAKE', label: '파킹 브레이크 ON', simvar: 'parkingBrake', expect: true }
  ]
};

class MockFlightProvider extends EventEmitter {
  constructor() {
    super();
    this._intervalId = null;
    this._demoIntervalId = null;
    this._flightTime = 0;
    this._scenario = null;
    this._phase = 'parked'; // parked, taxi, takeoff, climb, cruise, descent, approach, landing, landed
    this._recording = []; // 비행 기록 (리포트용)

    // 비행기 상태
    this._state = this._getInitialState();
  }

  _getInitialState() {
    return {
      // 위치
      altitude: 0,
      altitudeAGL: 0,
      airspeed: 0,
      groundSpeed: 0,
      heading: 321,
      verticalSpeed: 0,
      latitude: 37.5586,
      longitude: 126.7906,
      pitch: 0,
      bank: 0,

      // 엔진
      engineRunning: false,
      engineRPM: 0,
      throttle: 0,
      fuel: 100,
      oilPressure: 0,

      // 조종면
      flaps: 0,
      gear: true,
      spoilers: false,

      // 시스템
      masterBattery: false,
      avionicsMaster: false,
      parkingBrake: true,

      // 라이트
      navLight: false,
      beaconLight: false,
      strobeLight: false,
      landingLight: false,
      taxiLight: false,

      // 오토파일럿
      autopilotMaster: false,
      autopilotHeading: 0,
      autopilotAltitude: 3000,

      // 비행 상태
      onGround: true,
      phase: 'parked',
      flightTime: 0,

      // 근처 관광지
      nearbyPOI: null
    };
  }

  startFlight(scenarioName = 'default', autoFly = true) {
    this._scenario = SCENARIOS[scenarioName] || SCENARIOS.default;
    this._state = this._getInitialState();
    this._state.heading = this._scenario.departure.rwyHdg;
    this._state.latitude = this._scenario.departure.lat;
    this._state.longitude = this._scenario.departure.lon;
    this._flightTime = 0;
    this._recording = [];
    this._phase = 'parked';
    this._autoFly = autoFly;

    // 자동 비행 모드: 준비 상태로 시작 (엔진 켜짐, 플랩 10도, 브레이크 해제)
    if (autoFly) {
      this._state.masterBattery = true;
      this._state.avionicsMaster = true;
      this._state.beaconLight = true;
      this._state.navLight = true;
      this._state.strobeLight = true;
      this._state.engineRunning = true;
      this._state.engineRPM = 800;
      this._state.oilPressure = 60;
      this._state.flaps = 10;
      this._state.parkingBrake = false;
      this._phase = 'ready';
    }

    // 0.5초마다 데이터 업데이트
    if (this._intervalId) clearInterval(this._intervalId);
    this._intervalId = setInterval(() => {
      // 자동 비행: AI 파일럿 시뮬레이션
      if (this._autoFly) this._autoFlyStep();
      this._update();
      this._flightTime += 0.5;
      this._state.flightTime = this._flightTime;
      this._state.phase = this._phase;

      // 5초마다 비행 기록 저장
      if (Math.floor(this._flightTime) % 5 === 0) {
        this._recording.push({ ...this._state, time: this._flightTime });
      }

      this.emit('data', { ...this._state });
    }, 500);

    console.log(`[Flight] 비행 시작: ${scenarioName} (autoFly: ${autoFly})`);
  }

  // ── 자동 비행 시뮬레이션 (AI 파일럿 역할) ──
  _autoFlyStep() {
    const s = this._state;
    const t = this._flightTime;

    // 0~3초: 정지 (ready 상태)
    if (t < 3) {
      s.throttle = 0;
      return;
    }

    // 3~15초: 택싱 (스로틀 20%, 속도 5~15kt)
    if (t < 15) {
      s.throttle = 20;
      this._phase = 'taxi';
      return;
    }

    // 15~45초: 이륙 롤 (스로틀 100%, 속도 증가)
    if (t < 45) {
      s.throttle = 100;
      // 55kt 넘으면 자동 이륙
      if (s.airspeed >= 55 && s.onGround) {
        s.pitch = 7;
      }
      return;
    }

    // 45~90초: 상승 (목표 고도까지)
    if (t < 90) {
      s.throttle = 85;
      if (s.altitude < (this._scenario?.cruiseAlt || 3000) - 100) {
        s.pitch = 5; // 상승 자세 유지
      } else {
        s.pitch = 0; // 수평 전환
      }
      return;
    }

    // 90~600초: 순항 (AI 파일럿 OFF, 사용자가 조종)
    if (t < 600) {
      // 수평 비행 유지 (최소한의 보조)
      if (s.altitude < (this._scenario?.cruiseAlt || 3000) - 200) s.pitch = 1;
      else if (s.altitude > (this._scenario?.cruiseAlt || 3000) + 200) s.pitch = -1;
      else s.pitch *= 0.9;
      s.throttle = 70;
      return;
    }

    // 600~660초: 하강
    if (t < 660) {
      s.throttle = 40;
      s.pitch = -3;
      this._phase = 'descent';
      return;
    }

    // 660~720초: 접근
    if (t < 720) {
      s.throttle = 30;
      s.pitch = -2;
      if (s.flaps < 30) s.flaps = 30;
      return;
    }

    // 720초+: 착륙
    if (s.altitude > 0) {
      s.throttle = 15;
      s.pitch = -1;
    } else {
      s.throttle = 0;
      this._phase = 'landed';
    }
  }

  stopFlight() {
    if (this._intervalId) {
      clearInterval(this._intervalId);
      this._intervalId = null;
    }
    this.stopDemo();
    console.log('[Flight] 비행 종료');
    return this._recording;
  }

  // 시범 모드: 코코가 자동으로 조작
  startDemo(procedure = 'preflight') {
    const checklist = CHECKLISTS[procedure];
    if (!checklist) return;

    let step = 0;
    this.stopDemo();

    this._demoIntervalId = setInterval(() => {
      if (step >= checklist.length) {
        this.stopDemo();
        this.emit('data', { ...this._state, demoComplete: true, demoProcedure: procedure });
        return;
      }

      const item = checklist[step];
      // 자동으로 명령 실행
      this.sendCommand(item.action, item.expect);

      // 시범 단계 이벤트 발생
      this.emit('data', {
        ...this._state,
        demoStep: step + 1,
        demoTotal: checklist.length,
        demoAction: item.label,
        demoKey: item.key || null,
        demoProcedure: procedure
      });

      step++;
    }, 3000); // 3초 간격으로 하나씩

    console.log(`[Demo] 시범 시작: ${procedure}`);
  }

  stopDemo() {
    if (this._demoIntervalId) {
      clearInterval(this._demoIntervalId);
      this._demoIntervalId = null;
    }
  }

  getChecklist(phase) {
    return CHECKLISTS[phase] || [];
  }

  getRecording() {
    return this._recording;
  }

  sendCommand(eventName, value) {
    const s = this._state;

    switch (eventName) {
      case 'TOGGLE_MASTER_BATTERY':
        s.masterBattery = value !== undefined ? !!value : !s.masterBattery;
        break;
      case 'TOGGLE_AVIONICS':
        s.avionicsMaster = value !== undefined ? !!value : !s.avionicsMaster;
        break;
      case 'ENGINE_AUTO_START':
        if (s.masterBattery) {
          s.engineRunning = true;
          s.engineRPM = 800;
          s.oilPressure = 65;
        }
        break;
      case 'ENGINE_AUTO_SHUTDOWN':
        s.engineRunning = false;
        s.engineRPM = 0;
        s.oilPressure = 0;
        break;
      case 'TOGGLE_BEACON_LIGHTS': s.beaconLight = value !== undefined ? !!value : !s.beaconLight; break;
      case 'TOGGLE_NAV_LIGHTS': s.navLight = value !== undefined ? !!value : !s.navLight; break;
      case 'TOGGLE_STROBE_LIGHTS': s.strobeLight = value !== undefined ? !!value : !s.strobeLight; break;
      case 'TOGGLE_LANDING_LIGHTS': s.landingLight = value !== undefined ? !!value : !s.landingLight; break;
      case 'TOGGLE_TAXI_LIGHTS': s.taxiLight = value !== undefined ? !!value : !s.taxiLight; break;
      case 'RELEASE_PARKING_BRAKE':
      case 'SET_PARKING_BRAKE':
        s.parkingBrake = eventName === 'SET_PARKING_BRAKE';
        break;
      case 'TOGGLE_PARKING_BRAKE': s.parkingBrake = !s.parkingBrake; break;
      case 'GEAR_UP': s.gear = false; break;
      case 'GEAR_DOWN': s.gear = true; break;
      case 'GEAR_TOGGLE': s.gear = !s.gear; break;
      case 'SET_FLAPS_0': s.flaps = 0; break;
      case 'SET_FLAPS_10': s.flaps = 10; break;
      case 'SET_FLAPS_20': s.flaps = 20; break;
      case 'SET_FLAPS_FULL': s.flaps = 30; break;
      case 'FLAPS_DOWN': s.flaps = Math.min(s.flaps + 10, 30); break;
      case 'FLAPS_UP': s.flaps = Math.max(s.flaps - 10, 0); break;
      case 'THROTTLE_SET': s.throttle = Math.max(0, Math.min(100, value || 0)); break;
      case 'THROTTLE_FULL': s.throttle = 100; break;
      case 'THROTTLE_IDLE': s.throttle = 0; break;
      case 'AP_MASTER': s.autopilotMaster = !s.autopilotMaster; break;
      case 'AP_HDG_SET': s.autopilotHeading = value || 0; break;
      case 'AP_ALT_SET': s.autopilotAltitude = value || 3000; break;
      case 'CHECK_FUEL':
      case 'CHECK_OIL':
      case 'CHECK_FLAPS':
      case 'CHECK_PARKING_BRAKE':
      case 'CHECK_HEADING':
      case 'CHECK_ALTITUDE':
      case 'CHECK_ROTATION':
      case 'CHECK_GLIDESLOPE':
      case 'LEVEL_FLIGHT':
      case 'SET_THROTTLE_CRUISE':
      case 'POSITIVE_CLIMB':
      case 'REDUCE_SPEED':
      case 'FLARE':
      case 'TOUCHDOWN':
      case 'BRAKE':
        // 확인/점검 항목은 상태 변경 없음
        break;
    }

    return { success: true, event: eventName, state: eventName };
  }

  // ── 물리 시뮬레이션 (간단 버전) ──
  _update() {
    const s = this._state;
    const dt = 0.5; // 0.5초 간격

    // 엔진이 돌고 있으면
    if (s.engineRunning) {
      s.engineRPM = 800 + (s.throttle / 100) * 1700; // 800~2500 RPM
      s.fuel = Math.max(0, s.fuel - (s.throttle / 100) * 0.005); // 연료 소모
      s.oilPressure = 55 + Math.random() * 10;
    }

    // 지상에서
    if (s.onGround) {
      // 파킹 브레이크가 풀리고 엔진이 돌면 가속
      if (!s.parkingBrake && s.engineRunning) {
        const thrust = (s.throttle / 100) * 2.0;
        const drag = s.airspeed * 0.01;
        s.airspeed = Math.max(0, s.airspeed + (thrust - drag) * dt);
        s.groundSpeed = s.airspeed;
      } else {
        s.airspeed = Math.max(0, s.airspeed - 0.5 * dt);
        s.groundSpeed = s.airspeed;
      }

      // 이륙 판정 (55kt 이상 + 피치 양수)
      if (s.airspeed >= 55 && s.throttle >= 80) {
        s.pitch = Math.min(s.pitch + 0.5, 10);
        if (s.pitch >= 5) {
          s.onGround = false;
          s.verticalSpeed = 500;
          this._phase = 'takeoff';
          console.log('[Flight] 이륙!');
        }
      }

      // 비행 단계 판정 (지상)
      if (s.onGround) {
        if (s.airspeed > 5) {
          this._phase = 'taxi';
        } else if (s.engineRunning) {
          this._phase = 'ready';
        } else {
          this._phase = 'parked';
        }
      }
    }
    // 공중에서
    else {
      // 추력 vs 항력
      const thrust = s.engineRunning ? (s.throttle / 100) * 1.5 : 0;
      const drag = s.airspeed * 0.008 + (s.flaps / 30) * 0.3;
      s.airspeed = Math.max(30, s.airspeed + (thrust - drag) * dt);
      s.groundSpeed = s.airspeed;

      // 상승/하강
      if (s.pitch > 2) {
        s.verticalSpeed = Math.min(s.verticalSpeed + 20, 2000);
      } else if (s.pitch < -2) {
        s.verticalSpeed = Math.max(s.verticalSpeed - 20, -2000);
      } else {
        // 수평 비행으로 수렴
        s.verticalSpeed *= 0.95;
      }

      // 고도 변화
      s.altitude += (s.verticalSpeed / 60) * dt;
      s.altitudeAGL = s.altitude;

      // 착륙 판정
      if (s.altitude <= 0) {
        s.altitude = 0;
        s.altitudeAGL = 0;
        s.onGround = true;
        s.verticalSpeed = 0;
        this._phase = 'landed';
        console.log(`[Flight] 착륙! 터치다운 속도: ${Math.abs(s.verticalSpeed).toFixed(0)} fpm`);
      }

      // 위치 이동 (간단한 위경도 변화)
      const spdKmh = s.groundSpeed * 1.852; // kt → km/h
      const hdgRad = (s.heading * Math.PI) / 180;
      s.latitude += (Math.cos(hdgRad) * spdKmh / 111000) * dt;
      s.longitude += (Math.sin(hdgRad) * spdKmh / (111000 * Math.cos(s.latitude * Math.PI / 180))) * dt;

      // 뱅크(선회) 처리
      if (Math.abs(s.bank) > 2) {
        const turnRate = s.bank * 0.05;
        s.heading = (s.heading + turnRate * dt + 360) % 360;
      }

      // 비행 단계 자동 판정
      if (s.verticalSpeed > 200) {
        this._phase = 'climb';
      } else if (s.verticalSpeed < -200) {
        this._phase = s.altitude < 1000 ? 'approach' : 'descent';
      } else if (s.altitude >= (this._scenario?.cruiseAlt || 3000) * 0.9) {
        this._phase = 'cruise';
      }

      // 근처 관광지 확인
      s.nearbyPOI = this._checkNearbyPOI();
    }
  }

  // 근처 관광지 확인 (2km 이내)
  _checkNearbyPOI() {
    if (!this._scenario) return null;
    const s = this._state;

    for (const poi of this._scenario.pois) {
      const dist = this._distanceKm(s.latitude, s.longitude, poi.lat, poi.lon);
      if (dist < 2) {
        return { ...poi, distance: dist };
      }
    }
    return null;
  }

  // 두 좌표 사이 거리 (km)
  _distanceKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
}

module.exports = { MockFlightProvider, AIRPORTS, CHECKLISTS, SEOUL_POIS, JEJU_POIS };
