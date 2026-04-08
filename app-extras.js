/**
 * CockpitOS — 부가 기능 (ApiLock, QuizEngine, GalagaEngine)
 * script.js에서 분리됨 (2026-04-08)
 */

// ── API 키 잠금 모듈 ──────────────────────────────────
const ApiLock = {
  PIN_KEY: 'cpos_api_pin',
  _locked: true,
  init() {
    const pin = localStorage.getItem(this.PIN_KEY);
    if (!pin) {
      // PIN 미설정 → 잠금 없이 사용, 배지 숨김
      this._locked = false;
      const b = document.getElementById('api-lock-badge');
      if (b) b.style.display = 'none';
    } else {
      this.lock();
    }
    // API 키 상태 표시
    const k = localStorage.getItem('cpos_api_key') || '';
    const st = document.getElementById('api-key-status');
    if (st) { st.textContent = k ? '✅ 입력됨' : '미입력'; st.style.color = k ? '#4ade80' : 'rgba(255,255,255,0.4)'; }
    if (k) { const inp = document.getElementById('api-key-input'); if (inp) inp.value = k; }
  },
  lock() {
    this._locked = true;
    const sec = document.getElementById('api-key-section');
    const badge = document.getElementById('api-lock-badge');
    if (sec) sec.classList.add('api-locked');
    if (badge) { badge.textContent = '🔒 잠김'; badge.className = 'api-lock-badge locked'; }
  },
  unlock() {
    this._locked = false;
    const sec = document.getElementById('api-key-section');
    const badge = document.getElementById('api-lock-badge');
    if (sec) sec.classList.remove('api-locked');
    if (badge) { badge.textContent = '🔓 수정 가능'; badge.className = 'api-lock-badge unlocked'; }
  },
  toggle() {
    if (!this._locked) { this.lock(); return; }
    const pin = localStorage.getItem(this.PIN_KEY);
    if (!pin) {
      // PIN 없으면 바로 해제
      this.unlock(); return;
    }
    // PIN 모달 열기
    document.getElementById('lock-modal').classList.add('open');
    document.getElementById('lock-pin-input').value = '';
    document.getElementById('lock-pin-error').textContent = '';
    setTimeout(() => document.getElementById('lock-pin-input').focus(), 100);
  },
  confirm() {
    const entered = document.getElementById('lock-pin-input').value.trim();
    const saved = localStorage.getItem(this.PIN_KEY);
    if (entered === saved) {
      this.closeModal();
      this.unlock();
    } else {
      document.getElementById('lock-pin-error').textContent = '❌ PIN이 틀렸습니다';
      document.getElementById('lock-pin-input').value = '';
    }
  },
  closeModal() {
    document.getElementById('lock-modal').classList.remove('open');
  },
  setPin(pin) {
    localStorage.setItem(this.PIN_KEY, pin);
    this.lock();
  }
};

// PIN 입력창 Enter 키 지원
document.addEventListener('DOMContentLoaded', () => {
  const pinInp = document.getElementById('lock-pin-input');
  if (pinInp) pinInp.addEventListener('keydown', e => { if (e.key === 'Enter') ApiLock.confirm(); });
  ApiLock.init();
});

