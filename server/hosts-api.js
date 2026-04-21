/**
 * ═══════════════════════════════════════════════════════════════════
 *  CockpitOS — 호스트 & 방 관리 API (Multi-tenant)
 * ═══════════════════════════════════════════════════════════════════
 *
 * 역할:
 *   - 호스트 계정 관리 (로그인, 인증)
 *   - 방(Room) 소유권 관리
 *   - 호스트별 데이터 격리 (Multi-tenant)
 *   - 방 상태 실시간 추적
 *
 * 데이터 구조:
 *   hosts.json: 호스트 계정 목록
 *   rooms.json: 방 목록 + 소유자 매핑
 *   sessions.json: 로그인 세션
 *
 * 간단 로그인 방식 (지금):
 *   - 이메일만으로 로그인 (MVP)
 *   - 실제 프로덕션: 비밀번호 + OAuth 추가
 *
 * 미래 개발자 가이드:
 *   - JWT 토큰 도입 (보안 강화)
 *   - 비밀번호 해싱 (bcrypt)
 *   - 2FA (이중 인증)
 *   - 세션 만료 관리
 *   - DB 전환 (JSON → PostgreSQL)
 *
 * ═══════════════════════════════════════════════════════════════════
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const HOSTS_FILE = path.join(__dirname, 'hosts-data.json');
const ROOMS_FILE = path.join(__dirname, 'rooms-data.json');

// 기본 호스트/방 데이터 (샘플)
const DEFAULT_HOSTS = [
  {
    id: 'host-1',
    email: 'daeung@flyhome.com',
    name: '윤대웅',
    company: 'FLY:HOME 중랑점',
    phone: '010-0000-0001',
    role: 'owner', // owner, partner, staff
    createdAt: '2026-04-01'
  },
  {
    id: 'host-2',
    email: 'partnerA@flyhome.com',
    name: '박파트너',
    company: 'FLY:HOME 부산점',
    phone: '010-0000-0002',
    role: 'partner',
    createdAt: '2026-05-01'
  }
];

const DEFAULT_ROOMS = [
  {
    id: 'room-1',
    ownerId: 'host-1',
    name: '2층 마스터룸',
    location: '서울 중랑구',
    pcMac: '00:00:00:00:00:01',
    pcIp: '192.168.1.101',
    msfsVersion: '2024',
    aircraft: 'Cessna 172',
    status: 'idle', // idle, booking, active, error
    currentGuest: null,
    flightActive: false
  },
  {
    id: 'room-2',
    ownerId: 'host-1',
    name: '2층 시티뷰',
    location: '서울 중랑구',
    pcMac: '00:00:00:00:00:02',
    pcIp: '192.168.1.102',
    msfsVersion: '2024',
    aircraft: 'Cessna 172',
    status: 'idle',
    currentGuest: null,
    flightActive: false
  },
  {
    id: 'room-3',
    ownerId: 'host-1',
    name: '3층 스위트',
    location: '서울 중랑구',
    pcMac: '00:00:00:00:00:03',
    pcIp: '192.168.1.103',
    msfsVersion: '2024',
    aircraft: 'Boeing 737',
    status: 'idle',
    currentGuest: null,
    flightActive: false
  },
  {
    id: 'room-4',
    ownerId: 'host-2',
    name: '해운대 뷰',
    location: '부산 해운대',
    pcMac: '00:00:00:00:00:04',
    pcIp: '192.168.1.104',
    msfsVersion: '2024',
    aircraft: 'Cessna 172',
    status: 'idle',
    currentGuest: null,
    flightActive: false
  }
];

// 세션 저장 (메모리 — 프로덕션은 Redis)
const sessions = new Map();

function loadJSON(file, defaults) {
  try {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch(e) {}
  fs.writeFileSync(file, JSON.stringify(defaults, null, 2));
  return defaults;
}

function saveJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * 요청의 호스트 ID 추출 (토큰 기반)
 */
function getHostId(req) {
  const token = req.headers.authorization?.replace('Bearer ', '') ||
                req.query.token ||
                req.cookies?.token;
  if (!token) return null;
  const session = sessions.get(token);
  return session?.hostId || null;
}

