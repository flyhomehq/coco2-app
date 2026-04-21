/**
 * CockpitOS — 광고 시스템 (클라이언트)
 * - 비행 중 위치 기반 광고 자동 조회
 * - 화면에 광고 카드 표시
 * - 호스트 대시보드 UI
 */

const FlightAds = {
  _lastCheckLat: null,
  _lastCheckLon: null,
  _lastCheckTime: 0,
  _shownAds: new Set(), // 이번 비행에서 보여준 광고 (중복 방지)

  _lang() {
    return (typeof App !== 'undefined') ? App.lang : 'ko';
  },

  // ── 근처 광고 조회 (10초마다) ──
  check(data) {
    if (!data || !data.latitude || !data.longitude) return;
    const now = Date.now();

    // 이전 조회 후 10초 지나거나 5km 이상 이동한 경우만
    const movedFar = this._lastCheckLat == null ||
      this._distance(data.latitude, data.longitude, this._lastCheckLat, this._lastCheckLon) > 5;
    if (now - this._lastCheckTime < 10000 && !movedFar) return;

    this._lastCheckLat = data.latitude;
    this._lastCheckLon = data.longitude;
    this._lastCheckTime = now;

    fetch(`/api/ads/nearby?lat=${data.latitude}&lon=${data.longitude}`)
      .then(r => r.json())
      .then(ads => {
        if (!ads || !ads.length) return;
        // 아직 안 보여준 광고 중 우선순위 최상위 하나만
        const adToShow = ads.find(ad => !this._shownAds.has(ad.id));
        if (adToShow) {
          this._shownAds.add(adToShow.id);
          this._showAd(adToShow);
        }
      })
      .catch(() => {});
  },

  // ── 광고 카드 표시 ──
  _showAd(ad) {
    const lang = this._lang();
    const title = ad[`title_${lang}`] || ad.title_ko || ad.title || '';
    const desc = ad[`desc_${lang}`] || ad.desc_ko || ad.desc || '';

    // 기존 광고 제거
    const old = document.getElementById('flight-ad-card');
    if (old) old.remove();

    const card = document.createElement('div');
    card.id = 'flight-ad-card';
    card.style.cssText = `
      position: fixed;
      top: 180px;
      left: 12px;
      max-width: 260px;
      z-index: 70;
      background: linear-gradient(135deg, rgba(100,200,255,0.15), rgba(100,200,255,0.08));
      border: 1.5px solid rgba(100,200,255,0.5);
      border-radius: 14px;
      padding: 12px 14px;
      backdrop-filter: blur(10px);
      box-shadow: 0 6px 20px rgba(0,0,0,0.4);
      opacity: 0;
      transform: translateX(-20px);
      transition: all 0.4s ease-out;
      pointer-events: auto;
      cursor: pointer;
      color: #fff;
      font-family: inherit;
    `;
    card.innerHTML = `
      <div style="font-size:10px;color:rgba(100,200,255,0.9);margin-bottom:4px;font-weight:700">📢 ${ad.sponsor || 'AD'}</div>
      <div style="font-size:14px;font-weight:700;color:#60c8ff;margin-bottom:4px">${title}</div>
      <div style="font-size:11px;color:rgba(255,255,255,0.75);line-height:1.4">${desc}</div>
      <div style="margin-top:6px;display:flex;justify-content:space-between;align-items:center">
        <span style="font-size:10px;color:rgba(255,255,255,0.4)">탭하여 보기 →</span>
        <button onclick="event.stopPropagation();document.getElementById('flight-ad-card').remove()" style="background:none;border:none;color:rgba(255,255,255,0.4);font-size:14px;cursor:pointer">✕</button>
      </div>
    `;
    card.onclick = () => {
      if (ad.link) window.open(ad.link, '_blank');
    };
    document.body.appendChild(card);

    // 슬라이드인
    requestAnimationFrame(() => {
      card.style.opacity = '1';
      card.style.transform = 'translateX(0)';
    });

    // 효과음
    if (typeof FlightAudio !== 'undefined') FlightAudio.playSFX('poiNearby');

    // 15초 후 자동 페이드
    setTimeout(() => {
      if (!card.parentNode) return;
      card.style.opacity = '0';
      card.style.transform = 'translateX(-20px)';
      setTimeout(() => card.remove(), 400);
    }, 15000);
  },

  _distance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 +
              Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  },

  // ── 비행 시작/종료 시 리셋 ──
  reset() {
    this._shownAds.clear();
    this._lastCheckTime = 0;
    this._lastCheckLat = null;
    const old = document.getElementById('flight-ad-card');
    if (old) old.remove();
  }
};

// FlightHUD 자동 연동
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    setTimeout(() => {
      if (typeof FlightHUD !== 'undefined') {
        const originalStart = FlightHUD.startFlight.bind(FlightHUD);
        FlightHUD.startFlight = function(scenario) {
          FlightAds.reset();
          originalStart(scenario);
        };

        const originalUpdate = FlightHUD._updateHUD.bind(FlightHUD);
        FlightHUD._updateHUD = function(data, judgment) {
          originalUpdate(data, judgment);
          FlightAds.check(data);
        };

        const originalStop = FlightHUD.stopFlight.bind(FlightHUD);
        FlightHUD.stopFlight = function() {
          originalStop();
          FlightAds.reset();
        };
      }
    }, 1500);
  });
}