// data-action 이벤트 핸들러 (구버전 패턴 연결)
document.addEventListener('click', e => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const act = el.dataset.action;
  if (act === 'close-settings') App.closeSettings();
  else if (act === 'toggle-acc') {
    const sec = document.getElementById(el.dataset.acc);
    if (sec) sec.classList.toggle('open');
  }
  else if (act === 'set-lang') {
    // 설정에서 언어 선택 — 읽기 전용 안내
    App.toast({ko:'🌐 언어는 첫 화면에서 변경할 수 있습니다',en:'🌐 Change language on the first screen',ja:'🌐 言語は最初の画面で変更できます',zh:'🌐 请在首页更改语言'}[App.lang]);
  }
  else if (act === 'voice-on') { App.setTTS && App.setTTS(true); document.getElementById('tts-on').classList.add('picked'); document.getElementById('tts-off').classList.remove('picked'); }
  else if (act === 'voice-off') { App.setTTS && App.setTTS(false); document.getElementById('tts-off').classList.add('picked'); document.getElementById('tts-on').classList.remove('picked'); }
  else if (act === 'mic-on') { document.getElementById('mic-on').classList.add('picked'); document.getElementById('mic-off').classList.remove('picked'); }
  else if (act === 'mic-off') { document.getElementById('mic-off').classList.add('picked'); document.getElementById('mic-on').classList.remove('picked'); }
  else if (act === 'gesture-on') { App.setGesture && App.setGesture(true); document.getElementById('gesture-on').classList.add('picked'); document.getElementById('gesture-off').classList.remove('picked'); }
  else if (act === 'gesture-off') { App.setGesture && App.setGesture(false); document.getElementById('gesture-off').classList.add('picked'); document.getElementById('gesture-on').classList.remove('picked'); }
  else if (act === 'save-api-key') { App.saveApiKey && App.saveApiKey(); }
  else if (act === 'share-app') { App.shareApp && App.shareApp(); }
  else if (act === 'show-qr') { App.showQR && App.showQR(); }
  else if (act === 'open-lounge') { App.openLounge && App.openLounge(); }
  else if (act === 'close-lounge') { App.closeLounge && App.closeLounge(); }
  else if (act === 'open-host') { App.openHost && App.openHost(); }
  else if (act === 'close-host') { App.closeHost && App.closeHost(); }
  else if (act === 'toggle-qa') { App.toggleQA && App.toggleQA(); }
  else if (act === 'start-pitch') { App.goTo('p5'); App.closeHost(); App.closeSettings(); }
  else if (act === 'toggle-pip-fullscreen') { App.togglePip(); App.closeHost(); App.closeSettings(); }
  else if (act === 'demo-ad') { App.toast('🎯 ' + el.querySelector('.label')?.textContent + ' 광고 시연'); App.closeHost(); }
  else if (act === 'lounge-quiz') { App.closeLounge(); QuizEngine.start(App.lang); }
  else if (act === 'v11-placeholder') { App.toast('📦 v1.1에서 추가 예정입니다'); }
});

window.addEventListener('keydown', e => {
  if (e.code === 'Escape') {
    document.getElementById('settings-panel').classList.remove('open');
    document.getElementById('host-panel')?.classList.remove('open');
    document.getElementById('lounge-panel')?.classList.remove('open');
    ApiLock.closeModal();
    App.closeMic();
    App.closePip();
    App.closeGuide();
    App.closeImgViewer();
    GalagaEngine.stop();
  }
});

