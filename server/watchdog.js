/**
 * ═══════════════════════════════════════════════════════════════════
 *  CockpitOS — Watchdog (자동 복구 시스템)
 * ═══════════════════════════════════════════════════════════════════
 *
 * 역할:
 *   - MSFS, SimConnect, 앱 상태 실시간 감시
 *   - 문제 감지 시 자동 복구 시도
 *   - 복구 실패 시 호스트에게 알림
 *   - 모든 이벤트 로깅 (장애 분석용)
 *
 * 실제 FLY:HOME 운영에서:
 *   - 게스트가 비행 중 MSFS가 프리즈
 *   - 게스트는 당황 → 우리 앱이 자동 대응:
 *     1. 프리즈 감지 (10초 이상 데이터 없음)
 *     2. SimConnect 재연결 시도
 *     3. 실패 시 MSFS 재시작
 *     4. 재시작 후 비행 재개
 *     5. 게스트에게 "잠깐만요" 메시지
 *   - 호스트 개입 없이 해결
 *
 * 감시 주기:
 *   - 일반: 30초마다
 *   - 비행 중: 10초마다
 *   - 문제 감지 시: 3초마다
 *
 * 복구 전략 (단계적 에스컬레이션):
 *   Level 1 (소프트): SimConnect 재연결
 *   Level 2 (미디엄): MSFS 재시작
 *   Level 3 (하드):   PC 재부팅
 *   Level 4 (최종):   호스트 개입 요청
 *
 * ═══════════════════════════════════════════════════════════════════
 *
 *  미래 개발자 참고:
 *
 *  실제 프로덕션에서는 다음 추가 권장:
 *    - Sentry (에러 추적)
 *    - Prometheus + Grafana (메트릭)
 *    - PagerDuty (호스트 호출)
 *    - 일일 리포트 (이메일)
 *
 * ═══════════════════════════════════════════════════════════════════
 */

const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');

/**
 * Watchdog 설정
 */
const DEFAULT_CONFIG = {
  // ── 감시 주기 ──
  idleCheckMs: 30000,    // 비행 중 아님: 30초
  activeCheckMs: 10000,  // 비행 중: 10초
  problemCheckMs: 3000,  // 문제 발생: 3초

  // ── 판단 기준 ──
  dataStaleMs: 10000,    // 10초간 데이터 없으면 프리즈 의심
  crashDetectMs: 30000,  // 30초간 무응답이면 크래시 확정

  // ── 재시도 한도 ──
  maxSoftRetries: 3,     // SimConnect 재연결 최대 3회
  maxMediumRetries: 2,   // MSFS 재시작 최대 2회
  maxHardRetries: 1,     // PC 재부팅 최대 1회

  // ── 로그 파일 ──
  logFile: path.join(__dirname, 'watchdog.log'),
  maxLogSizeBytes: 5 * 1024 * 1024, // 5MB 넘으면 회전
};


/**
 * Watchdog 메인 클래스
 *
 * 이벤트:
 *   - 'health-change': 상태 변경 (healthy, degraded, critical, down)
 *   - 'recovery-started': 복구 시작
 *   - 'recovery-success': 복구 성공
 *   - 'recovery-failed': 복구 실패 (호스트 개입 필요)
 *   - 'host-alert': 호스트에게 알림 필요
 */
