// ─────────────────────────────────────────────
//  SHOOTING STAR  –  Game Engine
// ─────────────────────────────────────────────

const $ = id => document.getElementById(id);

// ── DOM refs ──
const setupScreen    = $('setup-screen');
const countdownScreen= $('countdown-screen');
const gameScreen     = $('game-screen');
const resultScreen   = $('result-screen');
const finalScreen    = $('final-screen');
const canvas         = $('game-canvas');
const ctx            = canvas.getContext('2d');

// ── Colour palette ──
const C = {
  bg:    '#0a0e1a',
  bg2:   '#0d1225',
  cyan:  '#00f5ff',
  pink:  '#ff2d78',
  white: '#e8eaf6',
  dim:   '#3a4060',
  gold:  '#ffd700',
};

// ── Game state ──
let players = [];      // [{name, score}]
let numPlayers = 2;
let currentPlayerIdx = 0;
let gameRunning = false;
let animId = null;

// ── Per-round state ──
let star, pipes, particles, bgStars;
let dist, frame, speed, pipeGap, pipeInterval, lastPipeFrame;
let isDead;

// ── Setup screen controls ──
const decBtn   = $('dec-players');
const incBtn   = $('inc-players');
const countEl  = $('player-count');
const p2Row    = $('p2-row');
const startBtn = $('start-btn');

decBtn.onclick = () => { numPlayers = Math.max(1, numPlayers - 1); updateSetup(); };
incBtn.onclick = () => { numPlayers = Math.min(4, numPlayers + 1); updateSetup(); };

function updateSetup() {
  countEl.textContent = numPlayers;
  p2Row.style.display = numPlayers >= 2 ? 'flex' : 'none';
  // add/remove extra player rows if ever extended
}
updateSetup();

startBtn.onclick = () => {
  const p1 = ($('name-p1').value.trim().toUpperCase() || 'PLAYER 1');
  const p2 = ($('name-p2').value.trim().toUpperCase() || 'PLAYER 2');
  players = [];
  for (let i = 0; i < numPlayers; i++) {
    players.push({ name: [p1, p2, 'P3', 'P4'][i] || `P${i+1}`, score: null });
  }
  currentPlayerIdx = 0;
  beginRound();
};

// ── Play Again / New Game ──
$('next-turn-btn').onclick = () => {
  currentPlayerIdx++;
  beginRound();
};
$('play-again-btn').onclick = () => {
  players.forEach(p => p.score = null);
  currentPlayerIdx = 0;
  beginRound();
};
$('new-game-btn').onclick = () => {
  showScreen(setupScreen);
};

// ── Screen helper ──
function showScreen(el) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  el.classList.add('active');
}

// ─────────────────────────────────────────────
//  ROUND START + COUNTDOWN
// ─────────────────────────────────────────────
function beginRound() {
  const p = players[currentPlayerIdx];
  $('turn-label').textContent = `${p.name}'S TURN`;
  showScreen(countdownScreen);
  let count = 3;
  $('countdown-num').textContent = count;
  const iv = setInterval(() => {
    count--;
    if (count <= 0) {
      clearInterval(iv);
      startGameplay();
    } else {
      $('countdown-num').textContent = count;
    }
  }, 900);
}

// ─────────────────────────────────────────────
//  GAMEPLAY
// ─────────────────────────────────────────────
function startGameplay() {
  resizeCanvas();
  initRound();
  updateHUD();
  showScreen(gameScreen);
  gameRunning = true;
  animId = requestAnimationFrame(gameLoop);
}

function resizeCanvas() {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', () => { if (gameRunning) resizeCanvas(); });

function initRound() {
  dist          = 0;
  frame         = 0;
  speed         = 3.2;
  pipeGap       = 190;
  pipeInterval  = 95;
  lastPipeFrame = -999;
  isDead        = false;

  star = {
    x: canvas.width * 0.22,
    y: canvas.height * 0.45,
    vy: 0,
    gravity: 0.42,
    flapPower: -8.5,
    r: 16,
    trail: [],
    sparkles: [],
  };

  pipes    = [];
  particles= [];

  // Background stars (static decoration)
  bgStars = Array.from({length: 80}, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    r: Math.random() * 1.5 + 0.3,
    twinkle: Math.random() * Math.PI * 2,
    speed: Math.random() * 0.04 + 0.01,
  }));
}

