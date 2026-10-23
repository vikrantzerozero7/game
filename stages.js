// ============================================================
// STAGES.JS — Levels, themes, generators, difficulty, loot,
// story beats, achievements, chunks, run seeds, and more.
// Max 3 enemies (archers + guards) per stage — hard cap.
// ============================================================

// ---------- GRID CONSTANTS ----------
const TILE = 80;
const W = 1280, H = 720;
const COLS = W / TILE;
const ROWS = H / TILE;

// ---------- HARD CAP ----------
const MAX_ENEMIES_PER_STAGE = 3;

// ============================================================
// THEMES — 10 worlds (5 original + 5 new)
// ============================================================
const THEMES = {
  sand: {
    name: '🏜️ Sand',
    bgTop: '#3a1e08', bgMid: '#5a3010', bgBottom: '#1a0a03',
    blockTop: '#c8943a', blockMid: '#8b6f3a', blockBottom: '#3a2a15',
    accent: '#ffd27f', particle: '#c8943a', bgShape: 'dunes',
    detail1: '#6a3a10', detail2: '#4a2a0a', detail3: '#2a1a08', star: '#ffd27f'
  },
  snow: {
    name: '❄️ Snow',
    bgTop: '#1a2a3a', bgMid: '#3a5068', bgBottom: '#0a1420',
    blockTop: '#e8f0f8', blockMid: '#8aa8c0', blockBottom: '#3a5068',
    accent: '#b0e0ff', particle: '#ffffff', bgShape: 'mountains',
    detail1: '#2a4a6a', detail2: '#e8f0f8', detail3: '#1a2a3a', star: '#ffffff'
  },
  water: {
    name: '💧 Water',
    bgTop: '#0a1a2a', bgMid: '#1a3a5a', bgBottom: '#02080f',
    blockTop: '#4aa0c8', blockMid: '#2a6890', blockBottom: '#0a2035',
    accent: '#7fd0ff', particle: '#a0e8ff', bgShape: 'waves',
    detail1: '#1a4a6a', detail2: '#3a7aa8', detail3: '#0a2035', star: '#a0e8ff'
  },
  forest: {
    name: '🌲 Forest',
    bgTop: '#0a2008', bgMid: '#1a4010', bgBottom: '#020a02',
    blockTop: '#4a8a3a', blockMid: '#2a5a20', blockBottom: '#0a2008',
    accent: '#8aff70', particle: '#4a8a3a', bgShape: 'trees',
    detail1: '#1a3a10', detail2: '#2a5a20', detail3: '#0a2008', star: '#ffd27f'
  },
  lava: {
    name: '🔥 Lava',
    bgTop: '#2a0a0a', bgMid: '#5a1a0a', bgBottom: '#0a0202',
    blockTop: '#8a3a1a', blockMid: '#5a2010', blockBottom: '#1a0603',
    accent: '#ff8a40', particle: '#ff5a20', bgShape: 'lava',
    detail1: '#6a2a10', detail2: '#ff4a10', detail3: '#2a0a0a', star: '#ff8a40'
  },
  desert_night: {
    name: '🌙 Desert Night',
    bgTop: '#0a0a2a', bgMid: '#1a1a4a', bgBottom: '#000008',
    blockTop: '#6a5a8a', blockMid: '#3a2a5a', blockBottom: '#1a0a2a',
    accent: '#a0c0ff', particle: '#c0d0ff', bgShape: 'dunes',
    detail1: '#2a1a4a', detail2: '#4a3a6a', detail3: '#1a0a2a', star: '#ffffff'
  },
  ice_cave: {
    name: '🧊 Ice Cave',
    bgTop: '#0a2a3a', bgMid: '#1a4a6a', bgBottom: '#020a12',
    blockTop: '#c0f0ff', blockMid: '#80c0e0', blockBottom: '#2a5a7a',
    accent: '#a0f0ff', particle: '#e0ffff', bgShape: 'mountains',
    detail1: '#2a5a7a', detail2: '#a0e0ff', detail3: '#0a2a3a', star: '#e0ffff'
  },
  ancient_ruins: {
    name: '🏛️ Ancient Ruins',
    bgTop: '#2a1a0a', bgMid: '#4a3a1a', bgBottom: '#0a0502',
    blockTop: '#d0b080', blockMid: '#8a6a3a', blockBottom: '#3a2a10',
    accent: '#ffd27f', particle: '#c0a060', bgShape: 'dunes',
    detail1: '#5a4a2a', detail2: '#8a6a3a', detail3: '#2a1a08', star: '#ffd27f'
  },
  shadow_realm: {
    name: '🌑 Shadow Realm',
    bgTop: '#1a0010', bgMid: '#3a0020', bgBottom: '#050002',
    blockTop: '#6a1a4a', blockMid: '#4a0a2a', blockBottom: '#1a0010',
    accent: '#ff40a0', particle: '#a0206a', bgShape: 'lava',
    detail1: '#4a0a2a', detail2: '#ff2060', detail3: '#1a0010', star: '#ff80c0'
  },
  sky_temple: {
    name: '☁️ Sky Temple',
    bgTop: '#4a6aaa', bgMid: '#8ab0e0', bgBottom: '#2a4a8a',
    blockTop: '#ffffff', blockMid: '#d0e0f0', blockBottom: '#8ab0e0',
    accent: '#ffffff', particle: '#ffffff', bgShape: 'mountains',
    detail1: '#6a8ac0', detail2: '#ffffff', detail3: '#4a6aaa', star: '#ffffff'
  }
};

