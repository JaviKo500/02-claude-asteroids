'use strict';

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const W = 800;
const H = 600;

// ── Input ─────────────────────────────────────────────────────────────────────
const keys = {};
const justPressed = {};

window.addEventListener('keydown', e => {
  justPressed[e.code] = !keys[e.code];
  keys[e.code] = true;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Escape'].includes(e.code))
    e.preventDefault();
});
window.addEventListener('keyup', e => { keys[e.code] = false; });

function pressed(code) {
  const val = justPressed[code];
  justPressed[code] = false;
  return val;
}

// ── Utils ─────────────────────────────────────────────────────────────────────
const wrap  = (v, max) => ((v % max) + max) % max;
const dist  = (a, b)   => Math.hypot(a.x - b.x, a.y - b.y);
const rand  = (min, max) => min + Math.random() * (max - min);
const randInt = (min, max) => Math.floor(rand(min, max + 1));

// ── Bullet ────────────────────────────────────────────────────────────────────
class Bullet {
  constructor(x, y, angle) {
    this.x = x;
    this.y = y;
    const SPEED = 520;
    this.vx = Math.cos(angle) * SPEED;
    this.vy = Math.sin(angle) * SPEED;
    this.ttl  = 1.1;
    this.radius = 2;
    this.dead = false;
  }

  update(dt) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw() {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ── Asteroid ──────────────────────────────────────────────────────────────────
const RADII  = [0, 16, 30, 50];   // por tamaño 1, 2, 3
const SPEEDS = [0, 85, 55, 32];   // velocidad base por tamaño
const POINTS = [0, 100, 50, 20];  // puntos por tamaño

class Asteroid {
  constructor(x, y, size = 3) {
    this.x    = x;
    this.y    = y;
    this.size = size;
    this.radius = RADII[size];
    this.dead = false;

    const angle = rand(0, Math.PI * 2);
    const speed = SPEEDS[size] + rand(-15, 15);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.rotSpeed = rand(-1.2, 1.2);
    this.rot = rand(0, Math.PI * 2);

    // Polígono irregular
    const n = randInt(8, 13);
    this.verts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = this.radius * rand(0.6, 1.0);
      this.verts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
  }

  update(dt) {
    this.x   = wrap(this.x + this.vx * dt, W);
    this.y   = wrap(this.y + this.vy * dt, H);
    this.rot += this.rotSpeed * dt;
  }

  split() {
    if (this.size <= 1) return [];
    return [
      new Asteroid(this.x, this.y, this.size - 1),
      new Asteroid(this.x, this.y, this.size - 1),
    ];
  }

  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth   = 1.5;
    ctx.lineJoin    = 'round';
    ctx.beginPath();
    ctx.moveTo(this.verts[0][0], this.verts[0][1]);
    for (let i = 1; i < this.verts.length; i++)
      ctx.lineTo(this.verts[i][0], this.verts[i][1]);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }
}

// ── Ship ──────────────────────────────────────────────────────────────────────
class Ship {
  constructor() { this.reset(); }

  reset() {
    this.x      = W / 2;
    this.y      = H / 2;
    this.angle  = -Math.PI / 2;
    this.vx     = 0;
    this.vy     = 0;
    this.radius = 12;
    this.thrusting     = false;
    this.invincible    = 3;
    this.shootCooldown = 0;
    this.dead          = false;
  }

  update(dt) {
    if (this.dead) return;
    if (this.invincible    > 0) this.invincible    -= dt;
    if (this.shootCooldown > 0) this.shootCooldown -= dt;

    const hyper  = hyperTimer > 0;
    const ROT    = hyper ? 3.5 * 1.4 : 3.5;   // rad/s
    const THRUST = hyper ? 650        : 260;   // px/s²
    const DRAG   = hyper ? 0.991      : 0.987;

    if (keys['ArrowLeft'])  this.angle -= ROT * dt;
    if (keys['ArrowRight']) this.angle += ROT * dt;

    this.thrusting = !!keys['ArrowUp'];
    if (this.thrusting) {
      this.vx += Math.cos(this.angle) * THRUST * dt;
      this.vy += Math.sin(this.angle) * THRUST * dt;
    }

    this.vx *= DRAG;
    this.vy *= DRAG;
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
  }