// Input
function flap() {
  if (isDead) return;
  star.vy = star.flapPower;
  // birth sparkles on flap
  for (let i = 0; i < 8; i++) {
    star.sparkles.push({
      x: star.x, y: star.y,
      vx: (Math.random()-0.5) * 4,
      vy: (Math.random()-0.5) * 4 - 2,
      life: 1, decay: 0.06 + Math.random()*0.04,
      r: Math.random()*4+2,
      hue: Math.random() > 0.5 ? C.cyan : C.gold,
    });
  }
}

canvas.addEventListener('click', flap);
canvas.addEventListener('touchstart', e => { e.preventDefault(); flap(); }, { passive: false });
document.addEventListener('keydown', e => {
  if (!gameRunning) return;
  if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); flap(); }
});

// ── Main loop ──
function gameLoop(ts) {
  if (!gameRunning) return;
  update();
  draw();
  if (!isDead) {
    animId = requestAnimationFrame(gameLoop);
  } else {
    // brief pause then show result
    setTimeout(endRound, 900);
  }
}

function update() {
  frame++;
  dist = Math.floor(frame * speed * 0.08);

  // Progressive difficulty
  if (frame % 200 === 0) {
    speed = Math.min(speed + 0.18, 9);
    pipeGap = Math.max(pipeGap - 4, 110);
    pipeInterval = Math.max(pipeInterval - 2, 55);
  }

  // Star physics
  star.vy += star.gravity;
  star.y  += star.vy;

  // Trail
  star.trail.push({ x: star.x, y: star.y, life: 1 });
  if (star.trail.length > 18) star.trail.shift();
  star.trail.forEach(t => t.life -= 0.06);

  // Sparkles
  star.sparkles.forEach(s => { s.x += s.vx; s.y += s.vy; s.life -= s.decay; });
  star.sparkles = star.sparkles.filter(s => s.life > 0);

  // Bg stars scroll
  bgStars.forEach(s => {
    s.x -= speed * 0.15;
    if (s.x < 0) { s.x = canvas.width; s.y = Math.random() * canvas.height; }
    s.twinkle += s.speed;
  });

  // Pipes
  if (frame - lastPipeFrame >= pipeInterval) {
    spawnPipe();
    lastPipeFrame = frame;
  }
  pipes.forEach(p => { p.x -= speed; });
  pipes = pipes.filter(p => p.x > -120);

  // Particles
  particles.forEach(p => {
    p.x += p.vx; p.y += p.vy;
    p.vy += 0.15;
    p.life -= p.decay;
  });
  particles = particles.filter(p => p.life > 0);

  // Collision
  checkCollision();
  updateHUD();
}

function spawnPipe() {
  const H = canvas.height;
  const minH = 80;
  const topH = minH + Math.random() * (H - pipeGap - minH * 2);
  pipes.push({
    x: canvas.width + 40,
    topH,
    botY: topH + pipeGap,
    botH: H - topH - pipeGap,
    w: 58,
    passed: false,
  });
}

function checkCollision() {
  const H = canvas.height;
  // Floor / ceiling
  if (star.y - star.r < 64 || star.y + star.r > H) {
    die(); return;
  }
  // Pipes
  for (const p of pipes) {
    if (star.x + star.r > p.x && star.x - star.r < p.x + p.w) {
      if (star.y - star.r < p.topH || star.y + star.r > p.botY) {
        die(); return;
      }
    }
    // Score
    if (!p.passed && star.x > p.x + p.w) {
      p.passed = true;
    }
  }
}

function die() {
  isDead = true;
  gameRunning = false;
  // Explosion
  for (let i = 0; i < 40; i++) {
    const angle = Math.random() * Math.PI * 2;
    const spd   = Math.random() * 6 + 2;
    particles.push({
      x: star.x, y: star.y,
      vx: Math.cos(angle)*spd, vy: Math.sin(angle)*spd,
      life: 1, decay: 0.03+Math.random()*0.03,
      r: Math.random()*6+2,
      color: Math.random() > 0.5 ? C.cyan : C.gold,
    });
  }
  // final draw with explosion
  draw();
}

