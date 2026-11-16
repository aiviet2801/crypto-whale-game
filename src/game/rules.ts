import type {
  AiPolicy,
  CoinEntity,
  CoinTierDef,
  CoinTierId,
  LeaderboardEntry,
  Pellet,
  StarterCoinId,
} from './types';

export const ARENA_WIDTH = 4200;
export const ARENA_HEIGHT = 4200;

export const PLAYER_START_MASS = 38;
export const MIN_BOOST_MASS = 20;
export const BOOST_DRAIN_PER_SEC = 5.0;
export const BOOST_PELLET_COST = 2.8;
export const BOOST_SPEED_MULTIPLIER = 1.68;
export const CAN_ABSORB_RATIO = 1.05;

export const RUG_PULL_PENALTY_RATIO = 0.3;
export const RUG_PULL_MIN_MASS = 14;
export const BULL_RUN_STREAK_TARGET = 5;
export const BULL_RUN_DURATION = 5.0;
export const BULL_RUN_SPEED_MULTIPLIER = 2.0;
export const BULL_RUN_MAGNET_RADIUS = 580;

export const COIN_TIERS: readonly CoinTierDef[] = [
  {
    id: 'PEPE',
    name: 'Pepe',
    symbol: 'PEPE',
    minMass: 0,
    maxMass: 55,
    color: '#22C55E',
    glowColor: 'rgba(34, 197, 94, 0.55)',
    bgColor: '#0A2615',
    textColor: '#86EFAC',
  },
  {
    id: 'DOGE',
    name: 'Dogecoin',
    symbol: 'DOGE',
    minMass: 55,
    maxMass: 115,
    color: '#EAB308',
    glowColor: 'rgba(234, 179, 8, 0.55)',
    bgColor: '#292006',
    textColor: '#FDE047',
  },
  {
    id: 'SHIB',
    name: 'Shiba Inu',
    symbol: 'SHIB',
    minMass: 115,
    maxMass: 210,
    color: '#F97316',
    glowColor: 'rgba(249, 115, 22, 0.55)',
    bgColor: '#2C1406',
    textColor: '#FDBA74',
  },
  {
    id: 'ADA',
    name: 'Cardano',
    symbol: 'ADA',
    minMass: 210,
    maxMass: 360,
    color: '#3B82F6',
    glowColor: 'rgba(59, 130, 246, 0.58)',
    bgColor: '#0B1D3B',
    textColor: '#93C5FD',
  },
  {
    id: 'SOL',
    name: 'Solana',
    symbol: 'SOL',
    minMass: 360,
    maxMass: 620,
    color: '#A855F7',
    glowColor: 'rgba(168, 85, 247, 0.6)',
    bgColor: '#210E36',
    textColor: '#D8B4FE',
  },
  {
    id: 'ETH',
    name: 'Ethereum',
    symbol: 'ETH',
    minMass: 620,
    maxMass: 1050,
    color: '#6366F1',
    glowColor: 'rgba(99, 102, 241, 0.62)',
    bgColor: '#14173B',
    textColor: '#A5B4FC',
  },
  {
    id: 'BTC',
    name: 'Bitcoin Whale',
    symbol: 'BTC',
    minMass: 1050,
    maxMass: 10000,
    color: '#F59E0B',
    glowColor: 'rgba(245, 158, 11, 0.7)',
    bgColor: '#2D1B04',
    textColor: '#FCD34D',
  },
];

export function massToRadius(mass: number): number {
  const safeMass = Math.max(8, mass);
  return 11 + Math.sqrt(safeMass) * 4.35;
}

export function massToMarketCap(mass: number): number {
  // Non-linear scale so small starter coins are ~$5M and BTC whales reach billions
  const safeMass = Math.max(10, mass);
  return Math.round(Math.pow(safeMass, 1.48) * 35_000);
}