window.addEventListener('load', () => {
  App.init();

  // 브라우저 뒤로가기 가로채기 — 앱 내부 뒤로가기로 동작
  // 페이지 스택을 history에 쌓아서 항상 앱 내부에서 이동
  // 뒤로가기: 앱 내부 이동만, 탈출 완전 차단
  // 1) history 스택을 충분히 쌓음
  for (let i = 0; i < 50; i++) history.pushState({}, '', location.href);
  // 2) popstate 발생 시 goBack + 스택 보충
  window.addEventListener('popstate', () => {
    if (App.currentPage !== 'p1') App.goBack();
    for (let i = 0; i < 3; i++) history.pushState({}, '', location.href);
  });

  // 스와이프 제스처로 페이지 이동 (테블릿/핸드폰)
  let _swipeStartX = 0, _swipeStartY = 0;
  document.addEventListener('touchstart', e => {
    _swipeStartX = e.touches[0].clientX;
    _swipeStartY = e.touches[0].clientY;
  }, {passive:true});
  document.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - _swipeStartX;
    const dy = e.changedTouches[0].clientY - _swipeStartY;
    // 수평 스와이프가 수직보다 크고, 최소 80px 이동
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 80) {
      if (dx > 0) {
        // 오른쪽 스와이프 → 뒤로가기
        App.goBack();
      }
    }
  }, {passive:true});

  // 음성 질문창 드래그 이동 (좌우+상하)
  const vb = document.getElementById('voice-box');
  if (vb) {
    let dragging = false, startX = 0, startY = 0, startLeft = 0, startTop = 0;
    const header = vb.querySelector('.vb-header');
    if (header) {
      header.style.cursor = 'move';
      const startDrag = (cx, cy) => {
        dragging = true;
        const rect = vb.getBoundingClientRect();
        startX = cx; startY = cy;
        startLeft = rect.left; startTop = rect.top;
        vb.style.left = rect.left + 'px';
        vb.style.top = rect.top + 'px';
        vb.style.bottom = 'auto';
        vb.style.transform = 'none';
      };
      const moveDrag = (cx, cy) => {
        if (!dragging) return;
        const dx = cx - startX, dy = cy - startY;
        vb.style.left = Math.max(0, Math.min(window.innerWidth - 100, startLeft + dx)) + 'px';
        vb.style.top = Math.max(0, Math.min(window.innerHeight - 100, startTop + dy)) + 'px';
      };
      const endDrag = () => { dragging = false; };
      header.addEventListener('mousedown', e => { startDrag(e.clientX, e.clientY); e.preventDefault(); });
      document.addEventListener('mousemove', e => moveDrag(e.clientX, e.clientY));
      document.addEventListener('mouseup', endDrag);
      header.addEventListener('touchstart', e => { startDrag(e.touches[0].clientX, e.touches[0].clientY); }, {passive:true});
      document.addEventListener('touchmove', e => { if(dragging) moveDrag(e.touches[0].clientX, e.touches[0].clientY); }, {passive:true});
      document.addEventListener('touchend', endDrag);
    }
  }
});

  // 마이크/중지 버튼 드래그 이동
  const micWrap = document.getElementById('mic-wrap');
  if (micWrap) {
    let mDrag = false, mStartX = 0, mStartY = 0, mLeft = 0, mTop = 0;
    const mStart = (cx, cy) => {
      mDrag = true;
      const r = micWrap.getBoundingClientRect();
      mStartX = cx - r.left; mStartY = cy - r.top;
      micWrap.style.right = 'auto';
      micWrap.style.bottom = 'auto';
      micWrap.style.left = r.left + 'px';
      micWrap.style.top = r.top + 'px';
    };
    const mMove = (cx, cy) => {
      if (!mDrag) return;
      micWrap.style.left = Math.max(0, cx - mStartX) + 'px';
      micWrap.style.top = Math.max(0, cy - mStartY) + 'px';
    };
    const mEnd = () => { mDrag = false; };
    micWrap.addEventListener('mousedown', e => { if (e.target === micWrap) { mStart(e.clientX, e.clientY); e.preventDefault(); }});
    document.addEventListener('mousemove', e => mMove(e.clientX, e.clientY));
    document.addEventListener('mouseup', mEnd);
    micWrap.addEventListener('touchstart', e => { if (e.target === micWrap) mStart(e.touches[0].clientX, e.touches[0].clientY); }, {passive:true});
    document.addEventListener('touchmove', e => { if(mDrag) mMove(e.touches[0].clientX, e.touches[0].clientY); }, {passive:true});
    document.addEventListener('touchend', mEnd);
  }

// 페이지 떠날 때 음성 즉시 중단
window.addEventListener('beforeunload', (e) => {
  window.speechSynthesis.cancel();
  // 모바일에서 앱 탈출 방지
  if (App.currentPage !== 'p1') {
    e.preventDefault();
    e.returnValue = '';
  }
});
window.addEventListener('pagehide', () => {
  window.speechSynthesis.cancel();
});

