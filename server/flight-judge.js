/**
 * 비행 상태 판단 엔진
 * 비행 데이터를 보고 정상/주의/위험을 판단합니다.
 * AI 코칭 메시지도 여기서 생성합니다.
 */

class FlightJudge {
  constructor() {
    this._lastWarning = 0; // 마지막 경고 시간
    this._warningCooldown = 5; // 경고 간격 (초)
  }

  /**
   * 비행 데이터를 보고 판단
   * @returns {{ level: 'normal'|'caution'|'warning'|'danger', messages: Array, phase: string }}
   */
  judge(data) {
    const warnings = [];
    let level = 'normal';

    // 지상에 있으면 판단 불필요
    if (data.onGround) {
      return {
        level: 'normal',
        phase: data.phase,
        messages: [],
        nearbyPOI: data.nearbyPOI || null
      };
    }

    // ── 고도 체크 ──
    if (data.altitudeAGL < 200 && data.phase !== 'takeoff' && data.phase !== 'approach') {
      warnings.push({
        type: 'altitude',
        level: 'danger',
        message: '고도가 너무 낮아요! 기수를 올려주세요!',
        value: Math.round(data.altitudeAGL),
        unit: 'ft'
      });
      level = 'danger';
    } else if (data.altitudeAGL < 500 && data.phase !== 'takeoff' && data.phase !== 'approach') {
      warnings.push({
        type: 'altitude',
        level: 'caution',
        message: '고도가 낮아지고 있어요. 주의하세요.',
        value: Math.round(data.altitudeAGL),
        unit: 'ft'
      });
      if (level !== 'danger') level = 'caution';
    }

    // ── 속도 체크 (실속 경고) ──
    const stallSpeed = 45; // Cessna 172 실속 속도
    if (data.airspeed < stallSpeed) {
      warnings.push({
        type: 'stall',
        level: 'danger',
        message: '실속 경고! 기수를 내리고 스로틀을 올리세요!',
        value: Math.round(data.airspeed),
        unit: 'kt'
      });
      level = 'danger';
    } else if (data.airspeed < stallSpeed + 15) {
      warnings.push({
        type: 'speed_low',
        level: 'caution',
        message: '속도가 낮아요. 스로틀을 조금 올려볼까요?',
        value: Math.round(data.airspeed),
        unit: 'kt'
      });
      if (level !== 'danger') level = 'caution';
    }

    // ── 과속 체크 ──
    const maxSpeed = 160; // Cessna 172 Vne
    if (data.airspeed > maxSpeed) {
      warnings.push({
        type: 'overspeed',
        level: 'danger',
        message: '속도 초과! 스로틀을 줄이세요!',
        value: Math.round(data.airspeed),
        unit: 'kt'
      });
      level = 'danger';
    }

    // ── 뱅크각 체크 ──
    if (Math.abs(data.bank) > 45) {
      warnings.push({
        type: 'bank',
        level: 'danger',
        message: '뱅크각이 위험해요! 날개를 수평으로 돌려주세요!',
        value: Math.round(Math.abs(data.bank)),
        unit: '°'
      });
      level = 'danger';
    } else if (Math.abs(data.bank) > 30) {
      warnings.push({
        type: 'bank',
        level: 'caution',
        message: '뱅크각이 커요. 살짝 줄여볼까요?',
        value: Math.round(Math.abs(data.bank)),
        unit: '°'
      });
      if (level !== 'danger') level = 'caution';
    }

    // ── 수직속도 체크 (급강하) ──
    if (data.verticalSpeed < -2000) {
      warnings.push({
        type: 'descent_rate',
        level: 'danger',
        message: '급강하 중! 기수를 올려주세요!',
        value: Math.round(data.verticalSpeed),
        unit: 'fpm'
      });
      level = 'danger';
    } else if (data.verticalSpeed < -1000 && data.phase !== 'descent' && data.phase !== 'approach') {
      warnings.push({
        type: 'descent_rate',
        level: 'caution',
        message: '하강률이 빨라요. 천천히 내려가세요.',
        value: Math.round(data.verticalSpeed),
        unit: 'fpm'
      });
      if (level !== 'danger') level = 'caution';
    }

    // ── 연료 체크 ──
    if (data.fuel < 10) {
      warnings.push({
        type: 'fuel',
        level: 'danger',
        message: '연료가 거의 없어요! 즉시 착륙하세요!',
        value: Math.round(data.fuel),
        unit: '%'
      });
      level = 'danger';
    } else if (data.fuel < 20) {
      warnings.push({
        type: 'fuel',
        level: 'caution',
        message: '연료가 부족해요. 착륙을 준비하세요.',
        value: Math.round(data.fuel),
        unit: '%'
      });
      if (level !== 'danger') level = 'caution';
    }

    // ── 정상 비행 시 격려 메시지 ──
    if (level === 'normal' && Math.random() < 0.02) {
      const encouragements = [
        '잘하고 있어요! 고도 유지 완벽해요.',
        '좋아요! 속도도 적절하고 안정적이에요.',
        '비행 자세가 좋아요. 계속 이대로!',
        '멋져요! 프로 조종사 같아요!',
      ];
      warnings.push({
        type: 'encouragement',
        level: 'normal',
        message: encouragements[Math.floor(Math.random() * encouragements.length)]
      });
    }

    // ── 관광지 안내 ──
    if (data.nearbyPOI) {
      warnings.push({
        type: 'poi',
        level: 'info',
        message: `📍 ${data.nearbyPOI.name} — ${data.nearbyPOI.desc}`,
        poi: data.nearbyPOI
      });
    }

    return {
      level,
      phase: data.phase,
      messages: warnings,
      nearbyPOI: data.nearbyPOI || null
    };
  }

