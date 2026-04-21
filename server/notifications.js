/**
 * ═══════════════════════════════════════════════════════════════════
 *  CockpitOS — 알림 시스템 (Notifications)
 * ═══════════════════════════════════════════════════════════════════
 *
 * 역할:
 *   - 호스트(대웅님)에게 실시간 알림
 *   - 다양한 채널 지원 (웹 푸시, 카카오, SMS, 이메일)
 *   - 우선순위별 전송 방식 차등
 *
 * 알림 채널:
 *   - INFO: 대시보드만 (로그)
 *   - WARNING: 웹 푸시 + 대시보드
 *   - ERROR: 카카오톡 + 웹 푸시
 *   - CRITICAL: 카카오톡 + SMS + 이메일 (모든 수단)
 *
 * 실제 사용 시나리오:
 *   - 방 2번 MSFS 3번째 재시작 → 카카오톡으로 알림
 *   - 방 5번 PC 응답 없음 → SMS + 이메일 (긴급)
 *   - 새 게스트 체크인 → 푸시 (일반)
 *   - 광고 수익 일일 정산 → 이메일 (정기)
 *
 * ═══════════════════════════════════════════════════════════════════
 *
 *  미래 개발자 참고:
 *
 *  이 파일은 구조만 만들어둔 상태:
 *    - 실제 API 키는 환경변수로 관리
 *    - 각 서비스별 연동 코드는 TODO
 *
 *  추천 서비스 (비용 낮은 순):
 *    1. 카카오 알림톡 (건당 15~20원, 한국 특화)
 *    2. 이메일 (SendGrid 무료 ~100건/일)
 *    3. 웹 푸시 (무료, 브라우저 PWA)
 *    4. Twilio SMS ($0.05/건, 국제)
 *    5. Slack 웹훅 (무료)
 *    6. Discord 웹훅 (무료)
 *
 *  FLY:HOME 초기 운영:
 *    - Slack/Discord 무료 채널 추천
 *    - 게스트가 적으므로 충분
 *    - 나중에 카카오톡으로 전환
 *
 * ═══════════════════════════════════════════════════════════════════
 */

const fs = require('fs');
const path = require('path');


/**
 * 알림 우선순위
 */
const LEVELS = {
  INFO:     { priority: 1, channels: ['log', 'dashboard'] },
  WARNING:  { priority: 2, channels: ['log', 'dashboard', 'webPush'] },
  ERROR:    { priority: 3, channels: ['log', 'dashboard', 'webPush', 'kakao'] },
  CRITICAL: { priority: 4, channels: ['log', 'dashboard', 'webPush', 'kakao', 'sms', 'email'] }
};


/**
 * Notifier 메인 클래스
 *
 * 사용 예시:
 *   const notifier = new Notifier({
 *     hostPhone: '01012345678',
 *     hostEmail: 'host@flyhome.com',
 *     kakaoApiKey: process.env.KAKAO_API_KEY
 *   });
 *
 *   await notifier.alert({
 *     level: 'CRITICAL',
 *     message: '방 2번 MSFS 복구 실패',
 *     room: 'room-2'
 *   });
 */
class Notifier {
  constructor(config = {}) {
    this.config = {
      hostPhone: config.hostPhone || process.env.HOST_PHONE || '',
      hostEmail: config.hostEmail || process.env.HOST_EMAIL || '',
      hostName: config.hostName || '호스트',

      // API 키 (환경변수에서 로드)
      kakaoApiKey: config.kakaoApiKey || process.env.KAKAO_API_KEY || '',
      twilioSid: config.twilioSid || process.env.TWILIO_SID || '',
      twilioToken: config.twilioToken || process.env.TWILIO_TOKEN || '',
      sendgridKey: config.sendgridKey || process.env.SENDGRID_KEY || '',
      slackWebhook: config.slackWebhook || process.env.SLACK_WEBHOOK || '',
      discordWebhook: config.discordWebhook || process.env.DISCORD_WEBHOOK || '',

      // 로그 파일
      logFile: config.logFile || path.join(__dirname, 'notifications.log'),

      // 웹 푸시 구독 저장 (브라우저에서 저장 후 전송)
      webPushSubscriptions: config.webPushSubscriptions || [],

      // 모드
      mockMode: config.mockMode !== false // 기본 true
    };

    // 중복 방지 (같은 메시지 연속 방지)
    this._recentAlerts = new Map();
    this._recentAlertWindowMs = 60000; // 1분
  }

