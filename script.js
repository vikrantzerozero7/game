(function() {
'use strict';

// ============================================================
// CONFIG
// ============================================================
const GRAVITY = 0.9;
const JUMP_FORCE = -18;
const MOVE_SPEED = 7;
const MAX_FALL = 22;

const ARROW_SPEED = 8;
const ARROW_HOMING_SPEED = 5;
const ARROW_HOMING_STRENGTH = 0.08;
const ARCHER_SHOOT_INTERVAL = 2.2;
const ARCHER_SHOOT_INTERVAL_FLYING = 1.2;
const ARROW_LIFETIME = 4;

const PHYSICS = {
  jumpBuffer: 0.2,
  coyoteTime: 0.15
};

// ============================================================
// DOM
// ============================================================
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const flyIndicator = document.getElementById('flyIndicator');
const shieldIndicator = document.getElementById('shieldIndicator');
const mobileShieldBtn = document.getElementById('mobileShieldBtn');

const heartsEl = document.getElementById('hearts');
const timerEl = document.getElementById('timer');
const worldNameEl = document.getElementById('worldName');
const scoreEl = document.getElementById('score');
const damageFlash = document.getElementById('damageFlash');
const shieldFlash = document.getElementById('shieldFlash');
const shieldBreakFlash = document.getElementById('shieldBreakFlash');
const worldBanner = document.getElementById('worldBanner');

// ============================================================
// AUDIO
// ============================================================
class AudioEngine {
  constructor() { this.ctx = null; this.master = null; this.enabled = true; }
  init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.22;
      this.master.connect(this.ctx.destination);
    } catch(e) { this.enabled = false; }
  }
  tone(freq, dur, type='square', vol=0.15, slideTo=null) {
    if (!this.enabled || !this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, this.ctx.currentTime + dur);
      gain.gain.setValueAtTime(vol, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
      osc.connect(gain); gain.connect(this.master);
      osc.start(); osc.stop(this.ctx.currentTime + dur);
    } catch(e) {}
  }
  jump() { this.tone(400, 0.15, 'square', 0.12, 800); }
  fly() { this.tone(600, 0.3, 'sine', 0.08, 900); }
  hit() { this.tone(200, 0.2, 'sawtooth', 0.2, 80); }
  attack() { this.tone(600, 0.08, 'square', 0.15, 200); }
  coin() { this.tone(880, 0.08, 'sine', 0.18); setTimeout(()=>this.tone(1320, 0.12, 'sine', 0.18), 70); }
  gem() { this.tone(1320, 0.1, 'sine', 0.2); setTimeout(()=>this.tone(1760, 0.14, 'sine', 0.2), 80); setTimeout(()=>this.tone(2200, 0.18, 'sine', 0.18), 160); }
  potion() { this.tone(520, 0.1, 'sine', 0.15, 780); setTimeout(()=>this.tone(780, 0.15, 'sine', 0.15, 1040), 90); }
  powerup() { [440,554,659,880].forEach((f,i)=>setTimeout(()=>this.tone(f,0.1,'square',0.13),i*50)); }
  death() { this.tone(300, 0.5, 'sawtooth', 0.25, 50); }
  win() { [523,659,784,1047].forEach((f,i)=>setTimeout(()=>this.tone(f,0.2,'sine',0.2),i*100)); }
  achievement() { [660,880,1100,1320].forEach((f,i)=>setTimeout(()=>this.tone(f,0.12,'triangle',0.18),i*70)); }
  footstep() { this.tone(120, 0.04, 'triangle', 0.05); }
  bowShoot() { this.tone(900, 0.12, 'sawtooth', 0.1, 300); }
  arrowHit() { this.tone(180, 0.18, 'square', 0.18, 60); }
  shield() { this.tone(300, 0.15, 'triangle', 0.12, 600); }
  shieldBlock() { this.tone(500, 0.12, 'square', 0.16, 1200); }
  shieldBreak() {
    this.tone(600, 0.25, 'sawtooth', 0.25, 120);
    setTimeout(()=>this.tone(300, 0.3, 'square', 0.2, 60), 80);
    setTimeout(()=>this.tone(150, 0.4, 'triangle', 0.18, 40), 180);
  }
  shieldRepair() { this.tone(400, 0.1, 'sine', 0.1, 800); setTimeout(()=>this.tone(800, 0.15, 'sine', 0.1, 1200), 80); }
  unlock() { this.tone(440,0.08,'square',0.15); setTimeout(()=>this.tone(660,0.08,'square',0.15),80); setTimeout(()=>this.tone(880,0.15,'square',0.18),160); }
}
const audio = new AudioEngine();

// ============================================================
// GAME STATE
// ============================================================
let grid = [];
let player = null;
let guards = [];
let archers = [];
let arrows = [];
let coins = [];
let pickups = [];
let breakable = [];
let movingSpikes = [];
let particles = [];
let floatTexts = [];
let doorCell = { x: 2, y: 4 };
let exitCell = null;
let exitLocked = false;
let worldIndex = 0;
let levelInWorld = 0;
let currentWorld = 'sand';
let currentTheme = THEMES.sand;
let currentWorldRule = WORLD_RULES.sand;
let gameState = 'menu';
let keys = {};
let timeLeft = 90;
let lives = 3;
let score = 0;
let lastTime = 0;
let shakeAmount = 0;
let parallaxOffset = 0;
let invulnUntil = 0;
let footstepTimer = 0;
let globalStage = 0;
let loopCount = 0;

const stats = {
  kills: 0, coins: 0, blocks: 0, stage: 0,
  flyTime: 0, damageTaken: 0, levelTime: 0, levelsCompleted: 0
};
const unlockedAchievements = new Set();

// ============================================================
// UTILS
// ============================================================
function rand(min, max) { return Math.random() * (max - min) + min; }
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function lerp(a, b, t) { return a + (b - a) * t; }

// ============================================================
// PARTICLES
// ============================================================
class Particle {
  constructor(x, y, vx, vy, life, color, size=4, gravity=0.3, shape='square') {
    this.x = x; this.y = y; this.vx = vx; this.vy = vy;
    this.life = life; this.maxLife = life;
    this.color = color; this.size = size; this.gravity = gravity;
    this.shape = shape; this.rot = rand(0, Math.PI*2); this.rotSpeed = rand(-0.3, 0.3);
  }
  update(dt) {
    this.x += this.vx * dt; this.y += this.vy * dt;
    this.vy += this.gravity * dt;
    this.life -= dt; this.vx *= 0.98;
    this.rot += this.rotSpeed * dt;
  }
  draw(ctx) {
    ctx.globalAlpha = clamp(this.life / this.maxLife, 0, 1);
    ctx.fillStyle = this.color;
    if (this.shape === 'shard') {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rot);
      ctx.beginPath();
      ctx.moveTo(-this.size, -this.size*0.4);
      ctx.lineTo(this.size, -this.size*0.7);
      ctx.lineTo(this.size*0.5, this.size);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    } else {
      ctx.fillRect(this.x - this.size/2, this.y - this.size/2, this.size, this.size);
    }
    ctx.globalAlpha = 1;
  }
}

function spawnParticles(x, y, count, color, speed=3, life=0.8, shape='square') {
  for (let i = 0; i < count; i++) {
    const ang = rand(0, Math.PI * 2);
    const spd = rand(1, speed);
    particles.push(new Particle(x, y, Math.cos(ang)*spd, Math.sin(ang)*spd, life, color, rand(2, 6), 0.3, shape));
  }
}

function spawnBlood(x, y) {
  spawnParticles(x, y, 18, '#cc2222', 6, 1);
  spawnParticles(x, y, 8, '#ff4444', 4, 0.6);
}

function spawnShieldBreak(x, y) {
  for (let i = 0; i < 40; i++) {
    const ang = rand(0, Math.PI * 2);
    const spd = rand(2, 9);
    particles.push(new Particle(
      x, y,
      Math.cos(ang) * spd, Math.sin(ang) * spd,
      rand(0.8, 1.6),
      ['#a0d8ff', '#7fbfff', '#5a9fdf', '#c8e8ff'][Math.floor(rand(0,4))],
      rand(3, 8), 0.4, 'shard'
    ));
  }
  for (let i = 0; i < 24; i++) {
    const ang = (i / 24) * Math.PI * 2;
    const spd = rand(4, 7);
    particles.push(new Particle(
      x, y,
      Math.cos(ang) * spd, Math.sin(ang) * spd,
      0.5, '#ffffff', rand(1, 3), 0.1
    ));
  }
}

// ============================================================
// FLOAT TEXT
// ============================================================
class FloatText {
  constructor(x, y, text, color='#ffd27f', size=24) {
    this.x = x; this.y = y; this.text = text; this.color = color;
    this.size = size; this.life = 1.2; this.maxLife = 1.2; this.vy = -2;
  }
  update(dt) { this.y += this.vy*dt; this.vy *= 0.95; this.life -= dt; }
  draw(ctx) {
    ctx.globalAlpha = clamp(this.life / this.maxLife, 0, 1);
    ctx.font = `bold ${this.size}px Georgia`;
    ctx.textAlign = 'center';
    ctx.fillStyle = this.color;
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    ctx.strokeText(this.text, this.x, this.y);
    ctx.fillText(this.text, this.x, this.y);
    ctx.globalAlpha = 1;
  }
}