class Watchdog extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };

    // 상태 추적
    this._health = 'healthy';     // healthy, degraded, critical, down
    this._lastDataTime = Date.now();
    this._flightActive = false;
    this._recovering = false;

    // 재시도 카운터
    this._softRetries = 0;
    this._mediumRetries = 0;
    this._hardRetries = 0;

    // 외부 의존성 (주입받음)
    this._flightProvider = null;
    this._pcLauncher = null;
    this._notifier = null;

    // 감시 타이머
    this._checkInterval = null;
  }

  /**
   * 의존성 주입 (생성 후 호출)
   *
   * 예시:
   *   const watchdog = new Watchdog();
   *   watchdog.setDependencies({
   *     flightProvider: simConnectProvider,
   *     pcLauncher: pcLauncher,
   *     notifier: notifier
   *   });
   *   watchdog.start();
   */
  setDependencies({ flightProvider, pcLauncher, notifier }) {
    this._flightProvider = flightProvider;
    this._pcLauncher = pcLauncher;
    this._notifier = notifier;

    // 데이터 수신 추적
    if (flightProvider && flightProvider.on) {
      flightProvider.on('data', () => {
        this._lastDataTime = Date.now();
        // 복구 중이었으면 성공
        if (this._recovering) {
          this._onRecoverySuccess();
        }
      });
    }
  }

  /**
   * Watchdog 시작
   */
  start() {
    this._log('INFO', 'Watchdog 시작');
    this._scheduleNextCheck();
  }

  /**
   * Watchdog 정지
   */
  stop() {
    if (this._checkInterval) {
      clearTimeout(this._checkInterval);
      this._checkInterval = null;
    }
    this._log('INFO', 'Watchdog 정지');
  }

  /**
   * 비행 시작/종료 알림
   */
  setFlightActive(active) {
    this._flightActive = active;
    this._log('INFO', `비행 상태: ${active ? '활성' : '비활성'}`);
  }

  /**
   * ═══════════════════════════════════════════════════════════
   *  감시 로직 (Core)
   * ═══════════════════════════════════════════════════════════
   */

  async _check() {
    try {
      const now = Date.now();
      const dataAge = now - this._lastDataTime;

      // ── 1. 데이터 수신 상태 확인 ──
      if (this._flightActive) {
        if (dataAge > this.config.crashDetectMs) {
          // 크래시 확정 (30초 무응답)
          await this._handleCritical('데이터 30초 이상 없음 → 크래시 의심');
        } else if (dataAge > this.config.dataStaleMs) {
          // 프리즈 의심 (10초 무응답)
          await this._handleDegraded('데이터 10초 이상 없음');
        } else {
          // 정상
          this._setHealth('healthy');
        }
      }

      // ── 2. SimConnect 연결 상태 ──
      if (this._flightProvider && this._flightProvider.isConnected) {
        if (!this._flightProvider.isConnected()) {
          await this._handleDegraded('SimConnect 연결 끊김');
        }
      }

      // ── 3. PC 응답 상태 ──
      // TODO: PC Launcher가 있을 때 PC 상태 체크
      // if (this._pcLauncher) {
      //   const pcAlive = await this._pcLauncher._isPCAlive();
      //   if (!pcAlive && this._flightActive) {
      //     await this._handleCritical('PC 응답 없음');
      //   }
      // }

    } catch (err) {
      this._log('ERROR', `감시 중 에러: ${err.message}`);
    } finally {
      this._scheduleNextCheck();
    }
  }

  /**
   * 다음 체크 스케줄링 (상태에 따라 주기 조정)
   */
  _scheduleNextCheck() {
    let delay;
    if (this._health === 'critical' || this._recovering) {
      delay = this.config.problemCheckMs;
    } else if (this._flightActive) {
      delay = this.config.activeCheckMs;
    } else {
      delay = this.config.idleCheckMs;
    }
    this._checkInterval = setTimeout(() => this._check(), delay);
  }

  /**
   * ═══════════════════════════════════════════════════════════
   *  에러 핸들링 (단계적 복구)
   * ═══════════════════════════════════════════════════════════
   */

  /**
   * 레벨 1: 소프트 이슈 (프리즈 의심)
   */
  async _handleDegraded(reason) {
    if (this._recovering) return; // 이미 복구 중
    this._setHealth('degraded');
    this._log('WARN', `Degraded: ${reason}`);

    if (this._softRetries < this.config.maxSoftRetries) {
      await this._softRecovery();
    } else {
      // 소프트 복구 한도 초과 → 미디엄으로 에스컬레이션
      this._softRetries = 0;
      await this._handleCritical(`소프트 복구 ${this.config.maxSoftRetries}회 실패`);
    }
  }

  /**
   * 레벨 2-3: 크리티컬 (크래시 확정)
   */
  async _handleCritical(reason) {
    if (this._recovering) return;
    this._setHealth('critical');
    this._log('ERROR', `Critical: ${reason}`);

    if (this._mediumRetries < this.config.maxMediumRetries) {
      await this._mediumRecovery();
    } else if (this._hardRetries < this.config.maxHardRetries) {
      this._mediumRetries = 0;
      await this._hardRecovery();
    } else {
      // 모든 복구 실패 → 호스트 개입 필요
      await this._escalateToHost(reason);
    }
  }

  /**
   * 소프트 복구: SimConnect 재연결만
   */
  async _softRecovery() {
    this._recovering = true;
    this._softRetries++;
    this.emit('recovery-started', { level: 'soft', attempt: this._softRetries });
    this._log('INFO', `Soft recovery 시도 #${this._softRetries}`);

    try {
      if (this._flightProvider && this._flightProvider.connect) {
        await this._flightProvider.connect();
      }
      this._log('INFO', 'Soft recovery 성공');
      this._onRecoverySuccess();
    } catch (err) {
      this._log('ERROR', `Soft recovery 실패: ${err.message}`);
      this._recovering = false;
      // 다음 체크에서 재시도
    }
  }

  /**
   * 미디엄 복구: MSFS 재시작
   */
  async _mediumRecovery() {
    this._recovering = true;
    this._mediumRetries++;
    this.emit('recovery-started', { level: 'medium', attempt: this._mediumRetries });
    this._log('WARN', `Medium recovery 시도 #${this._mediumRetries} — MSFS 재시작`);

    try {
      if (this._pcLauncher) {
        await this._pcLauncher.killMSFS();
        await this._sleep(3000);
        await this._pcLauncher.bootSequence();
      }
      this._log('INFO', 'Medium recovery 성공');
      this._onRecoverySuccess();
    } catch (err) {
      this._log('ERROR', `Medium recovery 실패: ${err.message}`);
      this._recovering = false;
    }
  }

  /**
   * 하드 복구: PC 재부팅
   * (마지막 수단, 게스트에게 큰 불편)
   */
  async _hardRecovery() {
    this._recovering = true;
    this._hardRetries++;
    this.emit('recovery-started', { level: 'hard', attempt: this._hardRetries });
    this._log('WARN', `Hard recovery 시도 — PC 재부팅`);

    // 호스트에게 미리 알림
    if (this._notifier) {
      await this._notifier.alert({
        level: 'warning',
        message: 'PC 재부팅 시도 중',
        room: this.config.roomId || 'unknown'
      });
    }

    try {
      if (this._pcLauncher) {
        await this._pcLauncher.restartPC();
        // PC 재부팅 후 5분 대기
        await this._sleep(300000);
        await this._pcLauncher.bootSequence();
      }
      this._log('INFO', 'Hard recovery 성공');
      this._onRecoverySuccess();
    } catch (err) {
      this._log('ERROR', `Hard recovery 실패: ${err.message}`);
      this._recovering = false;
    }
  }

  /**
   * 에스컬레이션: 호스트 개입 필요
   */
  async _escalateToHost(reason) {
    this._setHealth('down');
    this._log('CRITICAL', `호스트 개입 필요: ${reason}`);
    this.emit('recovery-failed', { reason });
    this.emit('host-alert', {
      level: 'critical',
      message: `자동 복구 실패 — 수동 확인 필요`,
      reason: reason,
      room: this.config.roomId || 'unknown'
    });

    if (this._notifier) {
      await this._notifier.alert({
        level: 'critical',
        message: `[FLY:HOME] 자동 복구 실패: ${reason}`,
        room: this.config.roomId || 'unknown'
      });
    }
  }

  /**
   * 복구 성공 처리
   */
  _onRecoverySuccess() {
    this._recovering = false;
    this._softRetries = 0;
    this._mediumRetries = 0;
    this._hardRetries = 0;
    this._setHealth('healthy');
    this._lastDataTime = Date.now();
    this.emit('recovery-success');
  }

  /**
   * ═══════════════════════════════════════════════════════════
   *  로깅 (장애 분석용)
   * ═══════════════════════════════════════════════════════════
   */

  _log(level, message) {
    const ts = new Date().toISOString();
    const line = `[${ts}] [${level}] ${message}\n`;
    console.log(line.trim());

    // 파일 로그 (옵션)
    try {
      if (fs.existsSync(this.config.logFile)) {
        const stats = fs.statSync(this.config.logFile);
        if (stats.size > this.config.maxLogSizeBytes) {
          // 로그 회전
          fs.renameSync(this.config.logFile, this.config.logFile + '.old');
        }
      }
      fs.appendFileSync(this.config.logFile, line);
    } catch (e) {
      // 로그 실패는 무시 (메인 로직 방해 금지)
    }
  }

  /**
   * ═══════════════════════════════════════════════════════════
   *  상태 관리
   * ═══════════════════════════════════════════════════════════
   */

  _setHealth(health) {
    if (this._health !== health) {
      this._health = health;
      this.emit('health-change', health);
      this._log('INFO', `건강 상태: ${health}`);
    }
  }

  getHealth() {
    return {
      health: this._health,
      flightActive: this._flightActive,
      recovering: this._recovering,
      lastDataAge: Date.now() - this._lastDataTime,
      retries: {
        soft: this._softRetries,
        medium: this._mediumRetries,
        hard: this._hardRetries
      }
    };
  }

  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = { Watchdog, DEFAULT_CONFIG };