export function formatMarketCap(marketCap: number): string {
  const value = Math.max(0, Math.round(marketCap));
  if (value >= 1_000_000_000) {
    const billions = value / 1_000_000_000;
    return `$${billions >= 10 ? billions.toFixed(1) : billions.toFixed(2)}B`;
  }
  if (value >= 1_000_000) {
    const millions = Math.round(value / 1_000_000);
    return `$${millions}M`;
  }
  if (value >= 1_000) {
    return `$${Math.round(value / 1_000)}K`;
  }
  return `$${value}`;
}

export function getTierForMass(
  mass: number,
  starterSkin: StarterCoinId = 'PEPE',
): CoinTierDef {
  if (mass < COIN_TIERS[1].minMass) {
    if (starterSkin === 'DOGE') {
      // Allow starting visually as a compact DOGE coin while remaining Tier 1 mass range
      return {
        ...COIN_TIERS[1],
        minMass: 0,
        maxMass: COIN_TIERS[1].maxMass,
      };
    }
    return COIN_TIERS[0];
  }
  for (let i = COIN_TIERS.length - 1; i >= 0; i--) {
    if (mass >= COIN_TIERS[i].minMass) {
      return COIN_TIERS[i];
    }
  }
  return COIN_TIERS[0];
}

export function getNextTierForMass(
  mass: number,
  starterSkin: StarterCoinId = 'PEPE',
): CoinTierDef | null {
  const current = getTierForMass(mass, starterSkin);
  const idx = COIN_TIERS.findIndex((t) => t.id === current.id);
  if (idx === -1 || idx >= COIN_TIERS.length - 1) return null;
  return COIN_TIERS[idx + 1];
}

export function getTierProgress(
  mass: number,
  starterSkin: StarterCoinId = 'PEPE',
): number {
  const current = getTierForMass(mass, starterSkin);
  const next = getNextTierForMass(mass, starterSkin);
  if (!next) return 1;
  const span = Math.max(1, next.minMass - current.minMass);
  return Math.max(0, Math.min(1, (mass - current.minMass) / span));
}

export function tierOrderIndex(id: CoinTierId): number {
  return COIN_TIERS.findIndex((t) => t.id === id);
}

export type CollisionOutcome = 'a_eats_b' | 'b_eats_a' | 'bounce';

export function resolveCollisionOutcome(aMass: number, bMass: number): CollisionOutcome {
  if (aMass >= bMass * CAN_ABSORB_RATIO) return 'a_eats_b';
  if (bMass >= aMass * CAN_ABSORB_RATIO) return 'b_eats_a';
  return 'bounce';
}

export function computeBaseSpeed(mass: number): number {
  // Larger whales move a bit more deliberately, small coins are nimble
  const factor = Math.pow(Math.max(20, mass) / PLAYER_START_MASS, -0.22);
  return Math.max(125, Math.min(345, 315 * factor));
}

export function applyLeverageBoost(
  mass: number,
  dt: number,
  wantsBoost: boolean,
): {
  nextMass: number;
  isBoosting: boolean;
  speedMultiplier: number;
  shedMass: number;
} {
  if (!wantsBoost || mass <= MIN_BOOST_MASS) {
    return {
      nextMass: mass,
      isBoosting: false,
      speedMultiplier: 1,
      shedMass: 0,
    };
  }
  const drain = Math.min(mass - MIN_BOOST_MASS, BOOST_DRAIN_PER_SEC * dt);
  return {
    nextMass: mass - drain,
    isBoosting: drain > 0,
    speedMultiplier: BOOST_SPEED_MULTIPLIER,
    shedMass: drain,
  };
}

export function computeTargetZoom(
  playerRadius: number,
  viewportWidth: number,
  viewportHeight: number,
): number {
  const minDim = Math.max(360, Math.min(viewportWidth, viewportHeight));
  const viewportScale = Math.min(1.15, Math.max(0.72, minDim / 880));
  const radiusScale = Math.pow(massToRadius(PLAYER_START_MASS) / Math.max(22, playerRadius), 0.44);
  return Math.max(0.42, Math.min(1.18, viewportScale * radiusScale));
}