  tryShoot() {
    if (this.shootCooldown > 0 || this.dead) return [];
    this.shootCooldown = 0.2;
    const NOSE = 21;
    const ox = this.x + Math.cos(this.angle) * NOSE;
    const oy = this.y + Math.sin(this.angle) * NOSE;
    if (tripleShotTimer > 0) {
      const SPREAD = 0.22; // ~12.5° entre balas
      return [
        new Bullet(ox, oy, this.angle - SPREAD),
        new Bullet(ox, oy, this.angle),
        new Bullet(ox, oy, this.angle + SPREAD),
      ];
    }
    return [new Bullet(ox, oy, this.angle)];
  }

  draw() {
    if (this.dead) return;

    // Anillo de escudo (visible aunque la nave parpadee por reaparición)
    if (shieldTimer > 0) {
      const blink = shieldTimer < 1.5 && Math.floor(shieldTimer * 8) % 2 === 0;
      if (!blink) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.strokeStyle = '#4f8';
        ctx.lineWidth   = 2;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius + 7, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }

    // Parpadeo durante invencibilidad de reaparición
    if (this.invincible > 0 && Math.floor(this.invincible * 8) % 2 === 0) return;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth   = 1.5;
    ctx.lineJoin    = 'round';

    // Silueta clásica: triángulo con muesca trasera
    ctx.beginPath();
    ctx.moveTo( 20,  0);   // nariz
    ctx.lineTo(-12, -9);   // ala izquierda
    ctx.lineTo( -7,  0);   // muesca trasera
    ctx.lineTo(-12,  9);   // ala derecha
    ctx.closePath();
    ctx.stroke();

    // Llama del propulsor
    if (this.thrusting && Math.random() > (hyperTimer > 0 ? 0.1 : 0.35)) {
      const flameLen = hyperTimer > 0 ? rand(16, 30) : rand(6, 14);
      const flameW   = hyperTimer > 0 ? 6 : 4;
      ctx.beginPath();
      ctx.moveTo(-8, -flameW);
      ctx.lineTo(-8 - flameLen, 0);
      ctx.lineTo(-8,  flameW);
      ctx.strokeStyle = hyperTimer > 0
        ? 'rgba(180, 230, 255, 0.95)'   // azul-blanco para hiper
        : 'rgba(255, 130, 0, 0.85)';    // naranja normal
      ctx.stroke();
    }

    ctx.restore();
  }
}

// ── Partículas (explosión) ────────────────────────────────────────────────────
class Particle {
  constructor(x, y) {
    this.x  = x;
    this.y  = y;
    const angle = rand(0, Math.PI * 2);
    const speed = rand(30, 130);
    this.vx   = Math.cos(angle) * speed;
    this.vy   = Math.sin(angle) * speed;
    this.life = rand(0.4, 1.1);
    this.ttl  = this.life;
    this.dead = false;
  }

