// ============================================================
// POWERS.JS — Fly & Shield configuration, constants, and state
// ============================================================

// ---------- FLY POWER ----------
const FLY_MAX_UP = -12;
const FLY_MAX_DOWN = 10;
const FLY_DRAIN_RATE = 16;
const FLY_REGEN_RATE = 22;
const FLY_MAX_ENERGY = 100;

// ---------- SHIELD POWER ----------
const SHIELD_MAX_ENERGY = 100;
const SHIELD_DRAIN_RATE = 8;
const SHIELD_REGEN_RATE = 16;
const SHIELD_BLOCK_COST_ARROW = 25;
const SHIELD_BLOCK_COST_GUARD = 30;
const SHIELD_BLOCK_COST_SPIKE = 20;
const SHIELD_BREAK_COOLDOWN = 3.0;
const SHIELD_REPAIR_RATE = 22;
const SHIELD_MIN_RAISE = 25;

// ---------- SHARED POWER STATE ----------
// (mutable globals used by the game loop)
let shieldActive = false;
let shieldEnergy = SHIELD_MAX_ENERGY;
let shieldBroken = false;
let shieldBreakTimer = 0;
let shieldBlockFlash = 0;
let shieldBreakFlashTimer = 0;
let shieldRepairSoundTimer = 0;
let shieldBreakCooldownActive = false;

// ---------- POWER HELPERS ----------

/**
 * Update shield state each frame.
 * Returns updated values; caller assigns back to globals.
 */
function updateShieldState(dt, wantsShield, player, audio, deps) {
  if (shieldBroken) {
    shieldBreakTimer -= dt;
    shieldActive = false;
    if (shieldBreakTimer <= 0) {
      shieldEnergy = Math.min(SHIELD_MAX_ENERGY, shieldEnergy + SHIELD_REPAIR_RATE * dt);
      shieldRepairSoundTimer += dt;
      if (shieldRepairSoundTimer > 0.4) {
        shieldRepairSoundTimer = 0;
        audio.shieldRepair();
      }
      if (shieldEnergy >= SHIELD_MIN_RAISE) {
        shieldBroken = false;
        shieldBreakCooldownActive = false;
        deps.mobileShieldBtn.classList.remove('broken');
        deps.shieldIndicator.classList.remove('broken');
        deps.floatTexts.push(new deps.FloatText(player.x + player.w/2, player.y - 25, '🛡️ READY', '#8aff70', 20));
      }
    }
  } else {
    if (wantsShield && shieldEnergy > 0) {
      shieldActive = true;
      shieldEnergy = Math.max(0, shieldEnergy - SHIELD_DRAIN_RATE * dt);
      if (shieldEnergy <= 0) player.breakShield();
    } else {
      shieldActive = false;
    }
  }
}

/**
 * Update fly state each frame.
 * Returns the desired vertical velocity (or null if not flying).
 */
function updateFlyState(dt, wantsFly, player, keys, audio) {
  const canFly = wantsFly && player.flyEnergy > 0 && !player.dead;
  if (canFly) {
    player.flying = true;
    player.flyEnergy = Math.max(0, player.flyEnergy - FLY_DRAIN_RATE * dt);
    player.flySoundTimer += dt;
    if (player.flySoundTimer > 0.15) { player.flySoundTimer = 0; audio.fly(); }
    let flyVy = 0;
    if (keys['ArrowUp'] || keys[' '] || keys['w'] || keys['W']) flyVy = FLY_MAX_UP;
    else if (keys['ArrowDown']) flyVy = FLY_MAX_DOWN;
    else flyVy = -2;
    return flyVy;
  }
  if (player.flying) {
    player.flying = false;
    if (player.vy < 0) player.vy *= 0.4;
  }
  return null;
}

/**
 * Regen fly & shield energy — only when grounded and not in use.
 */
function regenPowers(dt, player) {
  if (!player.flying && player.onGround) {
    player.flyEnergy = Math.min(FLY_MAX_ENERGY, player.flyEnergy + FLY_REGEN_RATE * dt);
  }
  if (!shieldActive && !shieldBroken && player.onGround) {
    shieldEnergy = Math.min(SHIELD_MAX_ENERGY, shieldEnergy + SHIELD_REGEN_RATE * dt);
  }
}

/**
 * Reset all shield-related state to full (used on level load / respawn).
 */
function resetShieldState() {
  shieldEnergy = SHIELD_MAX_ENERGY;
  shieldActive = false;
  shieldBroken = false;
  shieldBreakTimer = 0;
  shieldBlockFlash = 0;
  shieldBreakCooldownActive = false;
}

/**
 * Format the shield indicator text for the HUD.
 */
function formatShieldText() {
  const pct = (shieldEnergy / SHIELD_MAX_ENERGY * 100).toFixed(0);
  if (shieldBroken) return `💥 BROKEN ${Math.max(0, shieldBreakTimer).toFixed(1)}s`;
  if (shieldActive) return `🛡️ SHIELD ${pct}%`;
  return `🛡️ ${pct}%`;
}

/**
 * Format the fly indicator text for the HUD.
 */
function formatFlyText(player) {
  const pct = (player.flyEnergy / FLY_MAX_ENERGY * 100).toFixed(0);
  return player.flying ? `🕊️ FLY ${pct}%` : `🕊️ ${pct}%`;
}