// ════ QuizEngine — 비행 퀴즈 ════
const QuizEngine = {
  _questions: {
    ko: [
      {q:'세스나 172는 어떤 비행기인가요?', o:['전투기','소형 경비행기','대형 여객기','헬리콥터'], a:1},
      {q:'이륙할 때 조종간을 어느 방향으로?', o:['앞으로 민다','뒤로 당긴다','좌우로 돌린다','그대로 둔다'], a:1},
      {q:'비행기의 속도를 알려주는 계기는?', o:['고도계','방향계','속도계','승강계'], a:2},
      {q:'비행기가 하늘을 나는 힘의 이름은?', o:['중력','마찰력','양력','추력'], a:2},
      {q:'착륙 시 파일럿이 먼저 하는 것은?', o:['엔진 출력 줄이기','날개 분리','비상구 열기','기내 방송'], a:0},
      {q:'비행기 연료는 주로 어디에 저장?', o:['꼬리','조종석','날개 안','바퀴'], a:2},
      {q:'고도계는 무엇을 알려주나요?', o:['속도','높이','방향','연료량'], a:1},
      {q:'활주로에서 이륙 전 확인하는 것은?', o:['영화 목록','엔진 RPM','좌석 번호','화장실'], a:1},
      {q:'비행기 방향을 바꾸는 조종면은?', o:['에일러론','프로펠러','랜딩기어','안테나'], a:0},
      {q:'MSFS는 무엇의 약자인가요?', o:['My Super Fast Ship','Microsoft Flight Simulator','Main System Flight Safe','Multi Screen Flying System'], a:1},
      {q:'자세계(AI)는 무엇을 보여주나요?', o:['비행기의 기울기','엔진 온도','연료량','승객 수'], a:0},
      {q:'VOR은 무엇에 사용되나요?', o:['음식 주문','항법(길찾기)','엔진 시동','착륙 브레이크'], a:1},
      {q:'비행기가 추락하면 CockpitOS에서는?', o:['게임 오버','타임머신으로 되돌리기','전원 끄기','처음부터 재설치'], a:1},
      {q:'CockpitOS의 AI 교관 이름은?', o:['시리','코코','알렉사','빅스비'], a:1},
      {q:'PIP 카메라의 주요 기능은?', o:['셀카 찍기','계기판 촬영 후 AI 분석','영화 보기','화상 통화'], a:1},
    ],
    en: [
      {q:'What type of aircraft is Cessna 172?', o:['Fighter jet','Light aircraft','Jumbo jet','Helicopter'], a:1},
      {q:'Which way do you pull the yoke for takeoff?', o:['Push forward','Pull back','Turn sideways','Leave it'], a:1},
      {q:'Which instrument shows airspeed?', o:['Altimeter','Heading indicator','Airspeed indicator','VSI'], a:2},
      {q:'What force makes airplanes fly?', o:['Gravity','Friction','Lift','Drag'], a:2},
      {q:'What is MSFS?', o:['My Super Fast Ship','Microsoft Flight Simulator','Main System Flight Safe','Multi Screen Flying System'], a:1},
      {q:'What does CockpitOS AI instructor do?', o:['Cook food','Teach flying','Play music','Drive cars'], a:1},
    ],
  },
  _current: [], _idx:0, _score:0, _total:5, _active:false,

  start(lang) {
    const pool = this._questions[lang] || this._questions.ko;
    // 랜덤 5문제 선택
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    this._current = shuffled.slice(0, this._total);
    this._idx = 0; this._score = 0; this._active = true;
    this._showQuestion();
  },

  _showQuestion() {
    const panel = document.getElementById('drawer-panel');
    const content = document.getElementById('drawer-content');
    if (!panel || !content) return;
    const q = this._current[this._idx];
    if (!q) { this._showResult(); return; }
    let html = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><div class="dsec-title" style="margin:0">❓ Quiz ${this._idx+1}/${this._total} (점수: ${this._score})</div><button onclick="document.getElementById('drawer-panel').classList.remove('show');QuizEngine._active=false" style="background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);border-radius:8px;color:#fff;font-size:12px;padding:4px 10px;cursor:pointer">✕ 닫기</button></div>`;
    html += `<div style="font-size:15px;font-weight:700;color:#fff;margin-bottom:12px;line-height:1.5">${q.q}</div>`;
    q.o.forEach((opt, i) => {
      html += `<div class="card-item" onclick="QuizEngine.answer(${i})" style="cursor:pointer">
        <div class="fi-icon" style="font-size:16px;font-weight:900;color:#F5A623;width:28px;text-align:center">${String.fromCharCode(65+i)}</div>
        <div class="fi-text"><div class="ft">${opt}</div></div>
      </div>`;
    });
    content.innerHTML = html;
    panel.classList.add('show');
    document.querySelectorAll('.drawer-btn').forEach(b => b.classList.remove('active'));
  },

  answer(idx) {
    const q = this._current[this._idx];
    const correct = idx === q.a;
    if (correct) this._score++;
    // 정답/오답 표시
    const msg = correct
      ? {ko:'✅ 정답! 잘하셨어요!',en:'✅ Correct!',ja:'✅ 正解！',zh:'✅ 正确！'}[App.lang] || '✅'
      : {ko:`❌ 오답! 정답은 "${q.o[q.a]}" 입니다.`,en:`❌ Wrong! Answer: "${q.o[q.a]}"`,ja:`❌ 不正解！答え: "${q.o[q.a]}"`,zh:`❌ 错误！答案: "${q.o[q.a]}"`}[App.lang] || '❌';
    App._say(msg);
    // 1.5초 후 다음 문제
    setTimeout(() => { this._idx++; this._showQuestion(); }, 2000);
  },

  _showResult() {
    const content = document.getElementById('drawer-content');
    const pass = this._score >= 4;
    const emoji = pass ? '🎖' : '📚';
    const msg = pass
      ? {ko:`${emoji} 축하합니다! ${this._score}/${this._total} 정답!\n명예 조종사 자격 획득!`,en:`${emoji} Congratulations! ${this._score}/${this._total}!\nHonorary Pilot!`}[App.lang] || `${emoji} ${this._score}/${this._total}`
      : {ko:`${emoji} ${this._score}/${this._total} 정답. 다시 도전해보세요!`,en:`${emoji} ${this._score}/${this._total}. Try again!`}[App.lang] || `${emoji} ${this._score}/${this._total}`;
    let html = `<div style="text-align:center;padding:20px">
      <div style="font-size:48px;margin-bottom:12px">${pass?'🏆':'📖'}</div>
      <div style="font-size:18px;font-weight:700;color:#FFD700;margin-bottom:8px;white-space:pre-line">${msg}</div>
      <button onclick="QuizEngine.start(App.lang)" style="background:#F5A623;border:none;border-radius:12px;color:#1a0800;font-size:14px;font-weight:700;padding:10px 20px;cursor:pointer;margin-top:10px">🔄 다시 도전</button>
    </div>`;
    content.innerHTML = html;
    App._say(msg.replace(/\n/g,' '));
    this._active = false;
  },
};

// ════ GalagaEngine — 추억의 갤러그 ════
const GalagaEngine = {
  _raf:null, _ctx:null, _W:360, _H:600,
  _p:null, _bullets:[], _enemies:[], _eBullets:[],
  _score:0, _lives:3, _level:1, _over:false, _keys:{}, _tx:null,

  start(){
    const el=document.getElementById('galaga-overlay');
    if(el){ el.style.display='flex'; }
    const c=document.getElementById('galaga-canvas');
    if(!c) return;
    c.width=this._W; c.height=this._H;
    const sw=Math.min(this._W, window.innerWidth-20);
    c.style.width=sw+'px'; c.style.height=(sw*this._H/this._W)+'px';
    this._ctx=c.getContext('2d');
    this._reset(); this._bind(); this._loop();
  },

  stop(){
    const el=document.getElementById('galaga-overlay');
    if(el){ el.style.display='none'; }
    cancelAnimationFrame(this._raf);
    this._unbind();
  },

  _reset(){
    this._score=0; this._lives=3; this._level=1; this._over=false;
    this._bullets=[]; this._eBullets=[];
    this._p={x:this._W/2, y:this._H-55, cool:0};
    this._spawn();
  },

  _spawn(){
    this._enemies=[];
    for(let r=0;r<4;r++) for(let c=0;c<8;c++)
      this._enemies.push({x:32+c*38,y:44+r*36,alive:true,t:r<1?2:r<2?1:0,dx:0.7+this._level*0.1,st:Math.random()*180});
  },

  _loop(){ this._raf=requestAnimationFrame(()=>this._loop()); this._update(); this._draw(); },

  _update(){
    if(this._over) return;
    const p=this._p;
    if(this._keys['ArrowLeft']) p.x=Math.max(14,p.x-5);
    if(this._keys['ArrowRight']) p.x=Math.min(this._W-14,p.x+5);
    if(this._tx!==null) p.x+=(this._tx-p.x)*0.15;
    if(p.cool>0) p.cool--;
    this._bullets=this._bullets.filter(b=>{b.y-=9;return b.y>0;});
    this._eBullets=this._eBullets.filter(b=>{b.y+=4;return b.y<this._H;});
    let flip=false;
    this._enemies.forEach(e=>{
      if(!e.alive) return;
      e.x+=e.dx; if(e.x>this._W-16||e.x<16) flip=true;
      e.st--; if(e.st<=0){this._eBullets.push({x:e.x,y:e.y+10});e.st=70+Math.random()*100;}
    });
    if(flip) this._enemies.forEach(e=>{if(e.alive){e.dx*=-1;e.y+=10;}});
    this._bullets.forEach(b=>{
      this._enemies.forEach(e=>{
        if(!e.alive) return;
        if(Math.abs(b.x-e.x)<14&&Math.abs(b.y-e.y)<11){
          e.alive=false;b.y=-99;this._score+=e.t===2?150:e.t===1?80:40;
        }
      });
    });
    this._eBullets.forEach(b=>{
      if(Math.abs(b.x-p.x)<12&&Math.abs(b.y-p.y)<12){
        b.y=this._H+9;this._lives--;if(this._lives<=0)this._over=true;
      }
    });
    if(this._enemies.every(e=>!e.alive)){this._level++;this._spawn();}
  },

  _draw(){
    const ctx=this._ctx;
    ctx.fillStyle='#000';ctx.fillRect(0,0,this._W,this._H);
    ctx.fillStyle='rgba(255,255,255,0.25)';
    for(let i=0;i<35;i++) ctx.fillRect((i*97+this._score)%this._W,(i*61+this._score*0.3)%this._H,1,1);
    const p=this._p;
    ctx.fillStyle='#00ff88';
    ctx.beginPath();ctx.moveTo(p.x,p.y-12);ctx.lineTo(p.x-10,p.y+10);ctx.lineTo(p.x+10,p.y+10);ctx.closePath();ctx.fill();
    ctx.fillStyle='#FFD700';
    this._bullets.forEach(b=>ctx.fillRect(b.x-2,b.y-5,4,10));
    ctx.fillStyle='#ff4444';
    this._eBullets.forEach(b=>ctx.fillRect(b.x-2,b.y,4,10));
    this._enemies.forEach(e=>{
      if(!e.alive) return;
      ctx.fillStyle=e.t===2?'#ff00ff':e.t===1?'#ff8800':'#00ccff';
      ctx.fillRect(e.x-10,e.y-8,20,16);
      ctx.fillStyle='#000';ctx.fillRect(e.x-5,e.y-3,3,3);ctx.fillRect(e.x+2,e.y-3,3,3);
    });
    ctx.fillStyle='#FFD700';ctx.font='bold 13px monospace';
    ctx.fillText('SCORE:'+this._score,8,18);
    ctx.fillText('LV:'+this._level,this._W/2-20,18);
    ctx.fillText('♥'.repeat(this._lives),this._W-50,18);
    if(this._over){
      ctx.fillStyle='rgba(0,0,0,0.65)';ctx.fillRect(0,0,this._W,this._H);
      ctx.fillStyle='#ff4444';ctx.font='bold 34px monospace';ctx.textAlign='center';
      ctx.fillText('GAME OVER',this._W/2,this._H/2-16);
      ctx.fillStyle='#FFD700';ctx.font='bold 17px monospace';
      ctx.fillText('SCORE:'+this._score,this._W/2,this._H/2+18);
      ctx.fillStyle='#fff';ctx.font='13px monospace';
      ctx.fillText('탭하면 재시작',this._W/2,this._H/2+50);ctx.textAlign='left';
    }
  },

  _shoot(){ if(this._p.cool>0) return; this._bullets.push({x:this._p.x,y:this._p.y-12}); this._p.cool=15; },

  _bind(){
    this._k=(e)=>{this._keys[e.key]=e.type==='keydown';};
    this._sp=(e)=>{if(e.code==='Space'){e.preventDefault();this._shoot();}};
    this._tm=(e)=>{e.preventDefault();if(e.touches.length){const r=document.getElementById('galaga-canvas').getBoundingClientRect();this._tx=(e.touches[0].clientX-r.left)*(this._W/r.width);}};
    this._te=(e)=>{this._tx=null;if(this._over){this._reset();}else{this._shoot();}};
    this._cl=()=>{if(this._over)this._reset();else this._shoot();};
    window.addEventListener('keydown',this._k);window.addEventListener('keyup',this._k);window.addEventListener('keydown',this._sp);
    const c=document.getElementById('galaga-canvas');
    c.addEventListener('touchmove',this._tm,{passive:false});c.addEventListener('touchend',this._te);c.addEventListener('click',this._cl);
  },

  _unbind(){
    window.removeEventListener('keydown',this._k);window.removeEventListener('keyup',this._k);window.removeEventListener('keydown',this._sp);
    const c=document.getElementById('galaga-canvas');
    if(c){c.removeEventListener('touchmove',this._tm);c.removeEventListener('touchend',this._te);c.removeEventListener('click',this._cl);}
  },
};