  /**
   * ═══════════════════════════════════════════════════════════
   *  메인 알림 함수
   * ═══════════════════════════════════════════════════════════
   *
   * @param {Object} options
   * @param {string} options.level - INFO|WARNING|ERROR|CRITICAL
   * @param {string} options.message - 알림 내용
   * @param {string} [options.room] - 방 ID (예: room-2)
   * @param {string} [options.room] - 방 ID (옵션)
   */
  async alert(options) {
    const { level = 'INFO', message = '', room = '' } = options;

    // 1. 중복 체크
    const dedupKey = `${level}:${message}:${room}`;
    const last = this._recentAlerts.get(dedupKey);
    if (last && Date.now() - last < this._recentAlertWindowMs) {
      // 최근 알림과 같음 → 무시
      return { skipped: true, reason: 'duplicate' };
    }
    this._recentAlerts.set(dedupKey, Date.now());

    // 2. 우선순위 및 채널 결정
    const levelConfig = LEVELS[level] || LEVELS.INFO;
    const channels = levelConfig.channels;

    // 3. 각 채널로 전송
    const results = {};
    for (const channel of channels) {
      try {
        results[channel] = await this._sendToChannel(channel, { level, message, room });
      } catch (err) {
        results[channel] = { error: err.message };
      }
    }

    return { sent: true, level, channels, results };
  }

  /**
   * 채널별 전송
   */
  async _sendToChannel(channel, data) {
    switch (channel) {
      case 'log':       return this._logToFile(data);
      case 'dashboard': return this._pushToDashboard(data);
      case 'webPush':   return this._sendWebPush(data);
      case 'kakao':     return this._sendKakao(data);
      case 'sms':       return this._sendSMS(data);
      case 'email':     return this._sendEmail(data);
      case 'slack':     return this._sendSlack(data);
      case 'discord':   return this._sendDiscord(data);
      default: return { skipped: true };
    }
  }

  /**
   * ═══════════════════════════════════════════════════════════
   *  채널별 구현
   * ═══════════════════════════════════════════════════════════
   */

  /**
   * 1. 로그 파일 (항상 기록)
   */
  _logToFile(data) {
    const ts = new Date().toISOString();
    const line = `[${ts}] [${data.level}] ${data.room ? `[${data.room}] ` : ''}${data.message}\n`;
    try {
      fs.appendFileSync(this.config.logFile, line);
      return { success: true };
    } catch (e) {
      return { error: e.message };
    }
  }

  /**
   * 2. 대시보드 (WebSocket으로 브라우저에 실시간 전달)
   *
   * TODO (미래 개발자):
   *   서버의 WebSocket 연결에 데이터 전송
   *   호스트 대시보드가 열려있으면 실시간 업데이트
   */
  _pushToDashboard(data) {
    // TODO: 서버의 wss 인스턴스 참조해서 모든 클라이언트에 전송
    // wss.clients.forEach(client => {
    //   if (client.role === 'host') {
    //     client.send(JSON.stringify({ type: 'alert', ...data }));
    //   }
    // });
    return { success: true, mock: true };
  }

  /**
   * 3. 웹 푸시 (브라우저 알림)
   *
   * TODO (미래 개발자):
   *   npm install web-push
   *   VAPID 키 생성 후 환경변수에
   *   구독 정보 DB에 저장
   */
  async _sendWebPush(data) {
    if (this.config.mockMode || !this.config.webPushSubscriptions.length) {
      return { mock: true };
    }

    // TODO: web-push 구현
    // const webpush = require('web-push');
    // webpush.setVapidDetails(...)
    // await Promise.all(subscriptions.map(sub =>
    //   webpush.sendNotification(sub, JSON.stringify(data))
    // ));

    return { pending: 'install web-push package' };
  }