  update(dt) {
    this.x  += this.vx * dt;
    this.y  += this.vy * dt;
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw() {
    const alpha = this.ttl / this.life;
    ctx.strokeStyle = `rgba(255,255,255,${alpha.toFixed(2)})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.x - this.vx * 0.05, this.y - this.vy * 0.05);
    ctx.stroke();
  }
}

// ── PowerUp ───────────────────────────────────────────────────────────────────
class PowerUp {
  constructor(x, y, type = 'triple') {
    this.x      = x;
    this.y      = y;
    this.type   = type;
    this.vx     = rand(-20, 20);
    this.vy     = rand(-20, 20);
    this.radius = 12;
    this.rot    = 0;
    this.ttl    = 10;
    this.dead   = false;
  }

  update(dt) {
    this.x   = wrap(this.x + this.vx * dt, W);
    this.y   = wrap(this.y + this.vy * dt, H);
    this.rot += 1.5 * dt;
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw() {
    // Parpadeo cuando queda poco tiempo
    if (this.ttl < 2 && Math.floor(this.ttl * 8) % 2 === 0) return;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);

    const s = 10;
    if (this.type === 'shield') {
      // Círculo exterior verde
      ctx.strokeStyle = '#4f8';
      ctx.lineWidth   = 2;
      ctx.beginPath();
      ctx.arc(0, 0, s, 0, Math.PI * 2);
      ctx.stroke();

      // Arco interior tenue para sugerir escudo
      ctx.strokeStyle = 'rgba(68,255,136,0.5)';
      ctx.lineWidth   = 1;
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.55, 0, Math.PI * 2);
      ctx.stroke();
    } else if (this.type === 'triple') {
      // Rombo exterior cian (tiro triple)
      ctx.strokeStyle = '#3df';
      ctx.lineWidth   = 2;
      ctx.lineJoin    = 'round';
      ctx.beginPath();
      ctx.moveTo( 0, -s);
      ctx.lineTo( s,  0);
      ctx.lineTo( 0,  s);
      ctx.lineTo(-s,  0);
      ctx.closePath();
      ctx.stroke();

      // Cruz interior tenue
      ctx.strokeStyle = 'rgba(51,221,255,0.5)';
      ctx.lineWidth   = 1;
      ctx.beginPath();
      ctx.moveTo(-s * 0.5,  0);
      ctx.lineTo( s * 0.5,  0);
      ctx.moveTo( 0, -s * 0.5);
      ctx.lineTo( 0,  s * 0.5);
      ctx.stroke();
    } else if (this.type === 'slowmo') {
      // Círculo exterior violeta (slow motion)
      ctx.strokeStyle = '#a8f';
      ctx.lineWidth   = 2;
      ctx.beginPath();
      ctx.arc(0, 0, s, 0, Math.PI * 2);
      ctx.stroke();

      // Manecilla larga (apunta arriba)
      ctx.strokeStyle = '#a8f';
      ctx.lineWidth   = 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -s * 0.65);
      ctx.stroke();

      // Manecilla corta (apunta a la derecha)
      ctx.strokeStyle = 'rgba(170,136,255,0.6)';
      ctx.lineWidth   = 1;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(s * 0.45, 0);
      ctx.stroke();
    } else if (this.type === 'bomb') {
      // Cuerpo de la bomba: círculo relleno naranja
      ctx.fillStyle   = '#f63';
      ctx.strokeStyle = '#f84';
      ctx.lineWidth   = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.75, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Mecha corta en diagonal (arriba-derecha)
      ctx.strokeStyle = '#fb4';
      ctx.lineWidth   = 2;
      ctx.lineCap     = 'round';
      ctx.beginPath();
      ctx.moveTo(s * 0.45, -s * 0.45);
      ctx.lineTo(s * 0.85, -s * 0.85);
      ctx.stroke();

      // Chispa en la punta de la mecha
      ctx.fillStyle = '#ff0';
      ctx.beginPath();
      ctx.arc(s * 0.85, -s * 0.85, 2.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.type === 'hyper') {
      // Rayo dorado (zig-zag de relámpago relleno)
      ctx.fillStyle   = '#fd4';
      ctx.strokeStyle = '#fb2';
      ctx.lineWidth   = 1;
      ctx.lineJoin    = 'round';
      ctx.beginPath();
      ctx.moveTo( 2, -s);        // punta superior
      ctx.lineTo( s * 0.6, -s * 0.1);  // vértice derecho-alto
      ctx.lineTo( 1, -s * 0.1); // muesca central
      ctx.lineTo(-2,  s);        // punta inferior
      ctx.lineTo(-s * 0.6,  s * 0.1);  // vértice izquierdo-bajo
      ctx.lineTo(-1,  s * 0.1); // muesca central
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    ctx.restore();
  }
}

// ── Estado del juego ──────────────────────────────────────────────────────────
let ship, bullets, asteroids, particles;
let score, lives, level;
let state;      // 'playing' | 'dead' | 'gameover'
let paused;
let deadTimer;
let powerups;
let tripleShotTimer;
let tripleSpawned;
let shieldTimer;
let shieldSpawned;
let slowmoTimer;
let slowmoSpawned;
let bombSpawned;
let novaFlash;   // segundos restantes del destello visual
let hyperTimer;
let hyperSpawned;

function spawnAsteroids(count) {
  const SAFE_DIST = 130;
  for (let i = 0; i < count; i++) {
    let x, y;
    do {
      x = rand(0, W);
      y = rand(0, H);
    } while (Math.hypot(x - W / 2, y - H / 2) < SAFE_DIST);
    asteroids.push(new Asteroid(x, y, 3));
  }
}

function initGame() {
  ship          = new Ship();
  bullets   = [];
  asteroids = [];
  particles = [];
  powerups  = [];
  score  = 0;
  lives  = 3;
  level  = 1;
  state  = 'playing';
  paused = false;
  tripleShotTimer = 0;
  tripleSpawned   = false;
  shieldTimer     = 0;
  shieldSpawned   = false;
  slowmoTimer     = 0;
  slowmoSpawned   = false;
  bombSpawned     = false;
  novaFlash       = 0;
  hyperTimer      = 0;
  hyperSpawned    = false;
  spawnAsteroids(4);
}

function nextLevel() {
  level++;
  bullets       = [];
  particles     = [];
  tripleSpawned = false;
  shieldSpawned = false;
  slowmoSpawned = false;
  hyperSpawned  = false;
  if (level % 3 === 0) bombSpawned = false;
  ship.reset();
  spawnAsteroids(3 + level);
}

function explode(x, y, count = 8) {
  for (let i = 0; i < count; i++) particles.push(new Particle(x, y));
}

function novaBomb() {
  for (const a of asteroids) explode(a.x, a.y, a.size * 5);
  asteroids = [];
  novaFlash = 0.35;
}

function killShip() {
  explode(ship.x, ship.y, 14);
  ship.dead = true;
  lives--;
  if (lives <= 0) {
    state = 'gameover';
  } else {
    state     = 'dead';
    deadTimer = 2;
  }
}

function maybeSpawnPowerup(x, y) {
  // Bomba Nova: ítem muy escaso, roll propio (~2%), una vez por nivel
  if (!bombSpawned && Math.random() < 0.02) {
    powerups.push(new PowerUp(x, y, 'bomb'));
    bombSpawned = true;
    return;
  }
  if (Math.random() >= 0.10) return;
  const available = [];
  if (!tripleSpawned) available.push('triple');
  if (!shieldSpawned) available.push('shield');
  if (!slowmoSpawned) available.push('slowmo');
  if (!hyperSpawned)  available.push('hyper');
  if (available.length === 0) return;
  const type = available[randInt(0, available.length - 1)];
  powerups.push(new PowerUp(x, y, type));
  if (type === 'triple') tripleSpawned = true;
  else if (type === 'shield') shieldSpawned = true;
  else if (type === 'slowmo') slowmoSpawned = true;
  else hyperSpawned = true;
}

// ── Update ────────────────────────────────────────────────────────────────────
function update(dt) {
  if (pressed('Escape') && state === 'playing') paused = !paused;
  if (paused) return;

  if (state === 'gameover') {
    if (pressed('Space')) initGame();
    particles.forEach(p => p.update(dt));
    particles = particles.filter(p => !p.dead);
    return;
  }

  if (state === 'dead') {
    deadTimer -= dt;
    particles.forEach(p => p.update(dt));
    particles = particles.filter(p => !p.dead);
    const astDtDead = slowmoTimer > 0 ? dt * 0.5 : dt;
    asteroids.forEach(a => a.update(astDtDead));
    if (deadTimer <= 0) { state = 'playing'; ship.reset(); }
    return;
  }

  // Timers de power-ups
  if (tripleShotTimer > 0) tripleShotTimer -= dt;
  if (shieldTimer     > 0) shieldTimer     -= dt;
  if (slowmoTimer     > 0) slowmoTimer     -= dt;
  if (novaFlash       > 0) novaFlash       -= dt;
  if (hyperTimer      > 0) hyperTimer      -= dt;

  // Disparar
  if (pressed('Space')) {
    bullets.push(...ship.tryShoot());
  }

  ship.update(dt);
  bullets.forEach(b => b.update(dt));
  const astDt = slowmoTimer > 0 ? dt * 0.5 : dt;
  asteroids.forEach(a => a.update(astDt));
  particles.forEach(p => p.update(dt));

  bullets   = bullets.filter(b => !b.dead);
  particles = particles.filter(p => !p.dead);

  // Bala vs asteroide
  const newAsteroids = [];
  let lastDestroyedX = W / 2, lastDestroyedY = H / 2;
  for (const b of bullets) {
    for (const a of asteroids) {
      if (!a.dead && !b.dead && dist(b, a) < a.radius) {
        b.dead = true;
        a.dead = true;
        score += POINTS[a.size];
        explode(a.x, a.y, a.size * 5);
        newAsteroids.push(...a.split());
        lastDestroyedX = a.x;
        lastDestroyedY = a.y;
        maybeSpawnPowerup(a.x, a.y);
      }
    }
  }
  asteroids = asteroids.filter(a => !a.dead).concat(newAsteroids);
  bullets   = bullets.filter(b => !b.dead);

  // Garantizar al menos un pickup por nivel
  if (!tripleSpawned && !shieldSpawned && !slowmoSpawned && !hyperSpawned && asteroids.length === 0) {
    const type = ['triple', 'shield', 'slowmo', 'hyper'][randInt(0, 3)];
    powerups.push(new PowerUp(lastDestroyedX, lastDestroyedY, type));
    if (type === 'triple') tripleSpawned = true;
    else if (type === 'shield') shieldSpawned = true;
    else if (type === 'slowmo') slowmoSpawned = true;
    else hyperSpawned = true;
  }

  // Nave vs asteroide
  if (ship.invincible <= 0) {
    for (const a of asteroids) {
      if (dist(ship, a) < ship.radius + a.radius * 0.82) {
        if (shieldTimer > 0) {
          shieldTimer     = 0;
          a.dead          = true;
          explode(a.x, a.y, a.size * 5);
          ship.invincible = 1.5;
          asteroids = asteroids.filter(x => !x.dead);
        } else {
          killShip();
        }
        break;
      }
    }
  }

  // PowerUps: update + recogida
  powerups.forEach(p => p.update(dt));
  for (const p of powerups) {
    if (!p.dead && dist(ship, p) < ship.radius + p.radius) {
      p.dead = true;
      if (p.type === 'shield') shieldTimer = 5;
      else if (p.type === 'slowmo') slowmoTimer = 6;
      else if (p.type === 'bomb') novaBomb();
      else if (p.type === 'hyper') hyperTimer = 8;
      else tripleShotTimer = 5;
    }
  }
  powerups = powerups.filter(p => !p.dead);

  // Nivel completado
  if (asteroids.length === 0) nextLevel();
}

// ── Draw ──────────────────────────────────────────────────────────────────────
function drawLifeIcon(x, y) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-Math.PI / 2);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth   = 1.2;
  ctx.lineJoin    = 'round';
  ctx.beginPath();
  ctx.moveTo( 9,  0);
  ctx.lineTo(-6, -5);
  ctx.lineTo(-3,  0);
  ctx.lineTo(-6,  5);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

function drawHUD() {
  ctx.fillStyle = '#fff';
  ctx.font = '15px monospace';

  ctx.textAlign = 'left';
  ctx.fillText(`SCORE  ${score}`, 14, 26);

  ctx.textAlign = 'center';
  ctx.fillText(`NIVEL ${level}`, W / 2, 26);

  for (let i = 0; i < lives; i++)
    drawLifeIcon(W - 16 - i * 22, 18);

  if (tripleShotTimer > 0) {
    ctx.fillStyle = '#3df';
    ctx.textAlign = 'left';
    ctx.font      = '15px monospace';
    ctx.fillText(`TRIPLE  ${tripleShotTimer.toFixed(1)}s`, 14, 48);
  }

  if (shieldTimer > 0) {
    ctx.fillStyle = '#4f8';
    ctx.textAlign = 'left';
    ctx.font      = '15px monospace';
    ctx.fillText(`ESCUDO  ${shieldTimer.toFixed(1)}s`, 14, 70);
  }

  if (slowmoTimer > 0) {
    ctx.fillStyle = '#a8f';
    ctx.textAlign = 'left';
    ctx.font      = '15px monospace';
    ctx.fillText(`LENTO   ${slowmoTimer.toFixed(1)}s`, 14, 92);
  }

  if (hyperTimer > 0) {
    ctx.fillStyle = '#fd4';
    ctx.textAlign = 'left';
    ctx.font      = '15px monospace';
    ctx.fillText(`HIPER   ${hyperTimer.toFixed(1)}s`, 14, 114);
  }
}

function drawOverlay(title, sub) {
  ctx.textAlign   = 'center';
  ctx.fillStyle   = '#fff';
  ctx.font        = 'bold 46px monospace';
  ctx.fillText(title, W / 2, H / 2 - 18);
  ctx.font        = '18px monospace';
  ctx.fillStyle   = 'rgba(255,255,255,0.65)';
  ctx.fillText(sub, W / 2, H / 2 + 22);
}

function draw() {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);

  particles.forEach(p => p.draw());
  asteroids.forEach(a => a.draw());
  powerups.forEach(p => p.draw());
  bullets.forEach(b => b.draw());
  ship.draw();

  // Nova flash: destello blanco al detonar la bomba
  if (novaFlash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${(novaFlash / 0.35) * 0.6})`;
    ctx.fillRect(0, 0, W, H);
  }

  drawHUD();

  if (state === 'gameover')
    drawOverlay('GAME OVER', `PUNTAJE: ${score}   —   ESPACIO PARA REINICIAR`);

  if (paused) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, W, H);
    drawOverlay('PAUSA', 'ESC PARA CONTINUAR');
  }
}

// ── Loop principal ────────────────────────────────────────────────────────────
let lastTime = null;

function loop(ts) {
  const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05);
  lastTime = ts;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

initGame();
requestAnimationFrame(loop);
