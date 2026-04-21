/**
 * ═══════════════════════════════════════════════════════════════════
 *  CockpitOS — SimConnect Provider (MSFS 연동)
 * ═══════════════════════════════════════════════════════════════════
 *
 * 이 파일의 역할:
 *   - MSFS와 실시간 데이터 교환 (node-simconnect 사용)
 *   - 비행 데이터 읽기 (고도, 속도, 위치 등)
 *   - 명령 전송 (스위치 조작, 카메라 이동 등)
 *   - AI 파일럿 제어 (Alt+A 자동 입력)
 *
 * 설계 원칙:
 *   - MockFlightProvider와 100% 동일 인터페이스
 *   - 기존 코드 수정 없이 교체 가능
 *   - MSFS 구매 전: MockFlightProvider 사용
 *   - MSFS 구매 후: SimConnectProvider로 교체
 *
 * 현재 상태:
 *   - 구조만 완성 (실제 SimConnect 호출 부분은 TODO)
 *   - MSFS 구매하면 TODO 부분만 구현하면 됨
 *
 * ═══════════════════════════════════════════════════════════════════
 *
 *  미래 개발자가 해야 할 일:
 *
 *  1. SimConnect SDK 설치:
 *     - MSFS SDK 다운로드 (무료)
 *     - https://docs.flightsimulator.com/html/index.htm
 *
 *  2. node-simconnect 설치:
 *     cd server
 *     npm install node-simconnect
 *
 *  3. 이 파일의 TODO 부분 구현:
 *     - connect()
 *     - _startDataSubscription()
 *     - sendCommand()
 *     - setCamera()
 *     - activateAIPilot()
 *
 *  4. 테스트:
 *     - MSFS 실행
 *     - 이 파일이 Mock 대신 사용되도록 index.js 수정:
 *         const { SimConnectProvider } = require('./simconnect-provider');
 *         const flightProvider = new SimConnectProvider();
 *
 *  5. 기존 코드는 수정 불필요:
 *     - flight-hud.js, flight-map.js 등 그대로 작동
 *     - MockFlightProvider와 이벤트/메서드 이름 동일하므로
 *
 * ═══════════════════════════════════════════════════════════════════
 */

const EventEmitter = require('events');

// TODO: MSFS 구매 후 주석 해제
// const { open, Protocol, SimConnectDataType, SimObjectType } = require('node-simconnect');

/**
 * SimConnect 변수 정의
 *
 * 자주 사용하는 SimConnect 변수들:
 * https://docs.flightsimulator.com/html/Programming_Tools/SimVars/Simulation_Variables.htm
 */
const SIMVARS = {
  // 위치/자세
  PLANE_LATITUDE:        { unit: 'degrees', type: 'FLOAT64' },
  PLANE_LONGITUDE:       { unit: 'degrees', type: 'FLOAT64' },
  PLANE_ALTITUDE:        { unit: 'feet', type: 'FLOAT64' },
  PLANE_HEADING_DEGREES_MAGNETIC: { unit: 'degrees', type: 'FLOAT64' },
  PLANE_PITCH_DEGREES:   { unit: 'degrees', type: 'FLOAT64' },
  PLANE_BANK_DEGREES:    { unit: 'degrees', type: 'FLOAT64' },

  // 속도
  AIRSPEED_INDICATED:    { unit: 'knots', type: 'FLOAT64' },
  GROUND_VELOCITY:       { unit: 'knots', type: 'FLOAT64' },
  VERTICAL_SPEED:        { unit: 'feet per minute', type: 'FLOAT64' },

  // 엔진
  ENG_N1_RPM_1:          { unit: 'percent', type: 'FLOAT64' },
  GENERAL_ENG_THROTTLE_LEVER_POSITION_1: { unit: 'percent', type: 'FLOAT64' },
  FUEL_TOTAL_QUANTITY_WEIGHT: { unit: 'pounds', type: 'FLOAT64' },

  // 조종면
  FLAPS_HANDLE_PERCENT:  { unit: 'percent', type: 'FLOAT64' },
  GEAR_HANDLE_POSITION:  { unit: 'bool', type: 'INT32' },

  // 상태
  SIM_ON_GROUND:         { unit: 'bool', type: 'INT32' },
  PLANE_IN_PARKING_STATE:{ unit: 'bool', type: 'INT32' },
};