const WORLD_ORDER = [
  'sand', 'snow', 'water', 'forest', 'lava',
  'desert_night', 'ice_cave', 'ancient_ruins', 'shadow_realm', 'sky_temple'
];

// ============================================================
// STATIC LEVELS — 6 per world
// Legend:
//   .  empty      #  block       ^  spike
//   D  door       E  exit        C  coin
//   G  guard      A  archer
//   ~  deadly pool     B  breakable    K  key
//   L  locked exit     H  potion       P  fly orb
//   Q  shield orb      $  gem          T  treasure
//   M  moving spike    =  moving plat  F  falling plat
//   R  boss            W  torch (deco) S  secret door
// NOTE: Every base level kept at ≤3 total enemies (A + G).
// ============================================================
const LEVELS = {
  // ----------------------------------------------------------
  // SAND
  // ----------------------------------------------------------
  sand: [
    ["................","................","................","................","...D...C....C..E","################","################","################","################"],
    ["................","................","................","................","...D...C........","######..........","......####..A.E.","......####......","......####......"],
    ["................","................","................","................","...D...C....C..E","################","#######.G.######","################","################"],
    ["................","................","................","...D............","...D.C.C....A..E","#####......#####","#####..G...#####","#####......#####","#####......#####"],
    ["................","................","................","................","...D..C.C.C....E","####..^^^^..####","####........####","####..A.....####","####........####"],
    ["................","................","......C.C......E","................","...D............","####........####","####...A....####","####........####","####........####"]
  ],

  // ----------------------------------------------------------
  // SNOW
  // ----------------------------------------------------------
  snow: [
    ["................","................","................","................","...D...C....C..E","################","################","################","################"],
    ["................","................","................","................","...D...C........","######..........","......####..A.E.","......####......","......####......"],
    ["................","................","................","................","...D.C.C...C...E","####........####","####...A....####","####........####","####........####"],
    ["................","................","................","................","...D..C...C....E","####^^^^^^^^####","####........####","####..G.....####","####........####"],
    ["................","................","..C...C...C....E","................","...D............","####..####..####","####..A.....####","####........####","####........####"],
    ["................","................","................","................","...D.....A.....E","####..^^^^..####","####........####","####..G.....####","####........####"]
  ],

  // ----------------------------------------------------------
  // WATER
  // ----------------------------------------------------------
  water: [
    ["................","................","................","................","...D...C....C..E","################","################","################","################"],
    ["................","................","................","...D............","#####...........","#####...........","#####.......A.E.","#####...........","#####......C...."],
    ["................","................","................","................","...D...C........","#####...........",".....####.....E.",".....####.G.....",".....####..A...."],
    ["................","................","................","................","...D.C.C.C.....E","#####..^^^^..####","#####.......####","#####..A....####","#####.......####"],
    ["................","................","...C..C..C.....E","................","...D............","#####...........","#####..####..###","#####..A.....###","#####........###"],
    ["................","................","................","................","...D....G......E","#####.........###","#####..A....#####","#####.......#####","#####.......#####"]
  ],

  // ----------------------------------------------------------
  // FOREST
  // ----------------------------------------------------------
  forest: [
    ["................","................","................","................","...D...C....C..E","################","################","################","################"],
    ["................","................","................","................","...D.C.C.C.C...E","####........####","####...A....####","####........####","####........####"],
    ["................","................","................","................","...D.C.C.C.C...E","####.G......####","####...A....####","####........####","####........####"],
    ["................","................","................","................","...D..C.C.C....E","####..^^^^..####","####..G.....####","####..A.....####","####........####"],
    ["................","................","..C..C..C..C...E","................","...D............","####..####..####","####..A.....####","####........####","####........####"],
    ["................","................","................","................","...D..G..A.....E","####..^^^^..####","####........####","####..A.....####","####........####"]
  ],

  // ----------------------------------------------------------
  // LAVA
  // ----------------------------------------------------------
  lava: [
    ["................","................","................","................","...D.C.C.C.C..E.","################","#####.A.########","################","################"],
    ["................","................","................","................","...D.C..C.C...E.","#####...........",".....####.^^.A..",".....####.......",".....####......."],
    ["................","................","................","................","...D.C..C.C...E.","#####...........",".....####.G.....",".....####..A....",".....####......."],
    ["................","................","................","................","...D..C.C.C...E.","####..^^^^..####","####..A.....####","####..G.....####","####........####"],
    ["................","................","...C..C..C.....E","................","...D............","####........####","####..A.....####","####........####","####........####"],
    ["................","................","................","................","...D..G..A.....E","####..^^^^..####","####........####","####..A.....####","####........####"]
  ],

  // ----------------------------------------------------------
  // DESERT NIGHT
  // ----------------------------------------------------------
  desert_night: [
    ["................","................","................","................","...D...C....C..E","################","################","################","################"],
    ["................","................","................","................","...D...C........","######..........","......####..A.E.","......####......","......####......"],
    ["................","................","................","................","...D.C..C..C...E","####..^^^^..####","####..G.....####","####..A.....####","####........####"],
    ["................","................","..C...C...C....E","................","...D............","####..####..####","####..A.....####","####..G.....####","####........####"],
    ["................","................","................","................","...D..A...A....E","####..^^^^..####","####........####","####..G.....####","####........####"],
    ["................","................","................","................","...D.G...A.....E","####..^^^^..####","####........####","####........####","####........####"]
  ],

  // ----------------------------------------------------------
  // ICE CAVE
  // ----------------------------------------------------------
  ice_cave: [
    ["................","................","................","................","...D...C....C..E","################","################","################","################"],
    ["................","................","................","................","...D.C.C.C.C...E","####........####","####...A....####","####........####","####........####"],
    ["................","................","................","................","...D..C.C.C....E","####..^^^^..####","####..G.....####","####..A.....####","####........####"],
    ["................","................","..C..C..C..C...E","................","...D............","####..####..####","####..A.....####","####........####","####........####"],
    ["................","................","................","................","...D..G..A.....E","####..^^^^..####","####........####","####..A.....####","####........####"],
    ["................","................","................","................","...D.G...A.....E","####..^^^^..####","####........####","####........####","####........####"]
  ],

  // ----------------------------------------------------------
  // ANCIENT RUINS
  // ----------------------------------------------------------
  ancient_ruins: [
    ["................","................","................","................","...D...C....C..E","################","################","################","################"],
    ["................","................","................","................","...D.C.C.C.C...E","####........####","####...A....####","####........####","####........####"],
    ["................","................","................","................","...D.C..C..C...E","####..^^^^..####","####..G.....####","####..A.....####","####........####"],
    ["................","................","................","................","...D.C.C.C.C...E","####.G......####","####...A....####","####........####","####........####"],
    ["................","................","..C..C..C..C...E","................","...D............","####..####..####","####..A.....####","####........####","####........####"],
    ["................","................","................","................","...D.G...A.....E","####..^^^^..####","####........####","####..A.....####","####........####"]
  ],

  // ----------------------------------------------------------
  // SHADOW REALM
  // ----------------------------------------------------------
  shadow_realm: [
    ["................","................","................","................","...D...C....C..E","################","################","################","################"],
    ["................","................","................","................","...D.C.C.C.C...E","####........####","####...A....####","####........####","####........####"],
    ["................","................","................","................","...D..C.C.C....E","####..^^^^..####","####..G.....####","####..A.....####","####........####"],
    ["................","................","..C..C..C..C...E","................","...D............","####..####..####","####..A.....####","####........####","####........####"],
    ["................","................","................","................","...D..G..A.....E","####..^^^^..####","####........####","####..A.....####","####........####"],
    ["................","................","................","................","...D.G...A.....E","####..^^^^..####","####........####","####........####","####........####"]
  ],

  // ----------------------------------------------------------
  // SKY TEMPLE
  // ----------------------------------------------------------
  sky_temple: [
    ["................","................","................","................","...D...C....C..E","################","################","################","################"],
    ["................","................","................","................","...D.C.C.C.C...E","####........####","####...A....####","####........####","####........####"],
    ["................","................","................","................","...D.C..C..C...E","####..^^^^..####","####..G.....####","####..A.....####","####........####"],
    ["................","................","................","................","...D.C.C.C.C...E","####.G......####","####...A....####","####........####","####........####"],
    ["................","................","..C..C..C..C...E","................","...D............","####..####..####","####..A.....####","####........####","####........####"],
    ["................","................","................","................","...D.G...A.....E","####..^^^^..####","####........####","####..A.....####","####........####"]
  ]
};