function createHostsApi() {
  const router = express.Router();

  // POST /api/hosts/login — 이메일 로그인 (MVP, 비밀번호 없음)
  router.post('/hosts/login', (req, res) => {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ error: 'email required' });

    const hosts = loadJSON(HOSTS_FILE, DEFAULT_HOSTS);
    const host = hosts.find(h => h.email === email.toLowerCase().trim());
    if (!host) return res.status(401).json({ error: '등록되지 않은 이메일입니다' });

    // 세션 생성
    const token = generateToken();
    sessions.set(token, {
      hostId: host.id,
      email: host.email,
      loginAt: Date.now()
    });

    res.json({
      success: true,
      token,
      host: {
        id: host.id, email: host.email, name: host.name,
        company: host.company, role: host.role
      }
    });
  });

  // POST /api/hosts/logout
  router.post('/hosts/logout', (req, res) => {
    const token = req.headers.authorization?.replace('Bearer ', '') || req.query.token;
    if (token) sessions.delete(token);
    res.json({ success: true });
  });

  // GET /api/hosts/me — 현재 로그인된 호스트 정보
  router.get('/hosts/me', (req, res) => {
    const hostId = getHostId(req);
    if (!hostId) return res.status(401).json({ error: 'not logged in' });
    const hosts = loadJSON(HOSTS_FILE, DEFAULT_HOSTS);
    const host = hosts.find(h => h.id === hostId);
    if (!host) return res.status(404).json({ error: 'host not found' });
    res.json({ id: host.id, email: host.email, name: host.name, company: host.company, role: host.role });
  });

  // GET /api/rooms — 현재 호스트의 방만 반환 (격리!)
  router.get('/rooms', (req, res) => {
    const hostId = getHostId(req);
    if (!hostId) return res.status(401).json({ error: 'not logged in' });

    const rooms = loadJSON(ROOMS_FILE, DEFAULT_ROOMS);
    // owner면 자기 방만, admin이면 전체
    const myRooms = rooms.filter(r => r.ownerId === hostId);
    res.json(myRooms);
  });

  // GET /api/rooms/:id — 특정 방 상세 (소유자 검증)
  router.get('/rooms/:id', (req, res) => {
    const hostId = getHostId(req);
    if (!hostId) return res.status(401).json({ error: 'not logged in' });
    const rooms = loadJSON(ROOMS_FILE, DEFAULT_ROOMS);
    const room = rooms.find(r => r.id === req.params.id);
    if (!room) return res.status(404).json({ error: 'room not found' });
    if (room.ownerId !== hostId) return res.status(403).json({ error: 'access denied' });
    res.json(room);
  });

  // POST /api/rooms — 방 추가 (로그인한 호스트 소유로)
  router.post('/rooms', (req, res) => {
    const hostId = getHostId(req);
    if (!hostId) return res.status(401).json({ error: 'not logged in' });
    const rooms = loadJSON(ROOMS_FILE, DEFAULT_ROOMS);
    const room = { ...req.body, ownerId: hostId };
    if (!room.id) room.id = 'room-' + Date.now();
    room.status = room.status || 'idle';
    rooms.push(room);
    saveJSON(ROOMS_FILE, rooms);
    res.json({ success: true, room });
  });

  // PUT /api/rooms/:id — 방 수정 (소유자만)
  router.put('/rooms/:id', (req, res) => {
    const hostId = getHostId(req);
    if (!hostId) return res.status(401).json({ error: 'not logged in' });
    const rooms = loadJSON(ROOMS_FILE, DEFAULT_ROOMS);
    const idx = rooms.findIndex(r => r.id === req.params.id);
    if (idx < 0) return res.status(404).json({ error: 'not found' });
    if (rooms[idx].ownerId !== hostId) return res.status(403).json({ error: 'denied' });
    rooms[idx] = { ...rooms[idx], ...req.body, ownerId: hostId };
    saveJSON(ROOMS_FILE, rooms);
    res.json({ success: true });
  });

  // DELETE /api/rooms/:id
  router.delete('/rooms/:id', (req, res) => {
    const hostId = getHostId(req);
    if (!hostId) return res.status(401).json({ error: 'not logged in' });
    const rooms = loadJSON(ROOMS_FILE, DEFAULT_ROOMS);
    const room = rooms.find(r => r.id === req.params.id);
    if (!room) return res.status(404).json({ error: 'not found' });
    if (room.ownerId !== hostId) return res.status(403).json({ error: 'denied' });
    const filtered = rooms.filter(r => r.id !== req.params.id);
    saveJSON(ROOMS_FILE, filtered);
    res.json({ success: true });
  });

  return router;
}

module.exports = { createHostsApi, getHostId };
