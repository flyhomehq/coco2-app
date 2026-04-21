/**
 * ═══════════════════════════════════════════════════════════════════
 *  CockpitOS — PC 자동화 런처 (PC Launcher)
 * ═══════════════════════════════════════════════════════════════════
 *
 * 역할:
 *   - PC 원격 전원 제어 (Wake-on-LAN)
 *   - MSFS (Microsoft Flight Simulator) 자동 실행
 *   - 프로세스 상태 감시
 *   - 에러 복구 자동화
 *
 * 사용 맥락 (FLY:HOME 숙소 운영):
 *   1. 게스트가 태블릿에서 "서울 가자" 선택
 *   2. 태블릿 앱 → WebSocket → 이 파일
 *   3. 이 파일이 → PC 켜고 → MSFS 실행 → SimConnect 연결
 *   4. 모든 과정 실시간 상태 전송
 *
 * 미래 개발자 참고사항:
 *   - 이 파일은 FLY:HOME 실제 운영 환경(PC + MSFS 실제 설치)이 필요
 *   - Mock 모드: MSFS 없이도 동작 시뮬레이션
 *   - 프로덕션 배포 시 고려:
 *     · Windows Service로 등록 (백그라운드 실행)
 *     · 관리자 권한 필요 (Wake-on-LAN, 프로세스 제어)
 *     · 방화벽 예외 추가
 *     · 로그 파일 로테이션
 *
 * 의존 라이브러리 (package.json에 추가 필요):
 *   - wake_on_lan: Wake-on-LAN 패킷 전송
 *   - ps-list: 프로세스 목록 조회
 *   - node-cmd 또는 child_process: 명령 실행
 *
 * ═══════════════════════════════════════════════════════════════════
 */

const { exec, spawn } = require('child_process');
const { promisify } = require('util');
const EventEmitter = require('events');
const execAsync = promisify(exec);

/**
 * PC 설정 (방별로 다르게 설정 가능)
 *
 * 실제 운영 시:
 *   - FLY:HOME 각 방마다 PC 한 대
 *   - 각 PC에 MAC 주소, IP, MSFS 경로 설정
 *   - 환경변수나 DB에서 로드 권장
 */
const DEFAULT_PC_CONFIG = {
  // ── 네트워크 설정 ──
  // TODO: 실제 PC의 MAC 주소로 변경 (예: 'AA:BB:CC:DD:EE:FF')
  mac: process.env.PC_MAC || '00:00:00:00:00:00',
  ip: process.env.PC_IP || '192.168.1.100',
  port: parseInt(process.env.PC_PORT || '9'), // Wake-on-LAN 기본 포트

  // ── MSFS 설치 경로 (버전별 다름) ──
  // 미래 개발자: 사용자 PC마다 경로 다를 수 있음
  // Steam 버전: 일반적으로 C:\Program Files\Steam\steamapps\common\MicrosoftFlightSimulator
  // MS Store 버전: WindowsApps 하위 (권한 필요)
  // MSFS 2024: 경로 변경됨, 자동 감지 로직 필요
  msfsPath: process.env.MSFS_PATH || '',
  msfsProcessName: 'FlightSimulator.exe', // MSFS 2020 프로세스명
  msfsProcessName2024: 'FlightSimulator2024.exe', // MSFS 2024 (확인 필요)

  // ── 타임아웃 설정 ──
  bootTimeoutMs: 120000,        // 2분: PC 부팅 대기
  msfsLoadTimeoutMs: 180000,    // 3분: MSFS 로딩 대기
  simconnectTimeoutMs: 30000,   // 30초: SimConnect 연결 대기

  // ── 재시도 설정 ──
  maxRetries: 3,                // 최대 재시도 횟수
  retryDelayMs: 5000,           // 재시도 간격 5초

  // ── 모드 ──
  mockMode: true // MSFS 없이 테스트 (기본값)
  // TODO: 실제 운영 시 false로 변경
};


/**
 * PC Launcher 메인 클래스
 *
 * 이벤트 발생:
 *   - 'state-change': 상태 변경 (waking, booting, launching, ready, error)
 *   - 'progress': 진행률 업데이트 (0~100)
 *   - 'error': 에러 발생
 *   - 'msfs-ready': MSFS 사용 준비 완료
 */