  /**
   * 4. 카카오 알림톡
   *
   * 한국 서비스용 최적 (한국어, 친숙함)
   *
   * TODO (미래 개발자):
   *   1. 카카오 비즈니스 채널 가입
   *   2. 알림톡 템플릿 승인 (2~3일 소요)
   *   3. 알리고, NCloud 등 중계 서비스 선택
   *   4. API 연동
   *
   * 비용: 건당 15~20원 (매우 저렴)
   */
  async _sendKakao(data) {
    if (this.config.mockMode || !this.config.kakaoApiKey) {
      console.log('[Kakao Mock]', data);
      return { mock: true };
    }

    // TODO: 카카오 알림톡 API 호출
    // 예시: 알리고 API (https://smartsms.aligo.in)
    //   POST https://kakaoapi.aligo.in/akv10/alimtalk/send/
    //   { apikey, userid, token, senderkey, tpl_code, sender, receiver, message }

    return { pending: 'kakao API integration' };
  }

  /**
   * 5. SMS (Twilio)
   *
   * 국제 호환, 안정적, 약간 비쌈
   */
  async _sendSMS(data) {
    if (this.config.mockMode || !this.config.twilioSid) {
      console.log('[SMS Mock]', data);
      return { mock: true };
    }

    // TODO: Twilio SDK 사용
    // const twilio = require('twilio');
    // const client = twilio(sid, token);
    // await client.messages.create({
    //   body: `[FLY:HOME] ${data.message}`,
    //   to: this.config.hostPhone,
    //   from: process.env.TWILIO_NUMBER
    // });

    return { pending: 'twilio integration' };
  }

  /**
   * 6. 이메일 (SendGrid)
   *
   * 장문 가능, 첨부 파일 가능
   * 긴급도 낮음 (실시간 아님)
   */
  async _sendEmail(data) {
    if (this.config.mockMode || !this.config.sendgridKey) {
      console.log('[Email Mock]', data);
      return { mock: true };
    }

    // TODO: SendGrid 구현
    // const sgMail = require('@sendgrid/mail');
    // sgMail.setApiKey(this.config.sendgridKey);
    // await sgMail.send({
    //   to: this.config.hostEmail,
    //   from: 'alerts@flyhome.com',
    //   subject: `[${data.level}] ${data.room}`,
    //   text: data.message
    // });

    return { pending: 'sendgrid integration' };
  }

  /**
   * 7. Slack 웹훅 (초기 운영 추천)
   *
   * 무료, 즉시 사용 가능, 팀 공유 쉬움
   */
  async _sendSlack(data) {
    if (!this.config.slackWebhook) return { skipped: true };

    try {
      const res = await fetch(this.config.slackWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `[${data.level}] ${data.room ? `🏠 ${data.room} — ` : ''}${data.message}`
        })
      });
      return { success: res.ok };
    } catch (e) {
      return { error: e.message };
    }
  }

  /**
   * 8. Discord 웹훅 (초기 운영 추천)
   *
   * Slack과 유사, 게임/스트리머 친화적
   */
  async _sendDiscord(data) {
    if (!this.config.discordWebhook) return { skipped: true };

    try {
      const emoji = {
        INFO: 'ℹ️', WARNING: '⚠️', ERROR: '❌', CRITICAL: '🚨'
      }[data.level] || '';

      const res = await fetch(this.config.discordWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: `${emoji} **[${data.level}]** ${data.room ? `\`${data.room}\` — ` : ''}${data.message}`
        })
      });
      return { success: res.ok };
    } catch (e) {
      return { error: e.message };
    }
  }
}

module.exports = { Notifier, LEVELS };