export function computeAbsorbedMassGain(preyMass: number): number {
  return Math.max(3, preyMass * 0.65);
}

export function computeBoostReservePct(mass: number): number {
  if (mass <= MIN_BOOST_MASS) return 0;
  return Math.max(0, Math.min(100, Math.round(((mass - MIN_BOOST_MASS) / 40) * 100)));
}

export function stepAiDecision(
  ai: Pick<
    CoinEntity,
    | 'id'
    | 'x'
    | 'y'
    | 'mass'
    | 'radius'
    | 'policy'
    | 'aiTargetX'
    | 'aiTargetY'
    | 'telegraphTimer'
    | 'lungeTimer'
    | 'lungeDirX'
    | 'lungeDirY'
  >,
  coins: ReadonlyArray<Pick<CoinEntity, 'id' | 'x' | 'y' | 'mass' | 'radius' | 'isPlayer'>>,
  pellets: ReadonlyArray<Pick<Pellet, 'x' | 'y' | 'mass'>>,
  dt: number,
  aggressionScale = 1,
): {
  targetX: number;
  targetY: number;
  wantsBoost: boolean;
  telegraphTimer: number;
  lungeTimer: number;
  lungeDirX: number;
  lungeDirY: number;
} {
  let nearestThreat: { x: number; y: number; dist: number; mass: number } | null = null;
  let nearestPrey: { x: number; y: number; dist: number; mass: number } | null = null;

  const threatRange = (ai.policy === 'forager' ? 460 : 380) + ai.radius * 2;
  const preyRange =
    (ai.policy === 'whale' ? 680 : ai.policy === 'hunter' ? 540 : 280) *
      Math.min(1.35, aggressionScale) +
    ai.radius * 2;

  for (let i = 0; i < coins.length; i++) {
    const other = coins[i];
    if (other.id === ai.id) continue;
    const dx = other.x - ai.x;
    const dy = other.y - ai.y;
    const dist = Math.hypot(dx, dy);

    if (other.mass >= ai.mass * CAN_ABSORB_RATIO) {
      if (dist < threatRange && (!nearestThreat || dist < nearestThreat.dist)) {
        nearestThreat = { x: other.x, y: other.y, dist, mass: other.mass };
      }
    } else if (ai.mass >= other.mass * CAN_ABSORB_RATIO) {
      // Whales ignore super tiny crumbs far away and prefer juicy targets
      const minPreyMass = ai.policy === 'whale' ? Math.max(30, ai.mass * 0.08) : 10;
      if (other.mass >= minPreyMass && dist < preyRange) {
        if (!nearestPrey || dist < nearestPrey.dist) {
          nearestPrey = { x: other.x, y: other.y, dist, mass: other.mass };
        }
      }
    }
  }

  let telegraphTimer = Math.max(0, ai.telegraphTimer - dt);
  let lungeTimer = Math.max(0, ai.lungeTimer - dt);
  let lungeDirX = ai.lungeDirX;
  let lungeDirY = ai.lungeDirY;

  // Active lunge burst
  if (lungeTimer > 0) {
    return {
      targetX: ai.x + lungeDirX * 400,
      targetY: ai.y + lungeDirY * 400,
      wantsBoost: ai.mass > MIN_BOOST_MASS + 18,
      telegraphTimer: 0,
      lungeTimer,
      lungeDirX,
      lungeDirY,
    };
  }

  // Threat evasion always takes priority when a predator is close
  if (nearestThreat) {
    const awayX = ai.x - nearestThreat.x;
    const awayY = ai.y - nearestThreat.y;
    const len = Math.max(1, Math.hypot(awayX, awayY));
    const fleeX = clampToArena(ai.x + (awayX / len) * 420, ARENA_WIDTH, 140);
    const fleeY = clampToArena(ai.y + (awayY / len) * 420, ARENA_HEIGHT, 140);
    const panicking = nearestThreat.dist < 220 + ai.radius && ai.mass > MIN_BOOST_MASS + 10;
    return {
      targetX: fleeX,
      targetY: fleeY,
      wantsBoost: panicking && ai.policy !== 'whale',
      telegraphTimer: 0,
      lungeTimer: 0,
      lungeDirX: 0,
      lungeDirY: 0,
    };
  }

  // Hunter / Whale telegraph + lunge policy
  if (nearestPrey && (ai.policy === 'hunter' || ai.policy === 'whale')) {
    const dx = nearestPrey.x - ai.x;
    const dy = nearestPrey.y - ai.y;
    const len = Math.max(1, Math.hypot(dx, dy));
    if (
      telegraphTimer <= 0 &&
      nearestPrey.dist < 290 + ai.radius &&
      ai.mass > MIN_BOOST_MASS + 25
    ) {
      telegraphTimer = ai.policy === 'whale' ? 0.55 : 0.38;
      lungeDirX = dx / len;
      lungeDirY = dy / len;
    } else if (ai.telegraphTimer > 0 && telegraphTimer === 0) {
      // Windup completed -> execute lunge
      lungeTimer = ai.policy === 'whale' ? 0.65 : 0.45;
      lungeDirX = dx / len;
      lungeDirY = dy / len;
    }

    return {
      targetX: nearestPrey.x,
      targetY: nearestPrey.y,
      wantsBoost: false,
      telegraphTimer,
      lungeTimer,
      lungeDirX,
      lungeDirY,
    };
  }

  // Foragers seek nearby pellets or smaller coins softly
  if (ai.policy === 'forager' && nearestPrey && nearestPrey.dist < 220) {
    return {
      targetX: nearestPrey.x,
      targetY: nearestPrey.y,
      wantsBoost: false,
      telegraphTimer: 0,
      lungeTimer: 0,
      lungeDirX: 0,
      lungeDirY: 0,
    };
  }

  // Seek nearest pellet cluster
  let bestPellet: { x: number; y: number; dist: number } | null = null;
  const step = pellets.length > 160 ? 3 : 1;
  for (let i = 0; i < pellets.length; i += step) {
    const p = pellets[i];
    const dist = Math.hypot(p.x - ai.x, p.y - ai.y);
    if (dist < 420 && (!bestPellet || dist < bestPellet.dist)) {
      bestPellet = { x: p.x, y: p.y, dist };
    }
  }

  if (bestPellet) {
    return {
      targetX: bestPellet.x,
      targetY: bestPellet.y,
      wantsBoost: false,
      telegraphTimer: 0,
      lungeTimer: 0,
      lungeDirX: 0,
      lungeDirY: 0,
    };
  }

  return {
    targetX: ai.aiTargetX,
    targetY: ai.aiTargetY,
    wantsBoost: false,
    telegraphTimer: 0,
    lungeTimer: 0,
    lungeDirX: 0,
    lungeDirY: 0,
  };
}