// ============================================================
// ARROW
// ============================================================
class Arrow {
  constructor(x, y, tx, ty) {
    this.x = x; this.y = y;
    this.life = ARROW_LIFETIME;
    const dx = tx - x, dy = ty - y;
    const len = Math.sqrt(dx*dx + dy*dy) || 1;
    this.vx = (dx / len) * ARROW_SPEED;
    this.vy = (dy / len) * ARROW_SPEED;
    this.angle = Math.atan2(this.vy, this.vx);
  }
  update(dt, target) {
    this.life -= dt;
    if (target && target.flying) {
      const tx = target.x + target.w / 2;
      const ty = target.y + target.h / 2;
      const dx = tx - this.x, dy = ty - this.y;
      const len = Math.sqrt(dx*dx + dy*dy) || 1;
      const desiredVx = (dx / len) * ARROW_HOMING_SPEED * 1.3;
      const desiredVy = (dy / len) * ARROW_HOMING_SPEED * 1.3;
      this.vx = lerp(this.vx, desiredVx, ARROW_HOMING_STRENGTH);
      this.vy = lerp(this.vy, desiredVy, ARROW_HOMING_STRENGTH);
    }
    this.x += this.vx * 60 * dt;
    this.y += this.vy * 60 * dt;
    this.angle = Math.atan2(this.vy, this.vx);
    if (Math.random() < 0.5) {
      particles.push(new Particle(this.x, this.y, rand(-0.3,0.3), rand(-0.3,0.3), 0.3, '#ff8a40', rand(1,3), 0));
    }
  }
  offscreen() { return this.x < -50 || this.x > W + 50 || this.y < -50 || this.y > H + 50; }
  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.shadowColor = '#ff8a40';
    ctx.shadowBlur = 10;
    ctx.strokeStyle = '#8b6f3a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-12, 0); ctx.lineTo(8, 0);
    ctx.stroke();
    ctx.fillStyle = '#c8c8d0';
    ctx.beginPath();
    ctx.moveTo(8, -4); ctx.lineTo(16, 0); ctx.lineTo(8, 4);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ff4444';
    ctx.beginPath();
    ctx.moveTo(-12, 0); ctx.lineTo(-18, -5); ctx.lineTo(-14, 0); ctx.lineTo(-18, 5);
    ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();
  }
}

// ============================================================
// PLAYER
// ============================================================
class Player {
  constructor(cx, cy) {
    this.x = cx * TILE + 12;
    this.y = cy * TILE + 8;
    this.w = TILE - 24;
    this.h = TILE - 8;
    this.vx = 0; this.vy = 0;
    this.onGround = false;
    this.facing = 1;
    this.anim = 0;
    this.attackTimer = 0;
    this.jumpBuffer = 0;
    this.coyoteTime = 0;
    this.dead = false;
    this.flying = false;
    this.flyEnergy = FLY_MAX_ENERGY;
    this.flySoundTimer = 0;
    this.hurtCooldown = 0;
    this.shieldPulse = 0;
    this.guardHitCooldown = 0;
  }

  attack() {
    if (this.attackTimer > 0) return;
    this.attackTimer = 0.25;
    audio.attack();
    const hitX = this.facing > 0 ? this.x + this.w : this.x - 40;
    const hitY = this.y;
    const hitW = 40, hitH = this.h;

    for (const g of guards) {
      if (g.dead) continue;
      const gx = g.x * TILE + 12, gy = g.y * TILE + 8;
      const gw = TILE - 24, gh = TILE - 8;
      if (hitX < gx + gw && hitX + hitW > gx && hitY < gy + gh && hitY + hitH > gy) {
        g.hp--;
        spawnBlood(gx + gw/2, gy + gh/2);
        shakeAmount = 8;
        if (g.hp <= 0) {
          g.dead = true;
          stats.kills++;
          spawnParticles(gx + gw/2, gy + gh/2, 25, '#aa0000', 8, 1.2);
          const pts = g.boss ? 200 : 50;
          floatTexts.push(new FloatText(gx + gw/2, gy, '+' + pts, '#ffd27f', 28));
          score += pts; scoreEl.textContent = score;
          audio.hit();
        }
      }
    }
    for (const a of archers) {
      if (a.dead) continue;
      const ax = a.x * TILE + 12, ay = a.y * TILE + 8;
      const aw = TILE - 24, ah = TILE - 8;
      if (hitX < ax + aw && hitX + hitW > ax && hitY < ay + ah && hitY + hitH > ay) {
        a.hp--;
        spawnBlood(ax + aw/2, ay + ah/2);
        shakeAmount = 8;
        if (a.hp <= 0) {
          a.dead = true;
          stats.kills++;
          spawnParticles(ax + aw/2, ay + ah/2, 25, '#aa5500', 8, 1.2);
          floatTexts.push(new FloatText(ax + aw/2, ay, '+75', '#ff8a40', 28));
          score += 75; scoreEl.textContent = score;
          audio.hit();
        }
      }
    }
    for (let i = breakable.length - 1; i >= 0; i--) {
      const b = breakable[i];
      const bx = b.x * TILE, by = b.y * TILE;
      if (hitX < bx + TILE && hitX + hitW > bx && hitY < by + TILE && hitY + hitH > by) {
        b.hp--;
        spawnParticles(bx + TILE/2, by + TILE/2, 12, currentTheme.blockMid, 4, 0.6);
        if (b.hp <= 0) {
          breakable.splice(i, 1);
          grid[b.y][b.x] = 0;
          score += 15; scoreEl.textContent = score;
          audio.hit();
        }
      }
    }
    for (let i = arrows.length - 1; i >= 0; i--) {
      const ar = arrows[i];
      if (Math.abs(ar.x - (this.x + this.w/2)) < 60 && Math.abs(ar.y - (this.y + this.h/2)) < 50) {
        arrows.splice(i, 1);
        spawnParticles(ar.x, ar.y, 8, '#ffd27f', 5, 0.5);
        floatTexts.push(new FloatText(ar.x, ar.y - 20, 'BLOCK!', '#8aff70', 20));
        score += 5; scoreEl.textContent = score;
        audio.coin();
      }
    }
  }

  breakShield() {
    if (shieldBroken) return;
    shieldBroken = true;
    shieldActive = false;
    shieldEnergy = 0;
    shieldBreakTimer = SHIELD_BREAK_COOLDOWN;
    audio.shieldBreak();
    shakeAmount = 18;
    spawnShieldBreak(this.x + this.w/2, this.y + this.h/2);
    spawnParticles(this.x + this.w/2, this.y + this.h/2, 20, '#7fbfff', 6, 1.0, 'shard');
    floatTexts.push(new FloatText(this.x + this.w/2, this.y - 30, 'SHIELD BROKEN!', '#ff5555', 30));
    showBanner('💥 SHIELD BROKEN!', '#ff5555');
    shieldBreakFlash.style.opacity = '0.9';
    setTimeout(() => { shieldBreakFlash.style.opacity = '0'; }, 450);
    mobileShieldBtn.classList.add('broken');
    shieldIndicator.classList.add('broken');
  }

  hurt(reason, cost = 25) {
    if (this.hurtCooldown > 0) return;
    if (shieldActive && !shieldBroken && shieldEnergy > 0) {
      shieldEnergy = Math.max(0, shieldEnergy - cost);
      shieldBlockFlash = 0.35;
      audio.shieldBlock();
      stats.blocks++;
      spawnParticles(this.x + this.w/2, this.y + this.h/2, 16, '#a0d8ff', 5, 0.7, 'shard');
      floatTexts.push(new FloatText(this.x + this.w/2, this.y + this.h/2 - 25, '🛡️ BLOCKED', '#a0d8ff', 22));
      this.hurtCooldown = 0.35;
      shieldFlash.style.opacity = '0.7';
      setTimeout(() => { shieldFlash.style.opacity = '0'; }, 150);
      if (shieldEnergy <= 0) this.breakShield();
      return;
    }
    this.hurtCooldown = 1.0;
    stats.damageTaken++;
    this.die(reason || 'Shot by an archer!');
  }

  update(dt) {
    if (this.dead) return;

    if (this.attackTimer > 0) this.attackTimer -= dt;
    if (this.hurtCooldown > 0) this.hurtCooldown -= dt;
    if (this.guardHitCooldown > 0) this.guardHitCooldown -= dt;
    if (shieldBlockFlash > 0) shieldBlockFlash -= dt;

    const wantsShield = !!keys['g'] || !!keys['G'];
    updateShieldState(dt, wantsShield, this, audio, {
      mobileShieldBtn, shieldIndicator, floatTexts, FloatText
    });

    const wantsFly = !!keys['f'] || !!keys['F'];
    const flyVy = updateFlyState(dt, wantsFly, this, keys, audio);
    if (flyVy !== null) {
      this.vy = lerp(this.vy, flyVy, 0.25);
      this.onGround = false;
      stats.flyTime += dt;
    }

    regenPowers(dt, this);

    shieldIndicator.classList.toggle('active', shieldActive && !shieldBroken);
    mobileShieldBtn.classList.toggle('broken', shieldBroken);
    this.shieldPulse = shieldActive ? (Math.sin(performance.now() / 120) * 0.3 + 0.7) : 0;

    let ax = 0;
    if (keys['ArrowLeft'] || keys['a'] || keys['A']) { ax -= 1; this.facing = -1; }
    if (keys['ArrowRight'] || keys['d'] || keys['D']) { ax += 1; this.facing = 1; }

    if (this.onGround) this.coyoteTime = PHYSICS.coyoteTime;
    else this.coyoteTime = Math.max(0, this.coyoteTime - dt);

    if (keys['ArrowUp'] || keys[' '] || keys['w'] || keys['W']) this.jumpBuffer = PHYSICS.jumpBuffer;
    else this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);

    if (!this.flying && this.jumpBuffer > 0 && this.coyoteTime > 0) {
      this.vy = JUMP_FORCE;
      this.onGround = false;
      this.coyoteTime = 0;
      this.jumpBuffer = 0;
      audio.jump();
      for (let i = 0; i < 8; i++) {
        particles.push(new Particle(
          this.x + this.w/2 + rand(-10,10),
          this.y + this.h,
          rand(-2,2), rand(-1,1), 0.6, currentTheme.particle, rand(2,5)
        ));
      }
    }