/**
 * SimConnect 명령 이벤트 (SimEvents)
 *
 * SimConnect 이벤트 이름들 (MSFS에 전송):
 * https://docs.flightsimulator.com/html/Programming_Tools/Event_IDs/Event_IDs.htm
 */
const SIM_EVENTS = {
  TOGGLE_MASTER_BATTERY:  'TOGGLE_MASTER_BATTERY',
  TOGGLE_AVIONICS_MASTER: 'TOGGLE_AVIONICS_MASTER',
  ENGINE_AUTO_START:      'ENGINE_AUTO_START',
  ENGINE_AUTO_SHUTDOWN:   'ENGINE_AUTO_SHUTDOWN',
  TOGGLE_BEACON_LIGHTS:   'TOGGLE_BEACON_LIGHTS',
  TOGGLE_NAV_LIGHTS:      'TOGGLE_NAV_LIGHTS',
  TOGGLE_STROBES:         'STROBES_TOGGLE',
  LANDING_LIGHTS_TOGGLE:  'LANDING_LIGHTS_TOGGLE',
  PARKING_BRAKES:         'PARKING_BRAKES',
  GEAR_UP:                'GEAR_UP',
  GEAR_DOWN:              'GEAR_DOWN',
  FLAPS_UP:               'FLAPS_UP',
  FLAPS_1:                'FLAPS_1',
  FLAPS_2:                'FLAPS_2',
  FLAPS_DOWN:             'FLAPS_DOWN',
  THROTTLE_SET:           'THROTTLE_SET', // 값 전달
  THROTTLE_FULL:          'THROTTLE_FULL',
  THROTTLE_CUT:           'THROTTLE_CUT',

  // 시뮬 제어
  SIM_RESET:              'SITUATION_RESET',
  PAUSE_ON:               'PAUSE_ON',
  PAUSE_OFF:              'PAUSE_OFF',

  // AI Pilot 관련
  // 주의: Alt+A는 단축키라 SimConnect 이벤트가 아님
  // → RobotJS 같은 키보드 시뮬레이션 필요
  // 또는 MSFS 2024의 새 API 확인
};

/**
 * SimConnectProvider 클래스
 *
 * MockFlightProvider와 동일한 인터페이스:
 *   - startFlight(scenario)
 *   - stopFlight()
 *   - sendCommand(event, value)
 *   - getChecklist(phase)
 *   - getRecording()
 *   - emit('data', state)
 *   - setSpeedMultiplier(mult)
 *   - rewindTo(type)
 */
class SimConnectProvider extends EventEmitter {
  constructor() {
    super();
    this._handle = null;           // SimConnect 연결 핸들
    this._dataRequestId = 1;
    this._state = this._getInitialState();
    this._dataInterval = null;
    this._connected = false;
    this._recording = [];

    // Mock 모드 (MSFS 없이 테스트)
    this._mockMode = true; // TODO: MSFS 있으면 false
  }

  /**
   * SimConnect에 연결
   *
   * TODO (미래 개발자):
   *   1. node-simconnect 설치
   *   2. 아래 코드 활성화:
   *
   *   async connect() {
   *     try {
   *       const { recvOpen, handle } = await open('CockpitOS', Protocol.KittyHawk);
   *       this._handle = handle;
   *       this._connected = true;
   *       this._registerDataDefinitions();
   *       this._subscribeToEvents();
   *       return true;
   *     } catch (err) {
   *       console.error('[SimConnect] 연결 실패:', err);
   *       return false;
   *     }
   *   }
   */
  async connect() {
    if (this._mockMode) {
      this._connected = true;
      console.log('[SimConnect] Mock 연결 성공');
      return true;
    }

    // TODO: 실제 SimConnect 연결
    throw new Error('SimConnect not implemented — install node-simconnect');
  }