// ============================================================
// SEEDED RNG
// ============================================================
function seededRandom(seed) {
  let s = seed;
  return function() {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

// ============================================================
// CHUNK LIBRARY — 8 cols × 9 rows prefabs
// ============================================================
const CHUNKS = {
  flat_ground: [
    "........","........","........","........","........",
    "########","########","########","########"
  ],
  coin_arc: [
    "........","..C..C..",".C....C.","C......C","........",
    "########","########","########","########"
  ],
  spike_pit: [
    "........","........","........","........","........",
    "##^^^^##","########","########","########"
  ],
  tower: [
    "....##..","....##..","....##..","....##..","....##..",
    "##..##..","##..##..","##..##..","##..##.."
  ],
  archer_perch: [
    "....A...","........","..####..","........","........",
    "########","########","########","########"
  ],
  guard_patrol: [
    "........","........","........","........","........",
    "########","..G.....","########","########"
  ],
  floating_coins: [
    "........","..C.C...",".C...C..","C.....C.","........",
    "........","........","........","........"
  ],
  exit_chamber: [
    "........","........","........","........","....E...",
    "########","########","########","########"
  ]
};

// ============================================================
// DIFFICULTY TABLE — hard cap total ≤ 3 per stage
// ============================================================
const DIFFICULTY = {
  1:  { archers: 0, guards: 0, time: 90, spikes: 0, coins: 3 },
  2:  { archers: 0, guards: 0, time: 85, spikes: 1, coins: 4 },
  3:  { archers: 1, guards: 0, time: 80, spikes: 1, coins: 5 },
  4:  { archers: 1, guards: 1, time: 75, spikes: 2, coins: 6 },
  5:  { archers: 1, guards: 1, time: 70, spikes: 2, coins: 7 },
  6:  { archers: 2, guards: 1, time: 65, spikes: 3, coins: 8 },
  7:  { archers: 2, guards: 1, time: 60, spikes: 3, coins: 9 },
  8:  { archers: 2, guards: 1, time: 55, spikes: 4, coins: 10 },
  9:  { archers: 2, guards: 1, time: 50, spikes: 4, coins: 12 },
  10: { archers: 2, guards: 1, time: 45, spikes: 5, coins: 15 }
};

function getDifficulty(stageNum) {
  return DIFFICULTY[Math.min(stageNum + 1, 10)];
}

// ============================================================
// LOOT TABLE
// ============================================================
const LOOT_TABLE = {
  coin:      { symbol: 'C', points: 10, color: '#ffd27f', chance: 0.70 },
  gem:       { symbol: '$', points: 50, color: '#ff40a0', chance: 0.15 },
  potion:    { symbol: 'H', points: 0,  color: '#8aff70', chance: 0.08, heal: 1 },
  flyOrb:    { symbol: 'P', points: 0,  color: '#7fd0ff', chance: 0.05, flyRefill: 100 },
  shieldOrb: { symbol: 'Q', points: 0,  color: '#a0d8ff', chance: 0.02, shieldRefill: 100 }
};

function rollLoot(rng) {
  let r = rng();
  let acc = 0;
  for (const key in LOOT_TABLE) {
    acc += LOOT_TABLE[key].chance;
    if (r <= acc) return key;
  }
  return 'coin';
}

// ============================================================
// WORLD RULES
// ============================================================
const WORLD_RULES = {
  sand:          { hazard: null,        note: 'Standard gravity', gravityMod: 1.0 },
  snow:          { hazard: 'ice',       note: 'Slippery ground', friction: 0.15 },
  water:         { hazard: 'current',   note: 'Sideways currents', currentPush: 2 },
  forest:        { hazard: 'vines',     note: 'Slow patches', vineSlow: 0.6 },
  lava:          { hazard: 'eruption',  note: 'Lava geysers', geyserChance: 0.15 },
  desert_night:  { hazard: 'sandstorm', note: 'Wind gusts', windGust: 3 },
  ice_cave:      { hazard: 'slippery',  note: 'Very slippery', friction: 0.08 },
  shadow_realm:  { hazard: 'darkness',  note: 'Vision reduced', visionRadius: 250 },
  sky_temple:    { hazard: 'wind',      note: 'Upward wind', windUp: -1 },
  ancient_ruins: { hazard: 'collapse',  note: 'Falling debris', debrisChance: 0.10 }
};

function getWorldRule(worldKey) {
  return WORLD_RULES[worldKey] || WORLD_RULES.sand;
}

// ============================================================
// TILE PROPERTIES
// ============================================================
const TILE_PROPS = {
  EMPTY:            { solid: false, deadly: false, climbable: false },
  BLOCK:            { solid: true,  deadly: false, climbable: false, breakable: false },
  SPIKE:            { solid: false, deadly: true,  climbable: false, damage: 1 },
  EXIT:             { solid: false, deadly: false, climbable: false, isGoal: true },
  WATER:            { solid: false, deadly: true,  climbable: false, damage: 'instant' },
  ICE:              { solid: true,  deadly: false, climbable: false, slippery: true },
  VINE:             { solid: false, deadly: false, climbable: true },
  BREAKABLE:        { solid: true,  deadly: false, climbable: false, breakable: true, hp: 2 },
  MOVING_PLATFORM:  { solid: true,  deadly: false, climbable: false, moving: true },
  FALLING_PLATFORM: { solid: true,  deadly: false, climbable: false, falling: true }
};

// ============================================================
// STORY BEATS
// ============================================================
const STORY_BEATS = {
  0:   { title: 'The Journey Begins',     subtitle: 'Escape the palace dungeons' },
  5:   { title: 'Into the Frozen Wastes', subtitle: 'The cold bites deep...' },
  10:  { title: 'The Water Trials',       subtitle: 'Currents test your resolve' },
  15:  { title: 'Whispers of the Forest', subtitle: 'Ancient trees watch you' },
  20:  { title: 'The Fiery Depths',       subtitle: 'Even flames cannot stop you' },
  25:  { title: 'Beyond the Palace',      subtitle: 'New worlds await' },
  30:  { title: 'Night of the Desert',    subtitle: 'Stars guide your blade' },
  40:  { title: 'Frozen Heart',           subtitle: 'The ice cave remembers' },
  50:  { title: 'The Prince Ascendant',   subtitle: 'You are legend' },
  75:  { title: 'Shadows Within',         subtitle: 'The realm tests your soul' },
  100: { title: 'INFINITE PRINCE',        subtitle: 'A hundred trials conquered' }
};

function getStoryBeat(stageNum) {
  return STORY_BEATS[stageNum] || null;
}

// ============================================================
// ACHIEVEMENTS
// ============================================================
const ACHIEVEMENTS = {
  first_blood: { name: '⚔️ First Blood',  desc: 'Kill your first enemy',        check: s => s.kills >= 1 },
  speedrun:    { name: '⚡ Speedrunner',  desc: 'Finish a level in under 20s',  check: s => s.levelTime < 20 && s.levelsCompleted >= 1 },
  untouchable: { name: '🛡️ Untouchable',  desc: 'Finish a level without damage',check: s => s.damageTaken === 0 && s.levelsCompleted >= 1 },
  hoarder:     { name: '💰 Hoarder',      desc: 'Collect 100 coins',            check: s => s.coins >= 100 },
  flymaster:   { name: '🕊️ Fly Master',   desc: 'Fly for 60s total',            check: s => s.flyTime >= 60 },
  shieldwall:  { name: '🛡️ Shield Wall',  desc: 'Block 50 hits with shield',    check: s => s.blocks >= 50 },
  survivor:    { name: '💀 Survivor',     desc: 'Reach stage 25',               check: s => s.stage >= 25 },
  legend:      { name: '👑 Legend',       desc: 'Reach stage 50',               check: s => s.stage >= 50 }
};

// ============================================================
// RUN SEED
// ============================================================
let runSeed = Date.now() % 100000;

function getShareCode() {
  return `POP-${runSeed.toString(36).toUpperCase()}`;
}

function loadFromShareCode(code) {
  const parsed = parseInt(String(code).replace(/^POP-/i, ''), 36);
  runSeed = isNaN(parsed) ? Date.now() % 100000 : parsed;
  return runSeed;
}

// ============================================================
// HELPERS — count tiles in a raw level
// ============================================================
function countTiles(raw) {
  let archers = 0, guards = 0, coins = 0, spikes = 0;
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const c = raw[y] && raw[y][x] ? raw[y][x] : '.';
      if (c === 'A') archers++;
      else if (c === 'G') guards++;
      else if (c === 'C') coins++;
      else if (c === '^') spikes++;
    }
  }
  return { archers, guards, coins, spikes };
}