    let friction = 0.35;
    if (currentWorldRule.hazard === 'ice' || currentWorldRule.hazard === 'slippery') {
      friction = currentWorldRule.friction;
    }
    const targetVx = ax * MOVE_SPEED;
    if (this.onGround) this.vx = lerp(this.vx, targetVx, friction);
    else if (ax !== 0) this.vx = targetVx;

    if (currentWorldRule.currentPush && !this.onGround) {
      this.vx += currentWorldRule.currentPush * 0.1;
    }
    if (currentWorldRule.windGust && Math.random() < 0.01) {
      this.vx += rand(-1, 1) * currentWorldRule.windGust;
    }

    if (Math.abs(this.vx) > 1 && this.onGround) {
      footstepTimer += dt;
      if (footstepTimer > 0.2) { footstepTimer = 0; audio.footstep(); }
    }

    this.x += this.vx;
    if (this.collides()) {
      const stepDir = this.vx > 0 ? -1 : 1;
      while (this.collides()) this.x += stepDir;
      this.vx = 0;
    }

    if (this.flying) this.y += this.vy;
    else {
      this.vy = Math.min(this.vy + GRAVITY, MAX_FALL);
      if (currentWorldRule.windUp) this.vy += currentWorldRule.windUp;
      this.y += this.vy;
    }

    this.onGround = false;
    if (this.collides()) {
      if (this.vy > 0) {
        const feetTile = Math.floor((this.y + this.h) / TILE);
        this.y = feetTile * TILE - this.h;
        if (this.vy > 10) {
          shakeAmount = 4;
          for (let i = 0; i < 6; i++) {
            particles.push(new Particle(
              this.x + this.w/2 + rand(-15,15),
              this.y + this.h,
              rand(-2,2), rand(-2,0), 0.5, currentTheme.particle, rand(2,4)
            ));
          }
        }
        this.vy = 0;
        this.onGround = true;
      } else {
        const headTile = Math.floor(this.y / TILE);
        this.y = (headTile + 1) * TILE;
        this.vy = 0;
      }
    }

    this.x = clamp(this.x, 0, W - this.w);
    if (this.y > H + 100) {
      if (shieldActive && !shieldBroken && shieldEnergy > 0) {
        shieldEnergy = Math.max(0, shieldEnergy - 30);
        floatTexts.push(new FloatText(this.x, H - 80, '🛡️ RESCUED', '#a0d8ff', 22));
        this.x = doorCell.x * TILE + 12;
        this.y = doorCell.y * TILE + 8;
        this.vx = 0; this.vy = 0;
        if (shieldEnergy <= 0) this.breakShield();
      } else {
        this.die('Fell into darkness!');
      }
      return;
    }
    if (this.onGround && Math.abs(this.vx) > 1) this.anim += dt * 12;

    // tile hazards
    const cx1 = Math.floor((this.x + 10) / TILE);
    const cx2 = Math.floor((this.x + this.w - 10) / TILE);
    const cy1 = Math.floor((this.y + this.h - 6) / TILE);
    const cy2 = Math.floor((this.y + this.h - 1) / TILE);
    for (let ty = cy1; ty <= cy2; ty++) {
      for (let tx = cx1; tx <= cx2; tx++) {
        if (ty >= 0 && ty < ROWS && tx >= 0 && tx < COLS) {
          const t = grid[ty][tx];
          if (t === 2) { this.hurt('Pierced by spikes!', SHIELD_BLOCK_COST_SPIKE); return; }
          if (t === 4) { this.hurt('Swallowed by the depths!', SHIELD_BLOCK_COST_SPIKE); return; }
        }
      }
    }

    if (performance.now() > invulnUntil && this.guardHitCooldown <= 0) {
      for (const g of guards) {
        if (g.dead) continue;
        const gx = g.x * TILE + 12, gy = g.y * TILE + 8;
        const gw = TILE - 24, gh = TILE - 8;
        if (this.x < gx + gw && this.x + this.w > gx &&
            this.y < gy + gh && this.y + this.h > gy) {
          this.hurt('Slain by the guard!', SHIELD_BLOCK_COST_GUARD);
          this.guardHitCooldown = 0.6;
          return;
        }
      }
    }

    for (const ms of movingSpikes) {
      if (Math.abs(ms.px - (this.x + this.w/2)) < 35 &&
          Math.abs(ms.py - (this.y + this.h/2)) < 35) {
        this.hurt('Sliced by moving spikes!', SHIELD_BLOCK_COST_SPIKE);
        return;
      }
    }

    // coins
    for (let i = coins.length - 1; i >= 0; i--) {
      const c = coins[i];
      const cx = c.x * TILE + TILE/2;
      const cy = c.y * TILE + TILE/2;
      if (this.x < cx + 22 && this.x + this.w > cx - 22 &&
          this.y < cy + 22 && this.y + this.h > cy - 22) {
        coins.splice(i, 1);
        audio.coin();
        stats.coins++;
        spawnParticles(cx, cy, 10, currentTheme.accent, 4, 0.6);
        floatTexts.push(new FloatText(cx, cy - 20, '+10', currentTheme.accent, 24));
        score += 10; scoreEl.textContent = score;
      }
    }

    // pickups
    for (let i = pickups.length - 1; i >= 0; i--) {
      const p = pickups[i];
      const px = p.x * TILE + TILE/2;
      const py = p.y * TILE + TILE/2;
      if (this.x < px + 25 && this.x + this.w > px - 25 &&
          this.y < py + 25 && this.y + this.h > py - 25) {
        pickups.splice(i, 1);
        applyPickup(p, px, py);
      }
    }

    if (exitCell && !exitLocked) {
      const exX = exitCell.x * TILE;
      const exY = exitCell.y * TILE;
      if (this.x < exX + TILE &&
          this.x + this.w > exX &&
          this.y < exY + TILE &&
          this.y + this.h > exY) {
        winLevel();
      }
    }