function updateHUD() {
  const cur = players[currentPlayerIdx];
  const opp = players[1 - currentPlayerIdx] || null;
  const isP1 = currentPlayerIdx === 0;

  $('hud-p1-name').textContent = isP1 ? cur.name : (opp ? opp.name : '');
  $('hud-p1-score').textContent = isP1 ? dist : (opp && opp.score !== null ? opp.score : '—');
  $('hud-p1-name').className = 'hud-name ' + (isP1 ? 'cyan' : 'pink');

  if (numPlayers > 1) {
    const other = isP1 ? opp : players[0];
    $('hud-p2-name').textContent = isP1 ? (opp ? opp.name : '') : cur.name;
    $('hud-p2-score').textContent = isP1 ? (opp && opp.score !== null ? opp.score : '—') : dist;
    $('hud-p2').style.visibility = 'visible';
  } else {
    $('hud-p2').style.visibility = 'hidden';
  }

  $('hud-dist').textContent = dist;
}

// ─────────────────────────────────────────────
//  DRAW
// ─────────────────────────────────────────────
function draw() {
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  // Background gradient
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#050810');
  grad.addColorStop(1, '#0a0e1a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Bg stars
  bgStars.forEach(s => {
    const alpha = 0.3 + 0.7 * Math.abs(Math.sin(s.twinkle));
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = C.white;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();
  });

  // Pipes
  pipes.forEach(p => drawPipe(p));

  // Trail
  star.trail.forEach((t, i) => {
    const alpha = t.life * 0.6 * (i / star.trail.length);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowBlur  = 12;
    ctx.shadowColor = C.cyan;
    ctx.fillStyle   = C.cyan;
    const r = star.r * 0.5 * (i / star.trail.length);
    ctx.beginPath();
    ctx.arc(t.x, t.y, r, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();
  });

  // Sparkles
  star.sparkles.forEach(s => {
    ctx.save();
    ctx.globalAlpha = s.life;
    ctx.shadowBlur  = 10;
    ctx.shadowColor = s.hue;
    ctx.fillStyle   = s.hue;
    drawStar4(s.x, s.y, s.r * s.life);
    ctx.fill();
    ctx.restore();
  });

  // Star player
  if (!isDead) drawStarPlayer();

  // Particles (death)
  particles.forEach(p => {
    ctx.save();
    ctx.globalAlpha = p.life;
    ctx.shadowBlur  = 16;
    ctx.shadowColor = p.color;
    ctx.fillStyle   = p.color;
    drawStar4(p.x, p.y, p.r * p.life);
    ctx.fill();
    ctx.restore();
  });

  // Ceiling / floor line
  ctx.strokeStyle = C.dim;
  ctx.lineWidth = 1;
  ctx.setLineDash([6, 6]);
  ctx.beginPath(); ctx.moveTo(0, 64); ctx.lineTo(W, 64); ctx.stroke();
  ctx.setLineDash([]);
}

function drawStarPlayer() {
  const x = star.x, y = star.y, r = star.r;
  const rot = (Date.now() * 0.003);

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.shadowBlur  = 30;
  ctx.shadowColor = C.cyan;

  // Outer glow ring
  const grd = ctx.createRadialGradient(0,0,r*0.3, 0,0,r*2);
  grd.addColorStop(0, 'rgba(0,245,255,0.3)');
  grd.addColorStop(1, 'rgba(0,245,255,0)');
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.arc(0, 0, r*2, 0, Math.PI*2);
  ctx.fill();

  // 5-point star
  ctx.shadowBlur = 20;
  ctx.shadowColor = C.cyan;
  ctx.fillStyle   = C.cyan;
  drawStar5(0, 0, r * 0.5, r * 1.1);
  ctx.fill();

  // Core white dot
  ctx.shadowBlur = 10;
  ctx.shadowColor = '#ffffff';
  ctx.fillStyle   = '#ffffff';
  ctx.beginPath();
  ctx.arc(0, 0, r*0.3, 0, Math.PI*2);
  ctx.fill();

  ctx.restore();
}

function drawStar5(cx, cy, innerR, outerR) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const angle = (Math.PI/5)*i - Math.PI/2;
    const r = i % 2 === 0 ? outerR : innerR;
    const px = cx + Math.cos(angle)*r;
    const py = cy + Math.sin(angle)*r;
    i === 0 ? ctx.moveTo(px,py) : ctx.lineTo(px,py);
  }
  ctx.closePath();
}