// Trim enemies in a mutable 2D char array down to MAX_ENEMIES_PER_STAGE
function trimEnemies(arr, rng) {
  const positions = [];
  for (let y = 0; y < ROWS; y++)
    for (let x = 0; x < COLS; x++)
      if (arr[y][x] === 'A' || arr[y][x] === 'G') positions.push([x, y]);

  if (positions.length <= MAX_ENEMIES_PER_STAGE) return;

  // shuffle
  for (let i = positions.length - 1; i > 0; i--) {
    const j = Math.floor((rng ? rng() : Math.random()) * (i + 1));
    [positions[i], positions[j]] = [positions[j], positions[i]];
  }
  const toRemove = positions.length - MAX_ENEMIES_PER_STAGE;
  for (let i = 0; i < toRemove; i++) {
    const [rx, ry] = positions[i];
    arr[ry][rx] = '.';
  }
}

// ============================================================
// PROCEDURAL GENERATOR — respects MAX_ENEMIES_PER_STAGE
// ============================================================
function generateProceduralLevel(worldKey, stageNum) {
  const rng = seededRandom(stageNum * 7919 + worldKey.length * 104729 + 12345 + runSeed);
  const worldLevels = LEVELS[worldKey];
  const base = worldLevels[stageNum % worldLevels.length];
  const out = [];
  for (let y = 0; y < ROWS; y++) out.push(base[y].split(''));

  const diff = getDifficulty(stageNum);
  const counts = countTiles(base);

  // ---- Hard cap: trim base if it already exceeds MAX ----
  trimEnemies(out, rng);

  // Recompute after trim
  const trimmed = countTiles(out.map(r => r.join('')));
  let archersNow = trimmed.archers;
  let guardsNow = trimmed.guards;

  // ---- COINS ----
  const coinsToAdd = Math.max(0, diff.coins - counts.coins);
  for (let i = 0; i < coinsToAdd; i++) {
    for (let tries = 0; tries < 20; tries++) {
      const cx = 1 + Math.floor(rng() * (COLS - 2));
      const cy = 1 + Math.floor(rng() * (ROWS - 2));
      if (out[cy][cx] === '.') { out[cy][cx] = 'C'; break; }
    }
  }

  // ---- ARCHERS (respect total cap) ----
  const archersToAdd = Math.max(0, diff.archers - archersNow);
  for (let a = 0; a < archersToAdd; a++) {
    if (archersNow + guardsNow >= MAX_ENEMIES_PER_STAGE) break;
    for (let tries = 0; tries < 20; tries++) {
      const ax = 2 + Math.floor(rng() * (COLS - 4));
      const ay = 1 + Math.floor(rng() * (ROWS - 2));
      if (out[ay][ax] === '.') {
        out[ay][ax] = 'A';
        archersNow++;
        break;
      }
    }
  }

  // ---- GUARDS (respect total cap) ----
  const guardsToAdd = Math.max(0, diff.guards - guardsNow);
  for (let g = 0; g < guardsToAdd; g++) {
    if (archersNow + guardsNow >= MAX_ENEMIES_PER_STAGE) break;
    for (let tries = 0; tries < 20; tries++) {
      const gx = 2 + Math.floor(rng() * (COLS - 4));
      const gy = 1 + Math.floor(rng() * (ROWS - 2));
      if (out[gy][gx] === '.') {
        out[gy][gx] = 'G';
        guardsNow++;
        break;
      }
    }
  }

  // ---- Move exit slightly ----
  let ex = -1, ey = -1;
  for (let y = 0; y < ROWS; y++)
    for (let x = 0; x < COLS; x++)
      if (out[y][x] === 'E') { ex = x; ey = y; break; }
  if (ex >= 0) {
    out[ey][ex] = '.';
    const nx = Math.max(2, Math.min(COLS - 2, ex + Math.floor(rng() * 5) - 2));
    let ny = ey;
    if (rng() < 0.4 && ey > 1 && out[ey - 1][nx] === '.') ny = ey - 1;
    out[ny][nx] = 'E';
  }

  // ---- A few extra blocks ----
  const pc = Math.floor(rng() * 2 + (stageNum > 3 ? 1 : 0));
  for (let p = 0; p < pc; p++) {
    const px = 1 + Math.floor(rng() * (COLS - 4));
    const py = 2 + Math.floor(rng() * (ROWS - 4));
    const pw = 1 + Math.floor(rng() * 3);
    for (let i = 0; i < pw; i++)
      if (px + i < COLS - 1 && out[py][px + i] === '.') out[py][px + i] = '#';
  }

  // ---- SPIKES ----
  const spikesToAdd = Math.max(0, diff.spikes - counts.spikes);
  for (let s = 0; s < spikesToAdd; s++) {
    const sx = 2 + Math.floor(rng() * (COLS - 6));
    const sy = ROWS - 2;
    const sw = 1 + Math.floor(rng() * 2);
    for (let i = 0; i < sw; i++)
      if (sx + i < COLS - 1 && out[sy][sx + i] === '.') out[sy][sx + i] = '^';
  }

  return out.map(r => r.join(''));
}