  /**
   * 데이터 정의 등록 (우리가 받을 변수들)
   *
   * TODO (미래 개발자):
   *   - SIMVARS의 각 변수를 SimConnect에 등록
   *   - 예:
   *     handle.addToDataDefinition(
   *       dataDefId,
   *       'PLANE_LATITUDE',
   *       'degrees',
   *       SimConnectDataType.FLOAT64
   *     );
   */
  _registerDataDefinitions() {
    // TODO: 실제 구현
  }

  /**
   * 데이터 구독 시작 (매 프레임 또는 매 초)
   *
   * TODO (미래 개발자):
   *   handle.requestDataOnSimObject(
   *     this._dataRequestId,
   *     this._dataDefId,
   *     SimConnectConstants.OBJECT_ID_USER,
   *     SimConnectPeriod.SIM_FRAME
   *   );
   *
   *   handle.on('simObjectData', data => {
   *     this._state = this._parseFlightData(data);
   *     this.emit('data', this._state);
   *   });
   */
  _startDataSubscription() {
    if (this._mockMode) {
      // Mock: 0.5초마다 임의 데이터
      this._dataInterval = setInterval(() => {
        this._state.flightTime += 0.5;
        this.emit('data', { ...this._state });
      }, 500);
    }
    // TODO: 실제 SimConnect 구독
  }

  /**
   * 비행 시작
   *
   * 실제 MSFS에서 이루어지는 일:
   *   1. 공항/비행기/날씨 설정 (별도 파일 로드)
   *   2. 비행 계획(.pln) 로드
   *   3. AI 파일럿 활성화 (선택)
   *   4. 데이터 구독 시작
   */
  async startFlight(scenarioName = 'default') {
    if (!this._connected) await this.connect();

    // TODO (미래 개발자):
    //   - 비행 계획 로드
    //     await this._loadFlightPlan(`scenarios/${scenarioName}.pln`);
    //   - 공항/비행기 설정
    //     await this._setAirport('RKSS');
    //     await this._setAircraft('Cessna 172');
    //   - 날씨 설정
    //     await this._setWeather('clear');
    //   - AI 파일럿 활성화
    //     await this.activateAIPilot();

    this._startDataSubscription();
    console.log(`[SimConnect] 비행 시작: ${scenarioName}`);
  }

  /**
   * 비행 종료
   */
  stopFlight() {
    if (this._dataInterval) {
      clearInterval(this._dataInterval);
      this._dataInterval = null;
    }
    return this._recording;
  }

  /**
   * SimConnect 명령 전송
   *
   * TODO (미래 개발자):
   *   sendCommand(eventName, value) {
   *     const eventId = SIM_EVENTS[eventName];
   *     if (!eventId) return;
   *     this._handle.transmitClientEvent(
   *       SimConnectConstants.OBJECT_ID_USER,
   *       eventId,
   *       value || 0,
   *       SimConnectConstants.GROUP_PRIORITY_HIGHEST,
   *       SimConnectConstants.EVENT_FLAG_GROUPID_IS_PRIORITY
   *     );
   *   }
   */
  sendCommand(eventName, value) {
    if (this._mockMode) {
      console.log(`[SimConnect Mock] 명령: ${eventName} = ${value}`);
      return { success: true, event: eventName };
    }
    // TODO: 실제 구현
    return { success: false };
  }

  /**
   * AI 파일럿 활성화 (Alt+A 자동 입력)
   *
   * TODO (미래 개발자):
   *   SimConnect에는 AI Pilot 이벤트가 없을 수 있음.
   *   키보드 시뮬레이션으로 Alt+A 입력:
   *
   *   const robot = require('robotjs');
   *   async activateAIPilot() {
   *     robot.keyToggle('alt', 'down');
   *     robot.keyTap('a');
   *     robot.keyToggle('alt', 'up');
   *   }
   *
   *   또는 MSFS 2024의 새 API 확인:
   *   https://docs.flightsimulator.com/msfs2024/
   */
  async activateAIPilot() {
    if (this._mockMode) {
      console.log('[SimConnect Mock] AI 파일럿 활성화 (Alt+A)');
      return;
    }
    // TODO: robotjs 설치 후 구현
  }