    flyIndicator.classList.toggle('active', this.flying);
    flyIndicator.textContent = formatFlyText(this);
    shieldIndicator.textContent = formatShieldText();
  }

  collides() {
    const x1 = Math.floor(this.x / TILE);
    const x2 = Math.floor((this.x + this.w - 1) / TILE);
    const y1 = Math.floor(this.y / TILE);
    const y2 = Math.floor((this.y + this.h - 1) / TILE);
    for (let ty = y1; ty <= y2; ty++) {
      for (let tx = x1; tx <= x2; tx++) {
        if (tx < 0 || tx >= COLS || ty < 0 || ty >= ROWS) {
          if (ty >= ROWS) continue;
          return true;
        }
        const t = grid[ty][tx];
        if (t === 1 || t === 5) return true;
      }
    }
    return false;
  }

  die(reason) {
    if (this.dead || gameState !== 'playing') return;
    this.dead = true;
    this.flying = false;
    shieldActive = false;
    shieldBroken = false;
    shieldBreakTimer = 0;
    audio.death();
    shakeAmount = 20;
    spawnBlood(this.x + this.w/2, this.y + this.h/2);
    lives--;
    updateHUD();
    damageFlash.style.opacity = '0.8';
    setTimeout(() => { damageFlash.style.opacity = '0'; }, 300);
    if (lives <= 0) {
      gameState = 'dead';
      document.getElementById('deathReason').textContent = reason;
      setTimeout(() => {
        document.getElementById('gameOverScreen').classList.remove('hidden');
      }, 1000);
    } else {
      setTimeout(() => {
        if (gameState === 'playing') {
          this.x = doorCell.x * TILE + 12;
          this.y = doorCell.y * TILE + 8;
          this.vx = 0; this.vy = 0;
          this.dead = false;
          this.flyEnergy = FLY_MAX_ENERGY;
          shieldEnergy = SHIELD_MAX_ENERGY;
          shieldBroken = false;
          shieldBreakTimer = 0;
          this.hurtCooldown = 0;
          invulnUntil = performance.now() + 1500;
        }
      }, 800);
    }
  }

  draw(ctx) {
    if (this.dead) return;
    if (performance.now() < invulnUntil && Math.floor(performance.now() / 80) % 2 === 0) return;
    const bob = this.onGround && Math.abs(this.vx) > 1 ? Math.sin(this.anim) * 2 : 0;

    if (this.flying) {
      const auraPulse = 0.5 + Math.sin(performance.now() / 100) * 0.3;
      const cx = this.x + this.w/2;
      const cy = this.y + this.h/2;
      const glow = ctx.createRadialGradient(cx, cy, 5, cx, cy, 50);
      glow.addColorStop(0, `rgba(160, 232, 255, ${auraPulse * 0.6})`);
      glow.addColorStop(1, 'rgba(160, 232, 255, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, cy, 50, 0, Math.PI * 2);
      ctx.fill();
      if (Math.random() < 0.4) {
        particles.push(new Particle(
          cx + rand(-15, 15), this.y + this.h + rand(-5, 10),
          rand(-1, 1), rand(0.5, 2.5), 0.5, '#a0e8ff', rand(2, 4), -0.05
        ));
      }
    }

    if (shieldActive && !shieldBroken && this.shieldPulse > 0) {
      const cx = this.x + this.w/2;
      const cy = this.y + this.h/2;
      const r = 48 + Math.sin(performance.now() / 90) * 4;
      const intensity = 0.35 + (shieldEnergy / SHIELD_MAX_ENERGY) * 0.5;
      ctx.save();
      ctx.globalAlpha = intensity * 0.5;
      const outerGlow = ctx.createRadialGradient(cx, cy, r * 0.7, cx, cy, r * 1.3);
      outerGlow.addColorStop(0, 'rgba(160, 220, 255, 0.4)');
      outerGlow.addColorStop(1, 'rgba(160, 220, 255, 0)');
      ctx.fillStyle = outerGlow;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 1.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = intensity;
      const sg = ctx.createRadialGradient(cx - r*0.3, cy - r*0.3, r * 0.2, cx, cy, r);
      sg.addColorStop(0, 'rgba(200, 235, 255, 0.5)');
      sg.addColorStop(0.7, 'rgba(140, 200, 255, 0.25)');
      sg.addColorStop(1, 'rgba(80, 150, 220, 0.1)');
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = intensity + 0.3;
      ctx.strokeStyle = `rgba(180, 230, 255, ${0.7 + Math.sin(performance.now()/150)*0.2})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = intensity * 0.8;
      ctx.strokeStyle = 'rgba(200, 240, 255, 0.6)';
      ctx.lineWidth = 1.2;
      const rot = performance.now() / 1200;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + rot;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * r * 0.35, cy + Math.sin(a) * r * 0.35);
        ctx.lineTo(cx + Math.cos(a) * r * 0.88, cy + Math.sin(a) * r * 0.88);
        ctx.stroke();
      }
      if (shieldBlockFlash > 0) {
        ctx.globalAlpha = shieldBlockFlash * 2;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(cx, cy, r + 6, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }

    ctx.save();
    ctx.translate(this.x + this.w/2, this.y + this.h/2 + bob);
    ctx.scale(this.facing, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.ellipse(0, this.h/2 + 4, this.w/2, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    if (this.flying) {
      const wingFlap = Math.sin(performance.now() / 60) * 0.5;
      ctx.save();
      ctx.translate(-10, -15);
      ctx.rotate(-0.8 + wingFlap);
      ctx.fillStyle = 'rgba(200, 240, 255, 0.85)';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(-35, -15, -45, 5);
      ctx.quadraticCurveTo(-30, 15, 0, 10);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#7fd0ff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
      ctx.save();
      ctx.translate(10, -15);
      ctx.rotate(0.8 - wingFlap);
      ctx.scale(-1, 1);
      ctx.fillStyle = 'rgba(200, 240, 255, 0.85)';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(-35, -15, -45, 5);
      ctx.quadraticCurveTo(-30, 15, 0, 10);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#7fd0ff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    }

    const legSwing = this.onGround && Math.abs(this.vx) > 1 ? Math.sin(this.anim) * 6 : (this.flying ? Math.sin(performance.now()/100) * 4 : 0);
    ctx.fillStyle = '#2a3a4a';
    ctx.fillRect(-8 + legSwing, this.h/2 - 12, 7, 16);
    ctx.fillRect(1 - legSwing, this.h/2 - 12, 7, 16);
    const bg = ctx.createLinearGradient(-12, -20, 12, 20);
    bg.addColorStop(0, '#faf5e5');
    bg.addColorStop(1, '#c8c0a8');
    ctx.fillStyle = bg;
    ctx.fillRect(-12, -20, 24, 26);
    ctx.fillStyle = '#8b2a1a';
    ctx.fillRect(-12, 2, 24, 5);
    ctx.fillStyle = '#ffd27f';
    ctx.fillRect(-3, 2, 6, 5);
    ctx.fillStyle = '#e8c8a0';
    ctx.beginPath();
    ctx.arc(0, -28, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1a1008';
    ctx.beginPath();
    ctx.arc(0, -32, 9, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(-9, -32, 3, 8);
    ctx.fillRect(6, -32, 3, 8);
    ctx.fillStyle = '#1a0e08';
    ctx.fillRect(3, -30, 3, 3);
    ctx.fillStyle = '#fff';
    ctx.fillRect(3, -30, 1, 1);
    const armSwing = this.onGround && Math.abs(this.vx) > 1 ? Math.sin(this.anim) * 4 : 0;
    ctx.fillStyle = '#e8c8a0';
    ctx.fillRect(-16 + armSwing, -12, 5, 14);
    if (shieldActive && !shieldBroken) {
      ctx.save();
      ctx.translate(14, -6);
      ctx.fillStyle = 'rgba(160, 220, 255, 0.55)';
      ctx.strokeStyle = '#7fbfff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, 0, 8, 18, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    const swordAngle = this.attackTimer > 0 ? -0.5 : 0;
    ctx.save();
    ctx.translate(-18 + armSwing, -8);
    ctx.rotate(swordAngle);
    ctx.fillStyle = '#d0d0d8';
    ctx.fillRect(-2, -22, 4, 22);
    ctx.fillStyle = '#8b6f3a';
    ctx.fillRect(-6, -2, 12, 4);
    if (this.attackTimer > 0) {
      ctx.shadowColor = '#ffd27f';
      ctx.shadowBlur = 15;
      ctx.fillStyle = '#ffd27f';
      ctx.beginPath();
      ctx.arc(0, -22, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
    ctx.restore();
    ctx.restore();

    if (this.attackTimer > 0) {
      const progress = 1 - (this.attackTimer / 0.25);
      ctx.globalAlpha = 1 - progress;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 4;
      ctx.beginPath();
      const ax = this.x + this.w/2;
      const ay = this.y + this.h/2;
      const startAng = this.facing > 0 ? -0.8 : Math.PI + 0.8;
      const endAng = this.facing > 0 ? 0.5 : Math.PI - 0.5;
      const curAng = lerp(startAng, endAng, progress);
      ctx.arc(ax, ay, 45, curAng - 0.4, curAng + 0.4);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }
}

// ============================================================
// GUARD
// ============================================================
class Guard {
  constructor(tx, ty, boss = false) {
    this.x = tx; this.y = ty;
    this.vx = boss ? 3 : 2;
    this.minX = Math.max(0, tx - (boss ? 4 : 2));
    this.maxX = Math.min(COLS - 1, tx + (boss ? 4 : 2));
    this.anim = 0;
    this.hp = boss ? 8 : 3;
    this.maxHp = this.hp;
    this.dead = false;
    this.facing = 1;
    this.boss = boss;
  }
  update(dt) {
    if (this.dead) return;
    this.anim += dt * 8;
    this.x += this.vx * dt;
    this.facing = this.vx > 0 ? 1 : -1;
    if (this.x <= this.minX) { this.x = this.minX; this.vx = Math.abs(this.vx); }
    if (this.x >= this.maxX) { this.x = this.maxX; this.vx = -Math.abs(this.vx); }
    const belowY = Math.floor(this.y) + 1;
    const gx = Math.floor(this.x);
    if (belowY < ROWS && gx >= 0 && gx < COLS) {
      const below = grid[belowY] && grid[belowY][gx];
      if (below !== 1 && below !== 3 && below !== 5) {
        this.y = Math.min(ROWS - 1, this.y + 1);
      }
    }
  }
  draw(ctx) {
    if (this.dead) return;
    const cx = this.x * TILE + TILE/2;
    const cy = this.y * TILE + TILE/2;
    const bob = Math.sin(this.anim) * 2;
    const scale = this.boss ? 1.4 : 1;
    ctx.save();
    ctx.translate(cx, cy + bob);
    ctx.scale(scale, scale);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.ellipse(0, TILE/2 - 4, 22, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.scale(this.facing, 1);
    ctx.fillStyle = '#1a1a2a';
    ctx.fillRect(-14, 10, 10, 24);
    ctx.fillRect(4, 10, 10, 24);
    const bg = ctx.createLinearGradient(-18, -24, 18, 24);
    bg.addColorStop(0, this.boss ? '#8a2a2a' : '#5a3a2a');
    bg.addColorStop(1, this.boss ? '#4a0a0a' : '#2a1a10');
    ctx.fillStyle = bg;
    ctx.fillRect(-18, -24, 36, 36);
    ctx.fillStyle = '#6a4a2a';
    ctx.fillRect(-12, -18, 24, 16);
    ctx.fillStyle = '#cc2222';
    ctx.beginPath();
    ctx.arc(0, -10, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8c8a0';
    ctx.beginPath();
    ctx.arc(0, -36, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#8b6f3a';
    ctx.beginPath();
    ctx.arc(0, -38, 12, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(-12, -38, 24, 4);
    ctx.fillStyle = '#ff3020';
    ctx.shadowColor = '#ff3020';
    ctx.shadowBlur = 8;
    ctx.fillRect(4, -38, 4, 3);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#e8c8a0';
    ctx.fillRect(14, -12, 6, 16);
    ctx.fillStyle = '#c8c8d0';
    ctx.fillRect(18, -30, 4, 32);
    ctx.fillStyle = '#8b6f3a';
    ctx.fillRect(14, -30, 12, 5);
    ctx.restore();
    if (this.hp < this.maxHp) {
      const barW = this.boss ? 70 : 40, barH = this.boss ? 7 : 5;
      const bx = cx - barW/2, by = cy - (this.boss ? 78 : 55);
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(bx - 1, by - 1, barW + 2, barH + 2);
      ctx.fillStyle = this.boss ? '#ffaa20' : '#ff4444';
      ctx.fillRect(bx, by, barW * this.hp / this.maxHp, barH);
    }
    if (this.boss) {
      ctx.fillStyle = '#ffaa20';
      ctx.font = 'bold 16px Georgia';
      ctx.textAlign = 'center';
      ctx.shadowColor = '#ffaa20';
      ctx.shadowBlur = 10;
      ctx.fillText('👑 BOSS', cx, cy - 85);
      ctx.shadowBlur = 0;
    }
  }
}

// ============================================================
// ARCHER
// ============================================================
class Archer {
  constructor(tx, ty) {
    this.x = tx; this.y = ty;
    this.hp = 2;
    this.dead = false;
    this.anim = 0;
    this.shootTimer = rand(0.5, 1.5);
    this.facing = -1;
    this.bowDraw = 0;
    this.alerted = false;
  }
  update(dt, target) {
    if (this.dead) return;
    this.anim += dt * 6;
    if (!target) return;
    const myCx = this.x * TILE + TILE/2;
    const myCy = this.y * TILE + TILE/2 - 10;
    const tx = target.x + target.w / 2;
    const ty = target.y + target.h / 2;
    const dx = tx - myCx, dy = ty - myCy;
    const dist = Math.sqrt(dx*dx + dy*dy);
    this.facing = dx > 0 ? 1 : -1;
    this.alerted = dist < 700;
    if (this.alerted && !target.dead) {
      const interval = target.flying ? ARCHER_SHOOT_INTERVAL_FLYING : ARCHER_SHOOT_INTERVAL;
      this.shootTimer -= dt;
      if (this.shootTimer <= 0) {
        this.shootTimer = interval;
        this.bowDraw = 0.3;
        this.shoot(target);
      }
    } else {
      this.shootTimer = Math.min(this.shootTimer, 1.5);
    }
    if (this.bowDraw > 0) this.bowDraw -= dt;
  }
  shoot(target) {
    const myCx = this.x * TILE + TILE/2;
    const myCy = this.y * TILE + TILE/2 - 10;
    let predictX = target.x + target.w / 2;
    let predictY = target.y + target.h / 2;
    if (target.flying) {
      predictX += target.vx * 8;
      predictY += target.vy * 8;
    }
    arrows.push(new Arrow(myCx, myCy, predictX, predictY));
    audio.bowShoot();
    spawnParticles(myCx + this.facing * 20, myCy, 5, '#ff8a40', 2, 0.4);
  }
  draw(ctx) {
    if (this.dead) return;
    const cx = this.x * TILE + TILE/2;
    const cy = this.y * TILE + TILE/2;
    const bob = Math.sin(this.anim) * 1.5;
    ctx.save();
    ctx.translate(cx, cy + bob);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.ellipse(0, TILE/2 - 4, 20, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.scale(this.facing, 1);
    ctx.fillStyle = '#2a1a10';
    ctx.fillRect(-12, 10, 8, 24);
    ctx.fillRect(4, 10, 8, 24);
    const bg = ctx.createLinearGradient(-16, -22, 16, 22);
    bg.addColorStop(0, '#4a6a2a');
    bg.addColorStop(1, '#2a3a15');
    ctx.fillStyle = bg;
    ctx.fillRect(-16, -22, 32, 34);
    ctx.fillStyle = '#8b6f3a';
    ctx.fillRect(-16, 0, 32, 4);
    ctx.fillStyle = '#e8c8a0';
    ctx.beginPath();
    ctx.arc(0, -32, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3a5a1a';
    ctx.beginPath();
    ctx.arc(0, -34, 11, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(-11, -34, 22, 5);
    ctx.fillStyle = this.alerted ? '#ff3020' : '#1a0e08';
    if (this.alerted) { ctx.shadowColor = '#ff3020'; ctx.shadowBlur = 6; }
    ctx.fillRect(3, -33, 3, 2);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#e8c8a0';
    ctx.fillRect(12, -12, 6, 12);
    ctx.strokeStyle = '#8b4a1a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(18, -6, 16, -Math.PI/2.3, Math.PI/2.3);
    ctx.stroke();
    ctx.strokeStyle = '#e8d5a8';
    ctx.lineWidth = 1;
    const drawPull = this.bowDraw > 0 ? 8 : 0;
    ctx.beginPath();
    ctx.moveTo(18 + Math.cos(-Math.PI/2.3) * 16, -6 + Math.sin(-Math.PI/2.3) * 16);
    ctx.lineTo(10 - drawPull, -6);
    ctx.lineTo(18 + Math.cos(Math.PI/2.3) * 16, -6 + Math.sin(Math.PI/2.3) * 16);
    ctx.stroke();
    if (this.bowDraw > 0) {
      ctx.strokeStyle = '#c8c8d0';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(10 - drawPull, -6);
      ctx.lineTo(28, -6);
      ctx.stroke();
      ctx.fillStyle = '#c8c8d0';
      ctx.beginPath();
      ctx.moveTo(28, -9);
      ctx.lineTo(34, -6);
      ctx.lineTo(28, -3);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    if (this.hp < 2) {
      const barW = 36, barH = 4;
      const bx = cx - barW/2, by = cy - 55;
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(bx - 1, by - 1, barW + 2, barH + 2);
      ctx.fillStyle = '#ff8a40';
      ctx.fillRect(bx, by, barW * this.hp / 2, barH);
    }
    if (this.alerted && !this.dead) {
      ctx.fillStyle = '#ff3020';
      ctx.font = 'bold 18px Georgia';
      ctx.textAlign = 'center';
      ctx.shadowColor = '#ff3020';
      ctx.shadowBlur = 10;
      ctx.fillText('!', cx, cy - 62);
      ctx.shadowBlur = 0;
    }
  }
}

// ============================================================
// PICKUP TYPES
// ============================================================
const PICKUP_TYPES = {
  gem:       { color: '#ff40a0', icon: '💎' },
  potion:    { color: '#8aff70', icon: '❤️' },
  flyOrb:    { color: '#7fd0ff', icon: '🕊️' },
  shieldOrb: { color: '#a0d8ff', icon: '🛡️' },
  key:       { color: '#ffd27f', icon: '🔑' },
  treasure:  { color: '#ffaa20', icon: '💰' }
};

function applyPickup(p, px, py) {
  const def = PICKUP_TYPES[p.type];
  if (!def) return;
  if (p.type === 'gem') {
    score += 50; audio.gem();
    floatTexts.push(new FloatText(px, py - 20, '+50 💎', '#ff40a0', 26));
    spawnParticles(px, py, 18, '#ff40a0', 6, 1);
  } else if (p.type === 'potion') {
    if (lives < 3) lives++;
    audio.potion();
    floatTexts.push(new FloatText(px, py - 20, '+❤️', '#8aff70', 26));
    spawnParticles(px, py, 12, '#8aff70', 4, 0.7);
  } else if (p.type === 'flyOrb') {
    if (player) player.flyEnergy = FLY_MAX_ENERGY;
    audio.powerup();
    floatTexts.push(new FloatText(px, py - 20, '🕊️ REFILL', '#7fd0ff', 24));
    spawnParticles(px, py, 18, '#7fd0ff', 5, 0.9);
  } else if (p.type === 'shieldOrb') {
    shieldEnergy = SHIELD_MAX_ENERGY;
    if (shieldBroken) { shieldBroken = false; shieldBreakTimer = 0; }
    audio.powerup();
    floatTexts.push(new FloatText(px, py - 20, '🛡️ REFILL', '#a0d8ff', 24));
    spawnParticles(px, py, 18, '#a0d8ff', 5, 0.9);
  } else if (p.type === 'key') {
    exitLocked = false;
    audio.unlock();
    floatTexts.push(new FloatText(px, py - 20, '🔑 KEY!', '#ffd27f', 26));
    showBanner('🔑 EXIT UNLOCKED', '#ffd27f');
  } else if (p.type === 'treasure') {
    score += 100; audio.gem();
    floatTexts.push(new FloatText(px, py - 20, '+100 💰', '#ffaa20', 28));
    spawnParticles(px, py, 20, '#ffaa20', 6, 1);
  }
  scoreEl.textContent = score;
  updateHUD();
}

// ============================================================
// MOVING SPIKE
// ============================================================
class MovingSpike {
  constructor(tx, ty) {
    this.baseX = tx * TILE + TILE/2;
    this.baseY = ty * TILE + TILE/2;
    this.px = this.baseX;
    this.py = this.baseY;
    this.phase = rand(0, Math.PI * 2);
    this.range = TILE * 1.2;
    this.speed = 2;
  }
  update(dt) {
    this.phase += dt * this.speed;
    this.px = this.baseX + Math.sin(this.phase) * this.range;
    this.py = this.baseY;
  }
  draw(ctx) {
    ctx.save();
    ctx.translate(this.px, this.py);
    ctx.fillStyle = '#ff3020';
    ctx.shadowColor = '#ff3020';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(-12, 12);
    ctx.lineTo(0, -16);
    ctx.lineTo(12, 12);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#ffaa20';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.restore();
  }
}

// ============================================================
// BANNER + TIMERS
// ============================================================
let bannerTimeout = null;
let beatTimeout = null;
let transitionTimeout = null;

function showBanner(text, color) {
  if (bannerTimeout) clearTimeout(bannerTimeout);
  worldBanner.textContent = text;
  worldBanner.style.color = color || '#ffd27f';
  worldBanner.classList.add('show');
  bannerTimeout = setTimeout(() => {
    worldBanner.classList.remove('show');
    bannerTimeout = null;
  }, 1800);
}

function cancelPendingTimers() {
  if (bannerTimeout) { clearTimeout(bannerTimeout); bannerTimeout = null; }
  if (beatTimeout) { clearTimeout(beatTimeout); beatTimeout = null; }
  if (transitionTimeout) { clearTimeout(transitionTimeout); transitionTimeout = null; }
  worldBanner.classList.remove('show');
}

// ============================================================
// LEVEL LOADING
// ============================================================
function loadLevel(worldKey, levelIdx, useProcedural = false) {
  currentWorld = worldKey;
  currentTheme = THEMES[worldKey] || THEMES.sand;
  currentWorldRule = WORLD_RULES[worldKey] || WORLD_RULES.sand;
  levelInWorld = levelIdx;
  worldIndex = WORLD_ORDER.indexOf(worldKey);

  if (beatTimeout) { clearTimeout(beatTimeout); beatTimeout = null; }

  let raw;
  if (useProcedural) {
    raw = generateProceduralLevel(worldKey, globalStage);
  } else {
    raw = LEVELS[worldKey][levelIdx];
  }

  grid = [];
  guards = [];
  archers = [];
  arrows = [];
  coins = [];
  pickups = [];
  breakable = [];
  movingSpikes = [];
  particles = [];
  floatTexts = [];
  exitCell = null;
  exitLocked = false;

  const diff = getDifficulty(globalStage);

  for (let y = 0; y < ROWS; y++) {
    const row = [];
    for (let x = 0; x < COLS; x++) {
      const ch = raw[y] && raw[y][x] ? raw[y][x] : '.';
      let cell = 0;
      switch (ch) {
        case '#': cell = 1; break;
        case '^': cell = 2; break;
        case 'E': cell = 3; exitCell = { x, y }; break;
        case 'D': cell = 0; doorCell = { x, y }; break;
        case '~': cell = 4; break;
        case 'B': cell = 5; breakable.push({ x, y, hp: 2 }); break;
        case 'G': cell = 0; guards.push(new Guard(x, y)); break;
        case 'A': cell = 0; archers.push(new Archer(x, y)); break;
        case 'C': cell = 0; coins.push({ x, y }); break;
        case '$': cell = 0; pickups.push({ x, y, type: 'gem' }); break;
        case 'H': cell = 0; pickups.push({ x, y, type: 'potion' }); break;
        case 'P': cell = 0; pickups.push({ x, y, type: 'flyOrb' }); break;
        case 'Q': cell = 0; pickups.push({ x, y, type: 'shieldOrb' }); break;
        case 'K': cell = 0; pickups.push({ x, y, type: 'key' }); break;
        case 'T': cell = 0; pickups.push({ x, y, type: 'treasure' }); break;
        case 'L': cell = 3; exitCell = { x, y }; exitLocked = true; break;
        case 'M': cell = 0; movingSpikes.push(new MovingSpike(x, y)); break;
        case 'R': cell = 0; guards.push(new Guard(x, y, true)); break;
        default:  cell = 0;
      }
      row.push(cell);
    }
    grid.push(row);
  }

  // enemy cap
  const totalEnemies = guards.length + archers.length;
  if (totalEnemies > MAX_ENEMIES_PER_STAGE) {
    let toRemove = totalEnemies - MAX_ENEMIES_PER_STAGE;
    while (toRemove > 0 && (guards.length > 0 || archers.length > 0)) {
      if (guards.length >= archers.length && guards.length > 0) guards.pop();
      else if (archers.length > 0) archers.pop();
      toRemove--;
    }
  }

  player = new Player(doorCell.x, doorCell.y);
  timeLeft = diff.time || 90;
  resetShieldState();
  invulnUntil = performance.now() + 800;
  stats.levelTime = 0;
  stats.damageTaken = 0;
  updateHUD();

  if (levelInWorld === 0) {
    const beat = getStoryBeat(worldIndex);
    if (beat) {
      beatTimeout = setTimeout(() => {
        if (gameState === 'playing') {
          showBanner(beat.title + ' — ' + beat.subtitle, '#ffd27f');
        }
        beatTimeout = null;
      }, 300);
    }
  }

  console.log(`[Stage ${globalStage}] world=${worldKey} level=${levelIdx} | ${archers.length}A + ${guards.length}G = ${archers.length + guards.length} enemies`);
}

function updateHUD() {
  heartsEl.textContent = '❤'.repeat(Math.max(0, lives)) + '♡'.repeat(Math.max(0, 3 - lives));
  timerEl.textContent = '⏳ ' + Math.ceil(timeLeft);
  timerEl.classList.toggle('warn', timeLeft <= 15);
  worldNameEl.textContent = currentTheme.name + ' | Stage ' + (globalStage + 1);
  scoreEl.textContent = score;
}

// ============================================================
// ACHIEVEMENTS
// ============================================================
function checkAchievements() {
  stats.stage = globalStage;
  for (const key in ACHIEVEMENTS) {
    if (unlockedAchievements.has(key)) continue;
    const ach = ACHIEVEMENTS[key];
    if (ach.check(stats)) {
      unlockedAchievements.add(key);
      audio.achievement();
      floatTexts.push(new FloatText(W/2, H/2 - 80, '🏆 ' + ach.name, '#ffd27f', 30));
      showBanner('🏆 ' + ach.name + ' — ' + ach.desc, '#ffd27f');
    }
  }
}

// ============================================================
// WIN LEVEL
// ============================================================
function winLevel() {
  if (gameState !== 'playing') return;
  if (transitionTimeout) { clearTimeout(transitionTimeout); transitionTimeout = null; }

  gameState = 'won';
  audio.win();
  shakeAmount = 10;
  stats.levelsCompleted++;
  spawnParticles(player.x + player.w/2, player.y + player.h/2, 25, currentTheme.accent, 5, 1);
  globalStage++;
  checkAchievements();

  const worldLevels = LEVELS[currentWorld] || LEVELS.sand;
  const isLastLevelOfWorld = levelInWorld >= worldLevels.length - 1;

  if (!isLastLevelOfWorld) {
    const nextIdx = levelInWorld + 1;
    const nextWorld = currentWorld;
    const useProc = globalStage >= 12;
    showBanner('LEVEL COMPLETE!', '#8aff70');
    transitionTimeout = setTimeout(() => {
      transitionTimeout = null;
      loadLevel(nextWorld, nextIdx, useProc);
      gameState = 'playing';
    }, 1200);
  } else {
    const nextWorldIdx = worldIndex + 1;
    if (nextWorldIdx < WORLD_ORDER.length) {
      const nextWorld = WORLD_ORDER[nextWorldIdx];
      transitionTimeout = setTimeout(() => {
        transitionTimeout = null;
        loadLevel(nextWorld, 0, true);
        gameState = 'playing';
      }, 800);
    } else {
      loopCount++;
      showBanner('🔥 WORLD LOOP ' + loopCount + ' — MORE CHALLENGE!', '#ff8a40');
      transitionTimeout = setTimeout(() => {
        transitionTimeout = null;
        loadLevel(WORLD_ORDER[0], 0, true);
        gameState = 'playing';
      }, 1600);
    }
  }
}

// ============================================================
// BACKGROUNDS
// ============================================================
function drawBackground() {
  const t = currentTheme;
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, t.bgTop);
  sky.addColorStop(0.6, t.bgMid);
  sky.addColorStop(1, t.bgBottom);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 40; i++) {
    const sx = (i * 137.5 + parallaxOffset * 0.05) % W;
    const sy = (i * 71.3) % (H * 0.55);
    const twinkle = 0.3 + Math.sin(performance.now() / 800 + i) * 0.25;
    ctx.fillStyle = t.star;
    ctx.globalAlpha = twinkle * 0.6;
    ctx.fillRect(sx, sy, 2, 2);
  }
  ctx.globalAlpha = 1;
  if (Math.random() < 0.06) {
    particles.push(new Particle(rand(0, W), rand(0, H * 0.7), rand(-0.3, 0.3), rand(-0.2, 0.4), rand(2, 5), t.detail2, rand(1, 3), -0.01));
  }
  if (t.bgShape === 'dunes') drawDunes();
  else if (t.bgShape === 'mountains') drawMountains();
  else if (t.bgShape === 'waves') drawWaves();
  else if (t.bgShape === 'trees') drawTrees();
  else if (t.bgShape === 'lava') drawLavaBg();

  ctx.save();
  ctx.globalAlpha = 0.5;
  const sunX = W * 0.82, sunY = H * 0.18;
  const glow = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, 120);
  glow.addColorStop(0, t.accent + 'aa');
  glow.addColorStop(1, t.accent + '00');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(sunX, sunY, 120, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = t.accent;
  ctx.beginPath();
  ctx.arc(sunX, sunY, 28, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawDunes() {
  ctx.save();
  ctx.translate(-parallaxOffset * 0.3, 0);
  ctx.fillStyle = currentTheme.detail1;
  ctx.beginPath();
  ctx.moveTo(-200, H * 0.78);
  for (let i = 0; i < 8; i++) {
    const bx = -200 + i * 300;
    ctx.quadraticCurveTo(bx + 75, H * 0.58, bx + 150, H * 0.72);
    ctx.quadraticCurveTo(bx + 225, H * 0.86, bx + 300, H * 0.78);
  }
  ctx.lineTo(W + 400, H); ctx.lineTo(-400, H); ctx.closePath(); ctx.fill();
  ctx.fillStyle = currentTheme.detail2;
  ctx.beginPath();
  ctx.moveTo(-200, H * 0.85);
  for (let i = 0; i < 8; i++) {
    const bx = -200 + i * 300;
    ctx.quadraticCurveTo(bx + 100, H * 0.7, bx + 200, H * 0.82);
    ctx.quadraticCurveTo(bx + 250, H * 0.88, bx + 300, H * 0.85);
  }
  ctx.lineTo(W + 400, H); ctx.lineTo(-400, H); ctx.closePath(); ctx.fill();
  ctx.fillStyle = currentTheme.detail3;
  ctx.beginPath();
  ctx.moveTo(-200, H * 0.92);
  for (let i = 0; i < 8; i++) {
    const bx = -200 + i * 300;
    ctx.quadraticCurveTo(bx + 120, H * 0.82, bx + 240, H * 0.9);
    ctx.quadraticCurveTo(bx + 280, H * 0.94, bx + 300, H * 0.92);
  }
  ctx.lineTo(W + 400, H); ctx.lineTo(-400, H); ctx.closePath(); ctx.fill();
  ctx.restore();
}

function drawMountains() {
  ctx.save();
  ctx.translate(-parallaxOffset * 0.3, 0);
  ctx.fillStyle = currentTheme.detail1;
  for (let i = -1; i < 7; i++) {
    const bx = i * 280;
    ctx.beginPath();
    ctx.moveTo(bx, H * 0.72);
    ctx.lineTo(bx + 110, H * 0.32);
    ctx.lineTo(bx + 220, H * 0.72);
    ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = currentTheme.detail2;
  for (let i = -1; i < 7; i++) {
    const bx = i * 280;
    ctx.beginPath();
    ctx.moveTo(bx + 75, H * 0.43);
    ctx.lineTo(bx + 110, H * 0.32);
    ctx.lineTo(bx + 145, H * 0.43);
    ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = currentTheme.detail3;
  for (let i = -1; i < 6; i++) {
    const bx = i * 400 + 150;
    ctx.beginPath();
    ctx.moveTo(bx, H * 0.82);
    ctx.lineTo(bx + 150, H * 0.5);
    ctx.lineTo(bx + 300, H * 0.82);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  if (Math.random() < 0.3) {
    particles.push(new Particle(rand(0, W), -10, rand(-0.5, 0.5), rand(1, 3), 5, '#ffffff', rand(2, 4), 0.02));
  }
}

function drawWaves() {
  ctx.save();
  ctx.translate(-parallaxOffset * 0.3, 0);
  const t = performance.now() / 1000;
  ctx.fillStyle = currentTheme.detail1;
  ctx.beginPath();
  ctx.moveTo(-100, H * 0.68);
  for (let x = -100; x < W + 100; x += 20) ctx.lineTo(x, H * 0.68 + Math.sin(x * 0.02 + t) * 14);
  ctx.lineTo(W + 100, H); ctx.lineTo(-100, H); ctx.closePath(); ctx.fill();
  ctx.fillStyle = currentTheme.detail2;
  ctx.globalAlpha = 0.35;
  ctx.beginPath();
  ctx.moveTo(-100, H * 0.75);
  for (let x = -100; x < W + 100; x += 20) ctx.lineTo(x, H * 0.75 + Math.sin(x * 0.025 + t * 1.2) * 10);
  ctx.lineTo(W + 100, H); ctx.lineTo(-100, H); ctx.closePath(); ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = currentTheme.detail3;
  ctx.beginPath();
  ctx.moveTo(-100, H * 0.84);
  for (let x = -100; x < W + 100; x += 20) ctx.lineTo(x, H * 0.84 + Math.sin(x * 0.03 + t * 1.5) * 12);
  ctx.lineTo(W + 100, H); ctx.lineTo(-100, H); ctx.closePath(); ctx.fill();
  ctx.restore();
  if (Math.random() < 0.15) {
    particles.push(new Particle(rand(0, W), H - 20, rand(-0.3, 0.3), rand(-2, -0.5), 3, '#a0e8ff', rand(2, 5), -0.05));
  }
}

function drawTrees() {
  ctx.save();
  ctx.translate(-parallaxOffset * 0.3, 0);
  ctx.fillStyle = currentTheme.detail1;
  for (let i = -1; i < 14; i++) {
    const bx = i * 120, th = 180 + (i * 37) % 90;
    ctx.beginPath();
    ctx.moveTo(bx, H); ctx.lineTo(bx + 30, H - th); ctx.lineTo(bx + 60, H);
    ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = currentTheme.detail2;
  for (let i = -1; i < 11; i++) {
    const bx = i * 160 + 80, th = 240 + (i * 53) % 110;
    ctx.beginPath();
    ctx.moveTo(bx, H); ctx.lineTo(bx + 45, H - th); ctx.lineTo(bx + 90, H);
    ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = currentTheme.detail3;
  for (let i = -1; i < 8; i++) {
    const bx = i * 240 + 40, th = 300 + (i * 61) % 120;
    ctx.fillRect(bx + 40, H - 80, 16, 80);
    ctx.beginPath();
    ctx.moveTo(bx, H - 40); ctx.lineTo(bx + 48, H - th); ctx.lineTo(bx + 96, H - 40);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  if (Math.random() < 0.1) {
    particles.push(new Particle(rand(0, W), rand(H * 0.3, H * 0.9), rand(-0.5, 0.5), rand(-0.5, 0.5), 2, '#ffd27f', rand(2, 4), 0));
  }
}

function drawLavaBg() {
  ctx.save();
  ctx.translate(-parallaxOffset * 0.3, 0);
  const t = performance.now() / 500;
  ctx.fillStyle = currentTheme.detail1;
  ctx.beginPath();
  ctx.moveTo(-100, H * 0.7);
  for (let x = -100; x < W + 100; x += 20) ctx.lineTo(x, H * 0.7 + Math.sin(x * 0.03 + t) * 18);
  ctx.lineTo(W + 100, H); ctx.lineTo(-100, H); ctx.closePath(); ctx.fill();
  ctx.fillStyle = currentTheme.detail2;
  ctx.globalAlpha = 0.6;
  ctx.beginPath();
  ctx.moveTo(-100, H * 0.82);
  for (let x = -100; x < W + 100; x += 20) ctx.lineTo(x, H * 0.82 + Math.sin(x * 0.04 + t * 1.5) * 14);
  ctx.lineTo(W + 100, H); ctx.lineTo(-100, H); ctx.closePath(); ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = currentTheme.detail3;
  ctx.beginPath();
  ctx.moveTo(-100, H * 0.9);
  for (let x = -100; x < W + 100; x += 20) ctx.lineTo(x, H * 0.9 + Math.sin(x * 0.05 + t * 2) * 10);
  ctx.lineTo(W + 100, H); ctx.lineTo(-100, H); ctx.closePath(); ctx.fill();
  ctx.restore();
  if (Math.random() < 0.4) {
    particles.push(new Particle(rand(0, W), H - 10, rand(-0.5, 0.5), rand(-3, -1), 3, '#ff8a40', rand(2, 5), -0.05));
  }
}

// ============================================================
// TILES
// ============================================================
function drawTiles() {
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const t = grid[y][x];
      const px = x * TILE, py = y * TILE;
      if (t === 1) drawBlock(px, py);
      else if (t === 2) drawSpike(px, py);
      else if (t === 3) drawExit(px, py);
      else if (t === 4) drawDeadlyPool(px, py);
      else if (t === 5) drawBreakable(px, py);
    }
  }
  const dx = doorCell.x * TILE, dy = doorCell.y * TILE;
  ctx.save();
  ctx.globalAlpha = 0.3 + Math.sin(performance.now() / 400) * 0.15;
  ctx.fillStyle = currentTheme.accent;
  ctx.fillRect(dx + 8, dy + 8, TILE - 16, TILE - 16);
  ctx.restore();
  ctx.strokeStyle = currentTheme.accent + '99';
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 4]);
  ctx.strokeRect(dx + 8, dy + 8, TILE - 16, TILE - 16);
  ctx.setLineDash([]);
}

function drawBlock(px, py) {
  const t = currentTheme;
  const grad = ctx.createLinearGradient(px, py, px, py + TILE);
  grad.addColorStop(0, t.blockTop);
  grad.addColorStop(0.5, t.blockMid);
  grad.addColorStop(1, t.blockBottom);
  ctx.fillStyle = grad;
  ctx.fillRect(px, py, TILE, TILE);
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 2;
  ctx.strokeRect(px + 1, py + 1, TILE - 2, TILE - 2);
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(px, py + TILE/2); ctx.lineTo(px + TILE, py + TILE/2);
  ctx.moveTo(px + TILE/2, py); ctx.lineTo(px + TILE/2, py + TILE/2);
  ctx.moveTo(px + TILE/4, py + TILE/2); ctx.lineTo(px + TILE/4, py + TILE);
  ctx.moveTo(px + 3*TILE/4, py + TILE/2); ctx.lineTo(px + 3*TILE/4, py + TILE);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.fillRect(px + 3, py + 3, TILE - 6, 3);
  ctx.fillRect(px + 3, py + 3, 3, TILE - 6);
}

function drawSpike(px, py) {
  ctx.fillStyle = '#1a1008';
  ctx.fillRect(px, py + TILE - 12, TILE, 12);
  const count = 4;
  for (let i = 0; i < count; i++) {
    const sx = px + i * (TILE / count) + 4;
    const sw = TILE / count - 8;
    const grad = ctx.createLinearGradient(sx, py + 10, sx + sw/2, py + TILE - 10);
    grad.addColorStop(0, '#e8d5a8');
    grad.addColorStop(0.5, '#b8a080');
    grad.addColorStop(1, '#6a5a4a');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(sx, py + TILE - 12);
    ctx.lineTo(sx + sw/2, py + 12);
    ctx.lineTo(sx + sw, py + TILE - 12);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#3a2a15';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

function drawDeadlyPool(px, py) {
  const t = performance.now() / 500;
  const grad = ctx.createLinearGradient(px, py, px, py + TILE);
  grad.addColorStop(0, '#5a1a0a');
  grad.addColorStop(0.5, '#8a2a0a');
  grad.addColorStop(1, '#2a0505');
  ctx.fillStyle = grad;
  ctx.fillRect(px, py, TILE, TILE);
  ctx.save();
  ctx.globalAlpha = 0.4 + Math.sin(t) * 0.15;
  ctx.fillStyle = '#ff5a20';
  for (let i = 0; i < 4; i++) {
    const bx = px + i * (TILE/4) + 4;
    const by = py + 12 + Math.sin(t + i) * 8;
    ctx.beginPath();
    ctx.arc(bx + 8, by, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawBreakable(px, py) {
  const grad = ctx.createLinearGradient(px, py, px, py + TILE);
  grad.addColorStop(0, currentTheme.blockMid);
  grad.addColorStop(1, currentTheme.blockBottom);
  ctx.fillStyle = grad;
  ctx.fillRect(px, py, TILE, TILE);
  ctx.strokeStyle = '#ff8a40';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.strokeRect(px + 4, py + 4, TILE - 8, TILE - 8);
  ctx.setLineDash([]);
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(px + TILE*0.3, py + TILE*0.3);
  ctx.lineTo(px + TILE*0.7, py + TILE*0.7);
  ctx.moveTo(px + TILE*0.7, py + TILE*0.3);
  ctx.lineTo(px + TILE*0.3, py + TILE*0.7);
  ctx.stroke();
}

function drawExit(px, py) {
  const t = performance.now() / 500;
  const pulse = 0.6 + Math.sin(t) * 0.3;
  const color = exitLocked ? '#ff5555' : currentTheme.accent;
  const glow = ctx.createRadialGradient(px + TILE/2, py + TILE/2, 10, px + TILE/2, py + TILE/2, TILE);
  glow.addColorStop(0, color + '99');
  glow.addColorStop(1, color + '00');
  ctx.fillStyle = glow;
  ctx.fillRect(px - TILE/2, py - TILE/2, TILE * 2, TILE * 2);
  ctx.fillStyle = '#3a2a15';
  ctx.fillRect(px + 4, py + 4, TILE - 8, TILE - 8);
  const grad = ctx.createLinearGradient(px, py, px, py + TILE);
  grad.addColorStop(0, currentTheme.blockTop);
  grad.addColorStop(0.5, currentTheme.blockMid);
  grad.addColorStop(1, currentTheme.blockBottom);
  ctx.fillStyle = grad;
  ctx.fillRect(px + 10, py + 12, TILE - 20, TILE - 12);
  ctx.beginPath();
  ctx.arc(px + TILE/2, py + 12, TILE/2 - 10, Math.PI, 0);
  ctx.fillStyle = currentTheme.blockTop;
  ctx.fill();
  ctx.strokeStyle = '#3a2a15';
  ctx.lineWidth = 2;
  ctx.strokeRect(px + 14, py + 24, TILE - 28, TILE - 32);
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 10 * pulse;
  ctx.beginPath();
  ctx.arc(px + TILE - 20, py + TILE/2 + 6, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  if (exitLocked) {
    ctx.fillStyle = '#ff5555';
    ctx.font = 'bold 24px Georgia';
    ctx.textAlign = 'center';
    ctx.fillText('🔒', px + TILE/2, py + TILE/2 + 8);
  } else {
    const arrowBob = Math.sin(performance.now() / 300) * 6;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(px + TILE/2 - 10, py - 25 + arrowBob);
    ctx.lineTo(px + TILE/2 + 10, py - 25 + arrowBob);
    ctx.lineTo(px + TILE/2, py - 10 + arrowBob);
    ctx.closePath(); ctx.fill();
  }
}

function drawCoins() {
  for (const c of coins) {
    const cx = c.x * TILE + TILE/2;
    const cy = c.y * TILE + TILE/2;
    const bob = Math.sin(performance.now() / 300 + c.x) * 4;
    const spin = Math.abs(Math.cos(performance.now() / 400 + c.x));
    const glow = ctx.createRadialGradient(cx, cy + bob, 2, cx, cy + bob, 30);
    glow.addColorStop(0, 'rgba(255, 220, 100, 0.5)');
    glow.addColorStop(1, 'rgba(255, 220, 100, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy + bob, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.translate(cx, cy + bob);
    ctx.scale(spin, 1);
    ctx.fillStyle = '#ffd27f';
    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#c8943a';
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd27f';
    ctx.font = 'bold 16px Georgia';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('$', 0, 1);
    ctx.restore();
  }
}

function drawPickups() {
  for (const p of pickups) {
    const def = PICKUP_TYPES[p.type];
    if (!def) continue;
    const cx = p.x * TILE + TILE/2;
    const cy = p.y * TILE + TILE/2;
    const bob = Math.sin(performance.now() / 350 + p.x) * 5;
    const pulse = 0.6 + Math.sin(performance.now() / 200) * 0.4;
    const glow = ctx.createRadialGradient(cx, cy + bob, 4, cx, cy + bob, 32);
    glow.addColorStop(0, def.color + 'aa');
    glow.addColorStop(1, def.color + '00');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy + bob, 32 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = 'bold 28px Georgia';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(def.icon, cx, cy + bob);
  }
}

function drawVignette() {
  const grad = ctx.createRadialGradient(W/2, H/2, H * 0.4, W/2, H/2, H * 0.9);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.7)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  if (currentWorldRule.hazard === 'darkness' && player) {
    const px = player.x + player.w/2;
    const py = player.y + player.h/2;
    const visionR = currentWorldRule.visionRadius || 250;
    const vg = ctx.createRadialGradient(px, py, visionR * 0.5, px, py, visionR);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.85)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
  }
}

// ============================================================
// MAIN LOOP
// ============================================================
let timerAcc = 0;
function loop(timestamp) {
  requestAnimationFrame(loop);
  const rawDt = Math.min((timestamp - lastTime) / 1000, 0.05);
  lastTime = timestamp;
  parallaxOffset += 20 * rawDt;

  if (gameState === 'playing') {
    stats.levelTime += rawDt;
    timerAcc += rawDt;
    if (timerAcc >= 1) {
      timerAcc -= 1;
      timeLeft -= 1;
      updateHUD();
      if (timeLeft <= 0) player.die('Time ran out!');
    }

    for (const g of guards) g.update(rawDt);
    for (const a of archers) a.update(rawDt, player);
    for (const ms of movingSpikes) ms.update(rawDt);
    if (player) player.update(rawDt);

    for (let i = arrows.length - 1; i >= 0; i--) {
      const ar = arrows[i];
      ar.update(rawDt, player);
      if (player && !player.dead && performance.now() > invulnUntil) {
        const px = player.x + player.w/2;
        const py = player.y + player.h/2;
        const dx = ar.x - px, dy = ar.y - py;
        if (dx*dx + dy*dy < 35*35) {
          arrows.splice(i, 1);
          audio.arrowHit();
          shakeAmount = 8;
          player.hurt('Shot by an archer!', SHIELD_BLOCK_COST_ARROW);
          continue;
        }
      }
      if (ar.life <= 0 || ar.offscreen()) arrows.splice(i, 1);
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      particles[i].update(rawDt);
      if (particles[i].life <= 0) particles.splice(i, 1);
    }
    for (let i = floatTexts.length - 1; i >= 0; i--) {
      floatTexts[i].update(rawDt);
      if (floatTexts[i].life <= 0) floatTexts.splice(i, 1);
    }
    shakeAmount *= 0.9;

    if (Math.random() < 0.01) checkAchievements();
  }

  ctx.clearRect(0, 0, W, H);
  ctx.save();
  if (shakeAmount > 0.5) ctx.translate(rand(-shakeAmount, shakeAmount), rand(-shakeAmount, shakeAmount));
  drawBackground();
  drawTiles();
  drawCoins();
  drawPickups();
  for (const g of guards) g.draw(ctx);
  for (const a of archers) a.draw(ctx);
  for (const ms of movingSpikes) ms.draw(ctx);
  if (player) player.draw(ctx);
  for (const ar of arrows) ar.draw(ctx);
  for (const p of particles) p.draw(ctx);
  for (const ft of floatTexts) ft.draw(ctx);
  ctx.restore();
  drawVignette();
}

// ============================================================
// INPUT
// ============================================================
function handleKeyDown(e) {
  const k = e.key;
  if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' ','w','W','a','A','g','G','d','D','Shift','f','F'].includes(k)) e.preventDefault();
  keys[k] = true;
  if (k === 'r' || k === 'R') { restartGame(); return; }
  if (k === 'Shift' && gameState === 'playing' && player && !player.dead) player.attack();
  if (k === ' ' && gameState === 'menu') startGame();
  if ((k === 'g' || k === 'G') && gameState === 'playing' && player && !player.dead) {
    if (!shieldBroken && shieldEnergy > 0) audio.shield();
  }
}
function handleKeyUp(e) { keys[e.key] = false; }
window.addEventListener('keydown', handleKeyDown);
window.addEventListener('keyup', handleKeyUp);

document.querySelectorAll('.mbtn').forEach(btn => {
  const key = btn.dataset.key;
  const down = (e) => {
    e.preventDefault();
    keys[key] = true;
    if (key === 'Shift' && gameState === 'playing' && player && !player.dead) player.attack();
    if ((key === 'g' || key === 'G') && gameState === 'playing' && player && !player.dead && !shieldBroken && shieldEnergy > 0) audio.shield();
  };
  const up = (e) => { e.preventDefault(); keys[key] = false; };
  btn.addEventListener('touchstart', down, { passive: false });
  btn.addEventListener('touchend', up, { passive: false });
  btn.addEventListener('mousedown', down);
  btn.addEventListener('mouseup', up);
  btn.addEventListener('mouseleave', up);
});

// ============================================================
// GAME CONTROL
// ============================================================
function resetStats() {
  stats.kills = 0; stats.coins = 0; stats.blocks = 0;
  stats.stage = 0; stats.flyTime = 0; stats.damageTaken = 0;
  stats.levelTime = 0; stats.levelsCompleted = 0;
  unlockedAchievements.clear();
}

function startGame() {
  cancelPendingTimers();
  audio.init();
  lives = 3;
  score = 0;
  globalStage = 0;
  loopCount = 0;
  scoreEl.textContent = 0;
  resetStats();
  gameState = 'playing';
  loadLevel(WORLD_ORDER[0], 0, false);
  document.getElementById('gameOverScreen').classList.add('hidden');
  document.getElementById('victoryScreen').classList.add('hidden');
  document.getElementById('tutorialScreen').classList.add('hidden');
  lastTime = performance.now();
}

function restartGame() {
  if (gameState === 'menu') return;
  cancelPendingTimers();
  lives = 3;
  score = 0;
  globalStage = 0;
  loopCount = 0;
  scoreEl.textContent = 0;
  resetStats();
  gameState = 'playing';
  loadLevel(WORLD_ORDER[0], 0, false);
  document.getElementById('gameOverScreen').classList.add('hidden');
  document.getElementById('victoryScreen').classList.add('hidden');
  document.getElementById('tutorialScreen').classList.add('hidden');
}

document.getElementById('retryBtn').addEventListener('click', startGame);
document.getElementById('playAgainBtn').addEventListener('click', startGame);
document.getElementById('tutStartBtn').addEventListener('click', () => {
  document.getElementById('tutorialScreen').classList.add('hidden');
  startGame();
});

// ============================================================
// BOOT
// ============================================================
loadLevel('sand', 0);
gameState = 'menu';
lastTime = performance.now();
requestAnimationFrame(loop);

})();