export function clampToArena(val: number, maxDim: number, margin: number): number {
  return Math.max(margin, Math.min(maxDim - margin, val));
}

export function findSafeSpawnPosition(
  existingCoins: ReadonlyArray<Pick<CoinEntity, 'x' | 'y' | 'mass' | 'radius'>>,
  spawnMass: number,
  rng: () => number = Math.random,
  margin = 280,
): { x: number; y: number } {
  let bestCandidate = { x: ARENA_WIDTH / 2, y: ARENA_HEIGHT / 2 };
  let bestClearance = -1;

  for (let attempt = 0; attempt < 28; attempt++) {
    const x = margin + rng() * (ARENA_WIDTH - margin * 2);
    const y = margin + rng() * (ARENA_HEIGHT - margin * 2);
    let minThreatDist = Infinity;

    for (let i = 0; i < existingCoins.length; i++) {
      const c = existingCoins[i];
      const d = Math.hypot(c.x - x, c.y - y) - c.radius;
      if (c.mass >= spawnMass * 0.95) {
        minThreatDist = Math.min(minThreatDist, d);
      } else {
        minThreatDist = Math.min(minThreatDist, d + 120);
      }
    }

    if (minThreatDist >= 460) {
      return { x, y };
    }
    if (minThreatDist > bestClearance) {
      bestClearance = minThreatDist;
      bestCandidate = { x, y };
    }
  }

  return bestCandidate;
}