  /**
   * 비행 기록으로 리포트 생성
   */
  generateReport(recording) {
    if (!recording || recording.length === 0) {
      return { score: 0, message: '비행 기록이 없습니다.' };
    }

    const first = recording[0];
    const last = recording[recording.length - 1];
    const flightTime = last.time - first.time;

    // 최고/최저 값
    let maxAlt = 0, maxSpd = 0, maxBank = 0, maxVS = 0;
    let altDeviations = 0, spdDeviations = 0;
    let cruiseCount = 0;

    for (const r of recording) {
      maxAlt = Math.max(maxAlt, r.altitude);
      maxSpd = Math.max(maxSpd, r.airspeed);
      maxBank = Math.max(maxBank, Math.abs(r.bank));
      maxVS = Math.max(maxVS, Math.abs(r.verticalSpeed));

      if (r.phase === 'cruise') {
        cruiseCount++;
        if (Math.abs(r.verticalSpeed) > 200) altDeviations++;
        if (Math.abs(r.airspeed - 120) > 20) spdDeviations++;
      }
    }

    // 착륙 품질
    const landingVS = last.verticalSpeed || 0;
    let landingGrade = 'EXCELLENT';
    let landingStars = 5;
    if (Math.abs(landingVS) > 600) { landingGrade = 'HARD'; landingStars = 1; }
    else if (Math.abs(landingVS) > 400) { landingGrade = 'FIRM'; landingStars = 2; }
    else if (Math.abs(landingVS) > 250) { landingGrade = 'OK'; landingStars = 3; }
    else if (Math.abs(landingVS) > 100) { landingGrade = 'GOOD'; landingStars = 4; }

    // 항목별 점수
    const altScore = cruiseCount > 0 ? Math.max(1, 5 - Math.floor(altDeviations / cruiseCount * 10)) : 3;
    const spdScore = cruiseCount > 0 ? Math.max(1, 5 - Math.floor(spdDeviations / cruiseCount * 10)) : 3;
    const bankScore = maxBank > 45 ? 1 : maxBank > 30 ? 3 : 5;
    const totalScore = Math.round((altScore + spdScore + bankScore + landingStars) / 4 * 10) / 10;

    return {
      flightTime: Math.round(flightTime),
      maxAltitude: Math.round(maxAlt),
      maxSpeed: Math.round(maxSpd),
      fuelUsed: Math.round(first.fuel - last.fuel),
      scores: {
        altitudeKeeping: { stars: altScore, label: altScore >= 4 ? '안정적!' : '조금 흔들렸어요' },
        speedControl: { stars: spdScore, label: spdScore >= 4 ? '적절해요!' : '속도 변동이 있었어요' },
        bankControl: { stars: bankScore, label: bankScore >= 4 ? '부드러운 선회!' : '뱅크각이 컸어요' },
        landing: { stars: landingStars, grade: landingGrade, vs: Math.round(Math.abs(landingVS)) }
      },
      totalScore,
      totalStars: Math.round(totalScore)
    };
  }
}

module.exports = { FlightJudge };