// ============================================================
// CHUNK-BASED GENERATOR — respects MAX_ENEMIES_PER_STAGE
// ============================================================
function generateChunkLevel(worldKey, stageNum, chunkCount) {
  const rng = seededRandom(stageNum * 1337 + worldKey.length * 999 + 42 + runSeed);
  const safeChunks = Object.keys(CHUNKS).filter(k =>
    k !== 'exit_chamber' && k !== 'archer_perch' && k !== 'guard_patrol'
  );
  const enemyChunks = ['archer_perch', 'guard_patrol'];
  const count = chunkCount || (3 + Math.floor(rng() * 3));

  const picked = ['flat_ground'];
  let enemyPicked = 0;

  for (let i = 1; i < count - 1; i++) {
    if (enemyPicked < 2 && rng() < 0.35) {
      picked.push(enemyChunks[Math.floor(rng() * enemyChunks.length)]);
      enemyPicked++;
    } else {
      picked.push(safeChunks[Math.floor(rng() * safeChunks.length)]);
    }
  }
  picked.push('exit_chamber');

  const combined = [];
  for (let y = 0; y < ROWS; y++) {
    let row = '';
    for (const p of picked) row += CHUNKS[p][y];
    combined.push(row);
  }

  const arr = combined.map(r => r.split(''));
  if (arr[4] && arr[4].length > 2) {
    arr[4][2] = 'D';
    for (let x = 0; x < 3; x++) if (arr[4][x] === 'E') arr[4][x] = '.';
  }

  // ---- HARD CAP ----
  trimEnemies(arr, rng);

  return arr.map(r => r.join(''));
}

