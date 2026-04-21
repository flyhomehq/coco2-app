/**
 * 호스트 광고 관리 API
 * - 위치 기반 광고 저장/조회
 * - 호스트 대시보드에서 추가/수정/삭제
 * - 사용자 비행 중 근처 광고 자동 조회
 */

const express = require('express');
const fs = require('fs');
const path = require('path');

const ADS_FILE = path.join(__dirname, 'ads-data.json');

// 초기 광고 데이터 (샘플)
const DEFAULT_ADS = [
  {
    id: 'seoul_tower_eve',
    title_ko: '남산타워 야경 관람',
    title_en: 'Namsan Tower Night View',
    title_ja: '南山タワー夜景観賞',
    title_zh: '南山塔夜景',
    desc_ko: '야간 예약 20% 할인',
    desc_en: '20% off night reservations',
    desc_ja: '夜間予約20%OFF',
    desc_zh: '夜间预订8折',
    lat: 37.5512, lon: 126.9882, radius: 2,
    image: '',
    link: 'https://www.seoultower.co.kr',
    sponsor: '서울타워',
    startDate: '2026-04-01', endDate: '2026-12-31',
    priority: 5, enabled: true
  },
  {
    id: 'hangang_cruise',
    title_ko: '한강 유람선',
    title_en: 'Hangang River Cruise',
    title_ja: '漢江クルーズ',
    title_zh: '汉江游船',
    desc_ko: '오늘 밤 8시 불꽃놀이 특별편',
    desc_en: 'Fireworks special tonight 8pm',
    desc_ja: '今夜8時花火特別便',
    desc_zh: '今晚8点焰火特别班',
    lat: 37.5283, lon: 126.9346, radius: 3,
    image: '',
    link: 'https://www.hcruise.co.kr',
    sponsor: '한강유람선',
    startDate: '2026-04-01', endDate: '2026-12-31',
    priority: 4, enabled: true
  },
  {
    id: 'jeju_tea',
    title_ko: '오설록 티 뮤지엄',
    title_en: 'OSulloc Tea Museum',
    title_ja: 'オソロック茶博物館',
    title_zh: 'OSulloc茶博物馆',
    desc_ko: '녹차밭 투어 + 시음 무료',
    desc_en: 'Free tea tasting with farm tour',
    desc_ja: '茶畑ツアー+試飲無料',
    desc_zh: '茶园参观+免费品茶',
    lat: 33.3058, lon: 126.2897, radius: 2,
    image: '',
    link: 'https://www.osulloc.com',
    sponsor: '오설록',
    startDate: '2026-04-01', endDate: '2026-12-31',
    priority: 5, enabled: true
  }
];

function loadAds() {
  try {
    if (fs.existsSync(ADS_FILE)) {
      return JSON.parse(fs.readFileSync(ADS_FILE, 'utf-8'));
    }
  } catch (e) { console.error('[Ads] Load error:', e); }
  // 없으면 기본값으로 저장
  fs.writeFileSync(ADS_FILE, JSON.stringify(DEFAULT_ADS, null, 2));
  return DEFAULT_ADS;
}

function saveAds(ads) {
  try {
    fs.writeFileSync(ADS_FILE, JSON.stringify(ads, null, 2));
    return true;
  } catch (e) { console.error('[Ads] Save error:', e); return false; }
}

// 거리 계산 (km)
function distanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 +
            Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function createAdsApi() {
  const router = express.Router();

  // GET /api/ads — 전체 광고 목록 (호스트 대시보드용)
  router.get('/ads', (req, res) => {
    res.json(loadAds());
  });

  // GET /api/ads/nearby?lat=37.5&lon=127.0 — 근처 광고 (비행 중)
  router.get('/ads/nearby', (req, res) => {
    const lat = parseFloat(req.query.lat);
    const lon = parseFloat(req.query.lon);
    if (isNaN(lat) || isNaN(lon)) return res.json([]);

    const now = new Date().toISOString().split('T')[0];
    const ads = loadAds().filter(ad => {
      if (!ad.enabled) return false;
      if (ad.startDate > now || ad.endDate < now) return false;
      const dist = distanceKm(lat, lon, ad.lat, ad.lon);
      return dist <= (ad.radius || 2);
    });
    // 우선순위로 정렬
    ads.sort((a, b) => (b.priority || 0) - (a.priority || 0));
    res.json(ads);
  });

  // POST /api/ads — 광고 추가/수정 (호스트용)
  router.post('/ads', (req, res) => {
    const ads = loadAds();
    const ad = req.body;
    if (!ad.id) ad.id = 'ad_' + Date.now();
    const idx = ads.findIndex(a => a.id === ad.id);
    if (idx >= 0) ads[idx] = ad;
    else ads.push(ad);
    saveAds(ads);
    res.json({ success: true, id: ad.id });
  });

  // DELETE /api/ads/:id — 광고 삭제
  router.delete('/ads/:id', (req, res) => {
    const ads = loadAds().filter(a => a.id !== req.params.id);
    saveAds(ads);
    res.json({ success: true });
  });

  return router;
}

module.exports = { createAdsApi };
