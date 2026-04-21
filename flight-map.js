/**
 * CockpitOS — 비행 미니맵 (Leaflet)
 * 비행기의 실시간 위치를 지도에 표시
 * 관광지/광고 마커도 함께 표시
 */

const FlightMap = {
  _map: null,
  _planeMarker: null,
  _trailPolyline: null,
  _trail: [],
  _poiMarkers: [],
  _visible: false,

  // 현재 언어 번역
  _t(key) {
    const lang = (typeof App !== 'undefined') ? App.lang : 'ko';
    return (typeof T !== 'undefined' && T[lang] && T[lang][key]) ? T[lang][key] : key;
  },

  // ── 미니맵 생성 ──
  init() {
    if (this._map) return;

    // 미니맵 컨테이너 생성
    const wrap = document.createElement('div');
    wrap.id = 'flight-map-wrap';
    wrap.style.cssText = `
      position: fixed;
      bottom: 180px;
      right: 12px;
      width: 240px;
      height: 240px;
      z-index: 95;
      border-radius: 16px;
      border: 2px solid rgba(245, 166, 35, 0.5);
      overflow: hidden;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.6);
      display: none;
      background: #1a1a2e;
    `;
    wrap.innerHTML = `
      <div id="flight-map"></div>
      <button onclick="FlightMap.toggleSize()" style="position:absolute;top:6px;right:6px;z-index:400;background:rgba(0,0,0,0.7);border:1px solid rgba(255,255,255,0.3);border-radius:6px;color:#fff;padding:3px 8px;font-size:11px;cursor:pointer;font-family:inherit">⛶</button>
      <div id="flight-map-info" style="position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,0.7);color:#fff;font-size:10px;padding:3px 6px;text-align:center"></div>
    `;
    document.body.appendChild(wrap);

    const mapDiv = document.getElementById('flight-map');
    mapDiv.style.cssText = 'width:100%;height:100%';

    // Leaflet 맵 초기화 (서울 중심)
    this._map = L.map('flight-map', {
      zoomControl: false,
      attributionControl: false
    }).setView([37.5586, 126.7906], 10);

    // 다크 테마 타일
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 18
    }).addTo(this._map);

    // 경로 polyline
    this._trailPolyline = L.polyline([], {
      color: '#FFD060',
      weight: 2,
      opacity: 0.8
    }).addTo(this._map);

    // 비행기 마커 (커스텀 아이콘)
    const planeIcon = L.divIcon({
      html: '<div style="font-size:24px;transform:rotate(0deg);text-shadow:0 0 4px #000">✈️</div>',
      iconSize: [30, 30],
      iconAnchor: [15, 15],
      className: 'plane-marker'
    });
    this._planeMarker = L.marker([37.5586, 126.7906], { icon: planeIcon }).addTo(this._map);
  },

  // ── 표시 ──
  show() {
    this.init();
    const wrap = document.getElementById('flight-map-wrap');
    if (wrap) {
      wrap.style.display = 'block';
      this._visible = true;
      // Leaflet 렌더링 재계산
      setTimeout(() => this._map && this._map.invalidateSize(), 100);
    }
  },

  // ── 숨기기 ──
  hide() {
    const wrap = document.getElementById('flight-map-wrap');
    if (wrap) {
      wrap.style.display = 'none';
      this._visible = false;
    }
  },

  // ── 크기 토글 (작게/크게) ──
  _expanded: false,
  toggleSize() {
    const wrap = document.getElementById('flight-map-wrap');
    if (!wrap) return;
    this._expanded = !this._expanded;
    if (this._expanded) {
      wrap.style.width = 'min(90vw, 500px)';
      wrap.style.height = 'min(70vh, 500px)';
      wrap.style.bottom = '50%';
      wrap.style.right = '50%';
      wrap.style.transform = 'translate(50%, 50%)';
    } else {
      wrap.style.width = '240px';
      wrap.style.height = '240px';
      wrap.style.bottom = '180px';
      wrap.style.right = '12px';
      wrap.style.transform = 'none';
    }
    setTimeout(() => this._map && this._map.invalidateSize(), 200);
  },

  // ── 비행기 위치 업데이트 ──
  updatePosition(data) {
    if (!this._map || !this._planeMarker || !data) return;
    const { latitude, longitude, heading, altitude, airspeed } = data;
    if (latitude == null || longitude == null) return;

    // 비행기 마커 이동
    this._planeMarker.setLatLng([latitude, longitude]);

    // 헤딩에 맞게 회전
    const icon = this._planeMarker.getElement();
    if (icon) {
      const planeDiv = icon.querySelector('div');
      if (planeDiv) planeDiv.style.transform = `rotate(${heading - 45}deg)`;
    }

    // 경로 추가 (5초마다 한 번만)
    const now = Date.now();
    if (!this._lastTrailTime || now - this._lastTrailTime > 2000) {
      this._trail.push([latitude, longitude]);
      if (this._trail.length > 200) this._trail.shift(); // 최대 200개
      this._trailPolyline.setLatLngs(this._trail);
      this._lastTrailTime = now;
    }

    // 지도 중심을 비행기에 맞춤 (부드럽게)
    this._map.panTo([latitude, longitude], { animate: true, duration: 0.5 });

    // 정보 표시
    const info = document.getElementById('flight-map-info');
    if (info) {
      info.textContent = `ALT ${Math.round(altitude || 0)}ft · SPD ${Math.round(airspeed || 0)}kt`;
    }
  },

  // ── 관광지 마커 추가 ──
  addPOIs(pois) {
    if (!this._map || !Array.isArray(pois)) return;
    // 기존 마커 제거
    this._poiMarkers.forEach(m => this._map.removeLayer(m));
    this._poiMarkers = [];

    pois.forEach(poi => {
      const icon = L.divIcon({
        html: `<div style="font-size:14px;background:rgba(245,166,35,0.9);border:2px solid #1a0800;border-radius:50%;width:24px;height:24px;display:flex;align-items:center;justify-content:center;color:#1a0800;font-weight:700">${poi.icon || '📍'}</div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
        className: 'poi-marker'
      });
      const marker = L.marker([poi.lat, poi.lon], { icon }).addTo(this._map);
      marker.bindPopup(`<b>${poi.name || ''}</b><br>${poi.desc || ''}`);
      this._poiMarkers.push(marker);
    });
  },

  // ── 광고 마커 추가 (향후 확장) ──
  addAds(ads) {
    if (!this._map || !Array.isArray(ads)) return;
    ads.forEach(ad => {
      const icon = L.divIcon({
        html: `<div style="font-size:14px;background:rgba(255,80,80,0.9);border:2px solid #fff;border-radius:4px;padding:2px 6px;color:#fff;font-weight:700;font-size:10px;white-space:nowrap">📢 ${ad.title || ''}</div>`,
        iconSize: [80, 24],
        iconAnchor: [40, 12],
        className: 'ad-marker'
      });
      const marker = L.marker([ad.lat, ad.lon], { icon }).addTo(this._map);
      if (ad.link) {
        marker.on('click', () => window.open(ad.link, '_blank'));
      }
      this._poiMarkers.push(marker);
    });
  }
};

// FlightHUD와 연동 — 비행 데이터 오면 지도 업데이트
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    // FlightHUD의 _updateHUD를 래핑 (미니맵 자동 업데이트)
    setTimeout(() => {
      if (typeof FlightHUD !== 'undefined') {
        const originalUpdate = FlightHUD._updateHUD.bind(FlightHUD);
        FlightHUD._updateHUD = function(data, judgment) {
          originalUpdate(data, judgment);
          if (FlightMap._visible) FlightMap.updatePosition(data);
        };

        // 비행 시작 시 지도 표시
        const originalStart = FlightHUD.startFlight.bind(FlightHUD);
        FlightHUD.startFlight = function(scenario) {
          originalStart(scenario);
          FlightMap.show();
          // 시나리오에 맞는 관광지 표시
          const pois = (scenario === 'jeju_tour') ? (typeof JEJU_POIS_DATA !== 'undefined' ? JEJU_POIS_DATA : []) : (typeof SEOUL_POIS_DATA !== 'undefined' ? SEOUL_POIS_DATA : []);
          setTimeout(() => FlightMap.addPOIs(pois), 500);
        };

        // 비행 종료 시 지도 숨기기
        const originalStop = FlightHUD.stopFlight.bind(FlightHUD);
        FlightHUD.stopFlight = function() {
          originalStop();
          FlightMap.hide();
        };
      }
    }, 1000);
  });
}

// ── 관광지 데이터 (지도용) — 확장 버전 ──
const SEOUL_POIS_DATA = [
  // 랜드마크
  { name: '남산타워', lat: 37.5512, lon: 126.9882, desc: '서울의 상징, 236m', icon: '🗼' },
  { name: '롯데월드타워', lat: 37.5126, lon: 127.1026, desc: '555m, 한국 최고층', icon: '🏢' },
  { name: '63빌딩', lat: 37.5194, lon: 126.9404, desc: '여의도 금빛 랜드마크, 249m', icon: '🏗️' },
  { name: 'DDP 동대문', lat: 37.5673, lon: 127.0095, desc: '자하 하디드 미래 건축', icon: '🏛️' },
  // 고궁/유적
  { name: '경복궁', lat: 37.5796, lon: 126.9770, desc: '조선 왕궁, 600년 역사', icon: '🏯' },
  { name: '창덕궁', lat: 37.5794, lon: 126.9910, desc: '유네스코 세계유산', icon: '🏮' },
  { name: '덕수궁', lat: 37.5658, lon: 126.9751, desc: '시청 옆 근대 궁궐', icon: '🏛️' },
  { name: '종묘', lat: 37.5742, lon: 126.9943, desc: '조선왕조 신주 모신 곳', icon: '⛩️' },
  // 자연
  { name: '한강', lat: 37.5283, lon: 126.9346, desc: '서울 중심 강', icon: '🌊' },
  { name: '북한산', lat: 37.6584, lon: 126.9780, desc: '서울 국립공원, 836m', icon: '⛰️' },
  { name: '관악산', lat: 37.4425, lon: 126.9637, desc: '서울 남쪽 산, 632m', icon: '🏔️' },
  { name: '한강 반포대교', lat: 37.5133, lon: 126.9956, desc: '달빛무지개 분수', icon: '🌈' },
  { name: '서울숲', lat: 37.5445, lon: 127.0374, desc: '뚝섬 자연 공원', icon: '🌳' },
  // 문화/관광
  { name: '여의도', lat: 37.5219, lon: 126.9245, desc: '국회, 금융 중심지', icon: '🏙️' },
  { name: '잠실올림픽공원', lat: 37.5209, lon: 127.1153, desc: '88 올림픽 기념', icon: '🏟️' },
  { name: '코엑스', lat: 37.5126, lon: 127.0590, desc: '강남 대형 전시/쇼핑', icon: '🛍️' },
  { name: '홍대거리', lat: 37.5563, lon: 126.9236, desc: '젊음의 문화 거리', icon: '🎸' },
  { name: '명동', lat: 37.5636, lon: 126.9826, desc: '쇼핑 중심지', icon: '🛒' },
  { name: '강남역', lat: 37.4979, lon: 127.0276, desc: '강남 중심', icon: '🌃' },
  { name: '이태원', lat: 37.5344, lon: 126.9945, desc: '국제 거리', icon: '🌍' },
  { name: '청와대', lat: 37.5866, lon: 126.9746, desc: '전 대통령 관저', icon: '🏛️' },
  { name: '광화문', lat: 37.5759, lon: 126.9770, desc: '경복궁 정문', icon: '🏮' },
  { name: '인사동', lat: 37.5714, lon: 126.9854, desc: '전통 문화 거리', icon: '🎨' },
  { name: '동대문시장', lat: 37.5670, lon: 127.0080, desc: '24시간 의류 시장', icon: '🧥' },
  { name: '남대문시장', lat: 37.5590, lon: 126.9775, desc: '600년 역사 시장', icon: '🛍️' },
  { name: '청계천', lat: 37.5695, lon: 126.9784, desc: '도심 속 하천', icon: '💧' },
  { name: '북촌한옥마을', lat: 37.5826, lon: 126.9848, desc: '전통 한옥 보존 지구', icon: '🏘️' },
  { name: '서울월드컵경기장', lat: 37.5683, lon: 126.8977, desc: '2002 월드컵 개최지', icon: '⚽' },
  { name: '올림픽공원 평화의문', lat: 37.5204, lon: 127.1279, desc: '88 올림픽 상징', icon: '🕊️' },
  { name: '석촌호수', lat: 37.5097, lon: 127.1044, desc: '잠실 도심 호수', icon: '🏞️' }
];

const JEJU_POIS_DATA = [
  // 산/자연
  { name: '한라산', lat: 33.3617, lon: 126.5292, desc: '제주 상징, 1947m', icon: '🏔️' },
  { name: '한라산 백록담', lat: 33.3617, lon: 126.5333, desc: '분화구 호수', icon: '🌋' },
  { name: '산굼부리', lat: 33.4360, lon: 126.6875, desc: '원형 분화구', icon: '🌋' },
  // 해안 명소
  { name: '성산일출봉', lat: 33.4583, lon: 126.9403, desc: '유네스코 세계자연유산', icon: '🌅' },
  { name: '주상절리', lat: 33.2378, lon: 126.4253, desc: '해안 기둥 바위', icon: '🪨' },
  { name: '외돌개', lat: 33.2316, lon: 126.5117, desc: '바다 위 독립 바위', icon: '🗻' },
  { name: '섭지코지', lat: 33.4259, lon: 126.9309, desc: '드라마 촬영지', icon: '🏖️' },
  // 폭포
  { name: '천지연폭포', lat: 33.2456, lon: 126.5548, desc: '22m 폭포', icon: '💧' },
  { name: '정방폭포', lat: 33.2444, lon: 126.5721, desc: '동양 유일 바다 폭포', icon: '🌊' },
  { name: '천제연폭포', lat: 33.2528, lon: 126.4138, desc: '3단 폭포', icon: '💦' },
  // 섬
  { name: '우도', lat: 33.5000, lon: 126.9500, desc: '소 모양 섬', icon: '🐄' },
  { name: '마라도', lat: 33.1183, lon: 126.2678, desc: '한국 최남단 섬', icon: '🏝️' },
  // 해수욕장
  { name: '협재해수욕장', lat: 33.3939, lon: 126.2397, desc: '에메랄드 해변', icon: '🏖️' },
  { name: '함덕해수욕장', lat: 33.5433, lon: 126.6692, desc: '제주 동쪽 해변', icon: '🏖️' },
  { name: '중문색달해수욕장', lat: 33.2467, lon: 126.4097, desc: '제주 남쪽 서핑 명소', icon: '🏄' },
  // 관광
  { name: '서귀포항', lat: 33.2397, lon: 126.5615, desc: '서귀포 중심 항구', icon: '⚓' },
  { name: '제주항', lat: 33.5175, lon: 126.5439, desc: '제주시 관문', icon: '🚢' },
  { name: '오설록 티뮤지엄', lat: 33.3058, lon: 126.2897, desc: '녹차밭 테마파크', icon: '🍵' },
  { name: '동문시장', lat: 33.5125, lon: 126.5272, desc: '제주 최대 재래시장', icon: '🛍️' },
  { name: '카멜리아힐', lat: 33.2772, lon: 126.3483, desc: '동백꽃 정원', icon: '🌺' }
];