  /**
   * AI 파일럿 비활성화 (다시 Alt+A)
   */
  async deactivateAIPilot() {
    return this.activateAIPilot(); // 토글이므로 같음
  }

  /**
   * 카메라 이동 (스위치 클로즈업용)
   *
   * 용도: "마스터 배터리 스위치" 근처로 카메라 자동 이동
   *       게스트가 큰 화면에서 스위치 위치 직접 봄
   *
   * TODO (미래 개발자):
   *   MSFS의 카메라 제어는 복잡함:
   *   - SimConnect_SetCameraDefinition6DOF (SDK 함수)
   *   - 또는 뷰 이벤트 전송 (VIEW_COCKPIT_FORWARD 등)
   *
   *   async setCamera(x, y, z, pitch, heading, bank) {
   *     this._handle.setDataOnSimObject(...);
   *   }
   */
  async setCamera(x, y, z, pitch = 0, heading = 0, bank = 0) {
    if (this._mockMode) {
      console.log(`[SimConnect Mock] 카메라 이동: x=${x}, y=${y}, z=${z}`);
      return;
    }
    // TODO: 실제 구현
  }

  /**
   * 비행 계획 로드 (.pln 파일)
   *
   * TODO (미래 개발자):
   *   - .pln 파일은 MSFS의 비행 계획 XML
   *   - scenarios/ 폴더에 미리 만들어둠
   *   - SimConnect로 로드하는 API 호출
   */
  async loadFlightPlan(path) {
    if (this._mockMode) return;
    // TODO
  }

  /**
   * 공항 설정 (비행기 재배치)
   */
  async setAirport(icaoCode) {
    if (this._mockMode) return;
    // TODO
  }

  /**
   * 속도 배율 조절 (R키 자동 입력)
   *
   * MSFS 단축키:
   *   R = 시간 가속 (1x→2x→4x→8x→16x 순환)
   *   Shift+R = 시간 감속
   */
  setSpeedMultiplier(mult) {
    if (this._mockMode) {
      console.log(`[SimConnect Mock] 속도: ${mult}x`);
      return;
    }
    // TODO: robotjs로 R키 여러 번 입력
  }

  /**
   * 되돌리기 (위치 리셋)
   *
   * TODO (미래 개발자):
   *   타입별 처리:
   *   - 'runway': 활주로 시작점으로
   *   - 'air':    이륙 직후 공중
   *   - 'approach': 착륙 접근 위치
   *
   *   방법 1: SITUATION_RESET 이벤트
   *   방법 2: setDataOnSimObject로 위도/경도/고도 직접 설정
   */
  rewindTo(type) {
    if (this._mockMode) {
      console.log(`[SimConnect Mock] 되돌리기: ${type}`);
      return;
    }
    // TODO
  }

  /**
   * 데모 모드 (코코가 자동 조작)
   */
  startDemo(procedure) {
    // TODO
  }

  stopDemo() {
    // TODO
  }

  getChecklist(phase) {
    // Mock과 같은 체크리스트 반환
    return [];
  }

  getRecording() {
    return this._recording;
  }

  _getInitialState() {
    return {
      altitude: 0, airspeed: 0, heading: 0, verticalSpeed: 0,
      latitude: 37.5586, longitude: 126.7906,
      pitch: 0, bank: 0,
      engineRunning: false, throttle: 0, fuel: 100,
      flaps: 0, gear: true,
      onGround: true, phase: 'parked', flightTime: 0,
      nearbyPOI: null
    };
  }

  isConnected() {
    return this._connected;
  }
}

module.exports = { SimConnectProvider, SIMVARS, SIM_EVENTS };
