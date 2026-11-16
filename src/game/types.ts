export type GamePhase = 'title' | 'playing' | 'paused' | 'gameover';

export type StarterCoinId = 'PEPE' | 'DOGE';

export type CoinTierId = 'PEPE' | 'DOGE' | 'SHIB' | 'ADA' | 'SOL' | 'ETH' | 'BTC';

export type AiPolicy = 'forager' | 'hunter' | 'whale';

export interface CoinTierDef {
  id: CoinTierId;
  name: string;
  symbol: string;
  minMass: number;
  maxMass: number;
  color: string;
  glowColor: string;
  bgColor: string;
  textColor: string;
}

export interface Pellet {
  id: number;
  x: number;
  y: number;
  mass: number;
  radius: number;
  color: string;
  pulseOffset: number;
  isShed: boolean;
  ttl: number;
}

export interface CoinEntity {
  id: string;
  name: string;
  isPlayer: boolean;
  starterSkin: StarterCoinId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  mass: number;
  radius: number;
  tier: CoinTierDef;
  isBoosting: boolean;
  boostShedAcc: number;
  hitFlash: number;
  squashX: number;
  squashY: number;
  // AI fields
  policy: AiPolicy;
  aiTargetX: number;
  aiTargetY: number;
  aiDecisionTimer: number;
  telegraphTimer: number;
  lungeTimer: number;
  lungeDirX: number;
  lungeDirY: number;
  trailAcc: number;
}

export interface LeaderboardEntry {
  id: string;
  name: string;
  tierId: CoinTierId;
  marketCap: number;
  isPlayer: boolean;
  rank: number;
}

export interface RugPullZone {
  id: number;
  x: number;
  y: number;
  radius: number;
  pulseOffset: number;
  ttl: number;
}

export interface HudSnapshot {
  phase: GamePhase;
  marketCap: number;
  bestMarketCap: number;
  coinsAbsorbed: number;
  tier: CoinTierDef;
  nextTier: CoinTierDef | null;
  tierProgress: number;
  mass: number;
  canBoost: boolean;
  isBoosting: boolean;
  boostReservePct: number;
  streakCount: number;
  bullRunTimer: number;
  leaderboard: LeaderboardEntry[];
  playerRank: number;
  totalEntities: number;
  survivalSeconds: number;
  liquidatedBy: string | null;
  radarPoints: Array<{
    xNorm: number;
    yNorm: number;
    isPlayer: boolean;
    isThreat: boolean;
    isEdible: boolean;
    isWhale: boolean;
  }>;
}

export interface RunSummary {
  finalMarketCap: number;
  bestMarketCap: number;
  coinsAbsorbed: number;
  peakTier: CoinTierDef;
  survivalSeconds: number;
  liquidatedBy: string;
}