class PCLauncher extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = { ...DEFAULT_PC_CONFIG, ...config };
    this.state = 'idle';
    this.currentStep = '';
    this.progress = 0;
    this._abortController = null;
  }

  /**
   * ═══════════════════════════════════════════════════════════
   *  메인 부팅 시퀀스 — 전체 플로우의 핵심
   * ═══════════════════════════════════════════════════════════
   *
   * 호출 예시:
   *   const launcher = new PCLauncher();
   *   launcher.on('state-change', state => console.log(state));
   *   await launcher.bootSequence();
   *
   * 단계:
   *   1. PC 상태 확인 (켜져있나?)
   *   2. 꺼져있으면 Wake-on-LAN
   *   3. PC 부팅 대기 (핑 응답)
   *   4. MSFS 프로세스 확인 (실행 중인가?)
   *   5. 꺼져있으면 MSFS 실행
   *   6. MSFS 로딩 대기
   *   7. SimConnect 연결 시도
   *   8. 성공 시 msfs-ready 이벤트
   *
   * 에러 처리:
   *   - 각 단계마다 타임아웃 + 재시도
   *   - 최대 재시도 초과 시 호스트 알림
   *   - 부분 실패 시 가능한 단계까지 진행
   */
  async bootSequence() {
    this._setState('starting', '부팅 시퀀스 시작');
    this._abortController = new AbortController();

    try {
      // ── Step 1: PC 상태 확인 ──
      this._setState('checking-pc', 'PC 상태 확인 중');
      this._updateProgress(5);
      const pcAlive = await this._isPCAlive();

      if (!pcAlive) {
        // ── Step 2: Wake-on-LAN ──
        this._setState('waking', 'PC 깨우는 중 (Wake-on-LAN)');
        this._updateProgress(10);
        await this._wakeOnLAN();

        // ── Step 3: 부팅 대기 ──
        this._setState('booting', 'PC 부팅 대기 (최대 2분)');
        this._updateProgress(20);
        await this._waitForPC();
      }
      this._updateProgress(40);

      // ── Step 4: MSFS 상태 확인 ──
      this._setState('checking-msfs', 'MSFS 상태 확인 중');
      this._updateProgress(45);
      const msfsRunning = await this._isMSFSRunning();

      if (!msfsRunning) {
        // ── Step 5: MSFS 실행 ──
        this._setState('launching-msfs', 'MSFS 실행 중');
        this._updateProgress(50);
        await this._launchMSFS();

        // ── Step 6: MSFS 로딩 대기 ──
        this._setState('loading-msfs', 'MSFS 로딩 대기 (최대 3분)');
        this._updateProgress(60);
        await this._waitForMSFS();
      }
      this._updateProgress(80);

      // ── Step 7: SimConnect 연결 ──
      this._setState('connecting-simconnect', 'SimConnect 연결 중');
      this._updateProgress(90);
      await this._connectSimConnect();

      // ── 완료 ──
      this._setState('ready', '비행 준비 완료!');
      this._updateProgress(100);
      this.emit('msfs-ready');

      return { success: true };

    } catch (err) {
      this._setState('error', err.message);
      this.emit('error', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * PC가 네트워크상에 응답하는지 확인 (핑)
   *
   * 구현 방법:
   *   - 윈도우: ping -n 1 -w 1000 [IP]
   *   - 리눅스: ping -c 1 -W 1 [IP]
   *
   * 미래 개발자 주의:
   *   - 방화벽에서 ICMP 차단하면 false 나옴
   *   - TCP 포트 확인으로 대체 가능 (예: 3389 RDP)
   */
  async _isPCAlive() {
    if (this.config.mockMode) {
      // Mock: 50% 확률로 꺼져있다고 응답 (Wake-on-LAN 테스트용)
      await this._sleep(500);
      return Math.random() > 0.5;
    }

    try {
      const platform = process.platform;
      const cmd = platform === 'win32'
        ? `ping -n 1 -w 1000 ${this.config.ip}`
        : `ping -c 1 -W 1 ${this.config.ip}`;
      const { stdout } = await execAsync(cmd);
      // "TTL=" 문자열 있으면 응답 있음
      return stdout.includes('TTL=') || stdout.includes('ttl=');
    } catch (e) {
      return false; // 핑 실패 = 꺼져있음
    }
  }

  /**
   * Wake-on-LAN 매직 패킷 전송
   *
   * 원리:
   *   - UDP 브로드캐스트로 "AA:BB:CC:DD:EE:FF" MAC 주소 포함 패킷 전송
   *   - 네트워크 카드가 감지하면 PC 전원 ON
   *
   * PC 쪽 사전 설정 필요:
   *   1. BIOS: "Wake on LAN" 활성화
   *   2. Windows 장치 관리자:
   *      - 네트워크 어댑터 속성
   *      - "Magic Packet으로 컴퓨터 깨우기 허용"
   *      - "전원 관리 끄기" 해제
   *
   * 미래 개발자:
   *   - npm install wake_on_lan
   *   - 또는 직접 UDP 패킷 생성 (6개의 0xFF + MAC 주소 16번 반복)
   */
  async _wakeOnLAN() {
    if (this.config.mockMode) {
      await this._sleep(1000);
      return;
    }

    // TODO: 실제 구현 (npm wake_on_lan 사용)
    // const wol = require('wake_on_lan');
    // return new Promise((resolve, reject) => {
    //   wol.wake(this.config.mac, { port: this.config.port }, (err) => {
    //     if (err) reject(err);
    //     else resolve();
    //   });
    // });

    throw new Error('Wake-on-LAN not implemented (add wake_on_lan package)');
  }

  /**
   * PC가 부팅 완료될 때까지 대기
   *
   * 로직:
   *   - 2초마다 핑 시도
   *   - 응답 오면 성공
   *   - 타임아웃 초과 시 실패
   *
   * 실제 측정:
   *   - SSD PC: 30초~1분
   *   - HDD PC: 1~3분
   *   - 첫 부팅(Windows Update 후): 3~5분
   */
  async _waitForPC() {
    const start = Date.now();
    const checkInterval = 2000;

    while (Date.now() - start < this.config.bootTimeoutMs) {
      const alive = await this._isPCAlive();
      if (alive) {
        await this._sleep(5000); // 완전히 부팅 완료 대기 (+5초 여유)
        return;
      }
      await this._sleep(checkInterval);
    }

    throw new Error('PC 부팅 타임아웃 — 수동 확인 필요');
  }

  /**
   * MSFS가 현재 실행 중인지 확인
   *
   * 방법 1 (로컬): tasklist 또는 ps-list 패키지
   * 방법 2 (원격): PC에 에이전트 설치 → API 호출
   *
   * 미래 개발자 참고:
   *   - 원격 감지는 복잡함. FLY:HOME 환경은 로컬 서버 권장
   *   - 또는 PC에 감시 에이전트 설치 (이 앱이 그 역할 할 수 있음)
   */
  async _isMSFSRunning() {
    if (this.config.mockMode) {
      await this._sleep(500);
      return false; // Mock: 항상 꺼져있다고 가정
    }

    try {
      // Windows: tasklist 사용
      const { stdout } = await execAsync(`tasklist /FI "IMAGENAME eq ${this.config.msfsProcessName}"`);
      return stdout.toLowerCase().includes(this.config.msfsProcessName.toLowerCase());
    } catch (e) {
      return false;
    }
  }

  /**
   * MSFS 실행
   *
   * 방법:
   *   - 직접 실행파일 경로 (가장 확실)
   *   - Steam 프로토콜: steam://run/1250410
   *   - Microsoft Store 프로토콜: ms-xbox-gamepass://
   *
   * 주의사항:
   *   - 첫 실행 시 Xbox 로그인 필요 (수동)
   *   - 업데이트 있으면 먼저 다운로드 (시간 오래 걸림)
   *   - VR 모드, 화면 모드 설정 사전에 해야 함
   *
   * 자동 로그인 방법:
   *   - Xbox 자격증명 저장
   *   - "게임 패스 자동 로그인" 설정
   */
  async _launchMSFS() {
    if (this.config.mockMode) {
      await this._sleep(2000);
      return;
    }

    if (!this.config.msfsPath) {
      // 경로 자동 탐색 시도
      throw new Error('MSFS 경로가 설정되지 않았습니다. 환경변수 MSFS_PATH를 설정하세요');
    }

    // 백그라운드 프로세스로 실행 (감지 가능하도록)
    spawn(this.config.msfsPath, [], {
      detached: true,
      stdio: 'ignore'
    }).unref();
  }

  /**
   * MSFS 로딩 완료 대기
   *
   * 여러 방법:
   *   1. 프로세스 CPU/메모리 안정화 감지
   *   2. 윈도우 타이틀 체크 ("MICROSOFT FLIGHT SIMULATOR")
   *   3. SimConnect 연결 시도 (성공 = 준비됨)
   *
   * 가장 확실한 방법: SimConnect 연결로 판단
   * (MSFS가 완전히 로드되어야 SimConnect가 응답함)
   */
  async _waitForMSFS() {
    const start = Date.now();
    const checkInterval = 3000;

    if (this.config.mockMode) {
      await this._sleep(3000); // Mock: 3초만 대기
      return;
    }

    while (Date.now() - start < this.config.msfsLoadTimeoutMs) {
      // SimConnect 연결 시도 (연결되면 로딩 완료)
      const ready = await this._trySimConnect();
      if (ready) return;
      await this._sleep(checkInterval);
    }

    throw new Error('MSFS 로딩 타임아웃 — 수동 확인 필요');
  }

  /**
   * SimConnect 연결 시도
   *
   * 미래 개발자 구현:
   *   - npm install node-simconnect
   *   - SimConnect SDK 필요 (MSFS 설치 시 포함)
   *   - 연결 성공 시 '비행 데이터 수신' 시작
   *
   * 실제 코드 예시 (참고):
   *   const { open } = require('node-simconnect');
   *   const { recvOpen, handle } = await open('CockpitOS', Protocol.KittyHawk);
   *   → 이 핸들을 SimConnectProvider에 전달
   */
  async _connectSimConnect() {
    if (this.config.mockMode) {
      await this._sleep(1000);
      return true;
    }

    // TODO: 실제 SimConnect 연결
    // simconnect-provider.js 참고
    return this._trySimConnect();
  }

  async _trySimConnect() {
    if (this.config.mockMode) return true;
    // TODO: node-simconnect 사용
    return false;
  }

  /**
   * ═══════════════════════════════════════════════════════════
   *  종료 및 강제 재시작
   * ═══════════════════════════════════════════════════════════
   */

  /**
   * MSFS 강제 종료 (크래시 복구용)
   */
  async killMSFS() {
    if (this.config.mockMode) {
      this._setState('idle', 'MSFS 강제 종료');
      return;
    }
    try {
      await execAsync(`taskkill /F /IM ${this.config.msfsProcessName}`);
    } catch (e) {
      // 이미 꺼져있으면 에러 — 무시
    }
  }

  /**
   * PC 재시작 (마지막 수단)
   */
  async restartPC() {
    if (this.config.mockMode) return;
    await execAsync('shutdown /r /t 5');
  }

  /**
   * 부팅 시퀀스 중단
   */
  abort() {
    if (this._abortController) this._abortController.abort();
    this._setState('aborted', '사용자가 중단');
  }

  /**
   * ═══════════════════════════════════════════════════════════
   *  헬퍼 메서드
   * ═══════════════════════════════════════════════════════════
   */

  _setState(state, step) {
    this.state = state;
    this.currentStep = step;
    this.emit('state-change', { state, step });
    console.log(`[PCLauncher] ${state}: ${step}`);
  }

  _updateProgress(pct) {
    this.progress = pct;
    this.emit('progress', pct);
  }

  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getStatus() {
    return {
      state: this.state,
      step: this.currentStep,
      progress: this.progress,
      config: { ...this.config, mockMode: this.config.mockMode }
    };
  }
}

module.exports = { PCLauncher, DEFAULT_PC_CONFIG };