// ============================================================
// UNIFIED LEVEL PICKER
// ============================================================
function getLevelForStage(worldKey, stageNum, globalStage) {
  if (typeof globalStage === 'undefined') globalStage = stageNum;

  if (globalStage >= 30) {
    return generateChunkLevel(worldKey, stageNum);
  }
  if (globalStage >= 12) {
    return generateProceduralLevel(worldKey, stageNum);
  }
  const worldLevels = LEVELS[worldKey];
  const baseIdx = stageNum % worldLevels.length;
  return worldLevels[baseIdx];
}

// ============================================================
// MINIMAP BUILDER
// ============================================================
function buildMinimap(raw) {
  const map = [];
  for (let y = 0; y < ROWS; y++) {
    const row = [];
    for (let x = 0; x < COLS; x++) {
      const ch = raw[y] && raw[y][x] ? raw[y][x] : '.';
      if (ch === '#') row.push(1);
      else if (ch === '^') row.push(2);
      else if (ch === 'E' || ch === 'L') row.push(3);
      else if (ch === 'G' || ch === 'A') row.push(4);
      else row.push(0);
    }
    map.push(row);
  }
  return map;
}

// ============================================================
// VARIANTS
// ============================================================
const LEVEL_VARIANTS = {
  easy:   { enemyHpMult: 0.5, timeMult: 1.3, coinMult: 1.0 },
  normal: { enemyHpMult: 1.0, timeMult: 1.0, coinMult: 1.0 },
  hard:   { enemyHpMult: 1.5, timeMult: 0.8, coinMult: 1.5 },
  insane: { enemyHpMult: 2.5, timeMult: 0.6, coinMult: 2.0 }
};

function getVariant(stageNum) {
  if (stageNum < 5)  return 'easy';
  if (stageNum < 15) return 'normal';
  if (stageNum < 30) return 'hard';
  return 'insane';
}

// ============================================================
// CAMERA HINTS
// ============================================================
const CAMERA_HINTS = {
  sand:          { shakeOnLand: true,  zoomOnBoss: false },
  snow:          { fogEffect: true },
  water:         { underwaterTint: true },
  forest:        { leafParticles: true },
  lava:          { shakeOnLand: true, shakeOnLava: true, zoomOnBoss: true },
  desert_night:  { vignetteStrong: true },
  ice_cave:      { fogEffect: true, shakeOnLand: true },
  ancient_ruins: { dustParticles: true },
  shadow_realm:  { vignetteStrong: true, darknessPulse: true },
  sky_temple:    { cloudParticles: true }
};

// ============================================================
// END OF STAGES.JS
// ============================================================