function drawStar4(cx, cy, r) {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const angle = (Math.PI/4)*i;
    const rad   = i % 2 === 0 ? r : r * 0.4;
    const px = cx + Math.cos(angle)*rad;
    const py = cy + Math.sin(angle)*rad;
    i === 0 ? ctx.moveTo(px,py) : ctx.lineTo(px,py);
  }
  ctx.closePath();
}

function drawPipe(p) {
  const W = canvas.width, H = canvas.height;
  // Neon pillar – top
  drawPillar(p.x, 64, p.w, p.topH - 64, true);
  // Neon pillar – bottom
  drawPillar(p.x, p.botY, p.w, p.botH, false);
}

function drawPillar(x, y, w, h, isTop) {
  if (h <= 0) return;

  // Body gradient
  const grad = ctx.createLinearGradient(x, 0, x+w, 0);
  grad.addColorStop(0,   'rgba(255,45,120,0.15)');
  grad.addColorStop(0.5, 'rgba(255,45,120,0.35)');
  grad.addColorStop(1,   'rgba(255,45,120,0.15)');
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, w, h);

  // Left + right edge glow
  ctx.shadowBlur  = 18;
  ctx.shadowColor = C.pink;
  ctx.strokeStyle = C.pink;
  ctx.lineWidth   = 2;
  ctx.strokeRect(x, y, w, h);
  ctx.shadowBlur = 0;

  // Cap at opening end
  const capH = 12, capW = w + 12;
  const capX = x - 6;
  const capY = isTop ? y + h - capH : y;
  const capGrad = ctx.createLinearGradient(capX, 0, capX+capW, 0);
  capGrad.addColorStop(0,   'rgba(255,45,120,0.2)');
  capGrad.addColorStop(0.5, 'rgba(255,45,120,0.6)');
  capGrad.addColorStop(1,   'rgba(255,45,120,0.2)');
  ctx.fillStyle = capGrad;
  ctx.fillRect(capX, capY, capW, capH);
  ctx.save();
  ctx.shadowBlur  = 20;
  ctx.shadowColor = C.pink;
  ctx.strokeStyle = C.pink;
  ctx.lineWidth   = 2;
  ctx.strokeRect(capX, capY, capW, capH);
  ctx.restore();
}

// ─────────────────────────────────────────────
//  END ROUND
// ─────────────────────────────────────────────
function endRound() {
  cancelAnimationFrame(animId);
  players[currentPlayerIdx].score = dist;

  const allDone = currentPlayerIdx >= players.length - 1;

  if (allDone || numPlayers === 1) {
    showFinalScreen();
  } else {
    showResultScreen();
  }
}

function showResultScreen() {
  const cur  = players[currentPlayerIdx];
  const next = players[currentPlayerIdx + 1];

  $('res-p1-name').textContent = players[0].name;
  $('res-p2-name').textContent = players[1] ? players[1].name : '';
  $('res-p1-dist').textContent = players[0].score !== null ? players[0].score : '—';
  $('res-p2-dist').textContent = players[1] && players[1].score !== null ? players[1].score : '—';
  $('result-next-label').textContent = `UP NEXT: ${next.name}`;
  $('next-turn-btn').textContent = `${next.name}'S TURN →`;

  showScreen(resultScreen);
}

function showFinalScreen() {
  // Determine winner
  let winner = players[0];
  let isTie = false;
  players.forEach(p => {
    if (p.score > winner.score) winner = p;
  });
  // Check tie
  const topScore = Math.max(...players.map(p => p.score));
  const winners  = players.filter(p => p.score === topScore);
  isTie = winners.length > 1;

  $('final-title').textContent = 'GAME OVER';
  $('final-winner-name').textContent = isTie ? "IT'S A TIE!" : `${winner.name} WINS!`;
  $('final-winner-name').className = 'final-winner-name ' + (isTie ? 'pink' : 'cyan');

  $('final-p1-name').textContent = players[0].name;
  $('final-p2-name').textContent = players[1] ? players[1].name : '';
  $('final-p1-dist').textContent = players[0].score;
  $('final-p2-dist').textContent = players[1] ? players[1].score : '—';

  if (numPlayers === 1) {
    $('final-p2-name').style.display = 'none';
    $('final-p2-dist').style.display = 'none';
    const vsEl = document.querySelector('#final-screen .result-vs');
    if (vsEl) vsEl.style.display = 'none';
  }

  showScreen(finalScreen);
}