export function buildLeaderboard(
  coins: ReadonlyArray<Pick<CoinEntity, 'id' | 'name' | 'tier' | 'mass' | 'isPlayer'>>,
  limit = 5,
): {
  entries: LeaderboardEntry[];
  playerRank: number;
} {
  const sorted = [...coins].sort((a, b) => b.mass - a.mass);
  let playerRank = sorted.length;
  const entries: LeaderboardEntry[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const c = sorted[i];
    if (c.isPlayer) {
      playerRank = i + 1;
    }
    if (i < limit) {
      entries.push({
        id: c.id,
        name: c.name,
        tierId: c.tier.id,
        marketCap: massToMarketCap(c.mass),
        isPlayer: c.isPlayer,
        rank: i + 1,
      });
    }
  }

  return { entries, playerRank };
}

export function deriveAiPolicy(mass: number): AiPolicy {
  if (mass >= 380) return 'whale';
  if (mass >= 85) return 'hunter';
  return 'forager';
}

export function applyRugPullPenalty(mass: number): number {
  return Math.max(RUG_PULL_MIN_MASS, mass * (1 - RUG_PULL_PENALTY_RATIO));
}

export function advanceCoinStreak(
  currentStreak: number,
  isBullRunActive: boolean,
): {
  nextStreak: number;
  triggeredBullRun: boolean;
} {
  if (isBullRunActive) {
    return { nextStreak: 0, triggeredBullRun: false };
  }
  const incremented = currentStreak + 1;
  if (incremented >= BULL_RUN_STREAK_TARGET) {
    return { nextStreak: 0, triggeredBullRun: true };
  }
  return { nextStreak: incremented, triggeredBullRun: false };
}

export function computeBullRunMagnetPull(
  playerX: number,
  playerY: number,
  playerMass: number,
  targetX: number,
  targetY: number,
  targetMass: number,
  isPellet: boolean,
  dt: number,
): { vx: number; vy: number } | null {
  if (!isPellet && playerMass < targetMass * CAN_ABSORB_RATIO) {
    return null;
  }
  const dx = playerX - targetX;
  const dy = playerY - targetY;
  const dist = Math.hypot(dx, dy);
  if (dist < 4 || dist > BULL_RUN_MAGNET_RADIUS) {
    return null;
  }
  const falloff = 1 - dist / BULL_RUN_MAGNET_RADIUS;
  const pullSpeed = (isPellet ? 620 : 520) * (0.45 + falloff * 0.85);
  return {
    vx: (dx / dist) * pullSpeed * dt,
    vy: (dy / dist) * pullSpeed * dt,
  };
}

export function computeJoystickVector(
  dx: number,
  dy: number,
  maxRadius: number,
  deadzone = 0.14,
): { x: number; y: number; magnitude: number } {
  const safeMax = Math.max(1, maxRadius);
  const dist = Math.hypot(dx, dy);
  if (dist <= 0.001) {
    return { x: 0, y: 0, magnitude: 0 };
  }
  const normMag = Math.min(1, dist / safeMax);
  if (normMag < deadzone) {
    return { x: 0, y: 0, magnitude: 0 };
  }
  const scaled = (normMag - deadzone) / (1 - deadzone);
  return {
    x: (dx / dist) * scaled,
    y: (dy / dist) * scaled,
    magnitude: scaled,
  };
}
