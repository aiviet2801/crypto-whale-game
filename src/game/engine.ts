import { SoundEngine } from './audio';
import { renderCoinEntity } from './coinArt';
import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  BOOST_PELLET_COST,
  BULL_RUN_DURATION,
  BULL_RUN_SPEED_MULTIPLIER,
  CAN_ABSORB_RATIO,
  MIN_BOOST_MASS,
  PLAYER_START_MASS,
  advanceCoinStreak,
  applyLeverageBoost,
  applyRugPullPenalty,
  buildLeaderboard,
  clampToArena,
  computeAbsorbedMassGain,
  computeBaseSpeed,
  computeBoostReservePct,
  computeBullRunMagnetPull,
  computeTargetZoom,
  deriveAiPolicy,
  findSafeSpawnPosition,
  formatMarketCap,
  getNextTierForMass,
  getTierForMass,
  getTierProgress,
  massToMarketCap,
  massToRadius,
  resolveCollisionOutcome,
  stepAiDecision,
  tierOrderIndex,
} from './rules';
import type {
  CoinEntity,
  CoinTierDef,
  GamePhase,
  HudSnapshot,
  Pellet,
  RugPullZone,
  RunSummary,
  StarterCoinId,
} from './types';

interface PooledParticle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  life: number;
  maxLife: number;
  color: string;
  isShard: boolean;
  angle: number;
  spin: number;
}

interface FloatingPopup {
  active: boolean;
  x: number;
  y: number;
  vy: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
  scale: number;
}

const PARTICLE_POOL_SIZE = 380;
const POPUP_POOL_SIZE = 52;
const TARGET_PELLET_COUNT = 280;
const TARGET_AI_COUNT = 28;
const TARGET_RUG_PULL_COUNT = 9;
const FIREWORK_COLORS = ['#22D3EE', '#10B981', '#F59E0B', '#A855F7', '#F43F5E'];

const AI_NAMES = [
  'SatoshiBot',
  'VitalikSim',
  'DogeLord',
  'PepeMaxi',
  'SolanaSniper',
  'ShibaAlpha',
  'CardanoNode',
  'Whale0x99',
  'MoonBoi',
  'DiamondHands',
  'GweiMiner',
  'DeFiShark',
  'PumpHunter',
  'AltSeason',
  'BlockZero',
  'GasFee',
  'LiquidityPool',
  'StakeKing',
  'HashRate',
  'ColdWallet',
  'YieldFarmer',
  'BullRun',
  'LayerTwo',
  'GenesisTx',
  'Oracle9',
  'FlashLoan',
  'VaultX',
  'MeVBot',
  'HodlPrime',
  'ChainPulse',
];

const PELLET_COLORS = ['#22D3EE', '#10B981', '#A855F7', '#F59E0B', '#38BDF8'];

export interface EngineCallbacks {
  onPhaseChange: (phase: GamePhase) => void;
  onHudUpdate: (snapshot: HudSnapshot) => void;
  onGameOver: (summary: RunSummary) => void;
}

export class CryptoWhaleEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private sound = new SoundEngine();
  private callbacks: EngineCallbacks;

  private phase: GamePhase = 'title';
  private starterSkin: StarterCoinId = 'PEPE';

  private coins: CoinEntity[] = [];
  private pellets: Pellet[] = [];
  private rugPulls: RugPullZone[] = [];
  private nextPelletId = 1;
  private nextAiId = 1;
  private nextRugPullId = 1;

  private particles: PooledParticle[] = [];
  private particleCursor = 0;
  private popups: FloatingPopup[] = [];
  private popupCursor = 0;

  private camX = ARENA_WIDTH / 2;
  private camY = ARENA_HEIGHT / 2;
  private camZoom = 0.85;
  private trauma = 0;
  private hitstopTimer = 0;
  private liquidationDelayTimer = 0;
  private pendingSummary: RunSummary | null = null;

  private viewportWidth = 1440;
  private viewportHeight = 900;
  private dpr = 1;
  private canvasRect: DOMRect | null = null;
  private resizeObserver: ResizeObserver | null = null;

  private pointerActive = false;
  private pointerScreenX = 720;
  private pointerScreenY = 450;
  private mouseBoostHeld = false;
  private externalBoostHeld = false;
  private joystickVecX = 0;
  private joystickVecY = 0;
  private keysHeld = new Set<string>();

  private rafId: number | null = null;
  private lastTimestamp = 0;
  private simTime = 0;
  private hudSyncTimer = 0;
  private frozenFrameRendered = false;

  private coinsAbsorbed = 0;
  private streakCount = 0;
  private bullRunTimer = 0;
  private fireworkTimer = 0;
  private rugPullCooldown = 0;
  private spawnShieldTimer = 0;
  private bestMarketCap = 0;
  private peakTier: CoinTierDef = getTierForMass(PLAYER_START_MASS, 'PEPE');
  private survivalSeconds = 0;

  constructor(canvas: HTMLCanvasElement, callbacks: EngineCallbacks) {
    this.canvas = canvas;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) {
      throw new Error('Could not initialize 2D canvas context');
    }
    this.ctx = context;
    this.callbacks = callbacks;

    for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
      this.particles.push({
        active: false,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        radius: 3,
        life: 0,
        maxLife: 1,
        color: '#22D3EE',
        isShard: false,
        angle: 0,
        spin: 0,
      });
    }

    for (let i = 0; i < POPUP_POOL_SIZE; i++) {
      this.popups.push({
        active: false,
        x: 0,
        y: 0,
        vy: -38,
        text: '',
        color: '#10B981',
        life: 0,
        maxLife: 0.9,
        scale: 1,
      });
    }

    this.loadBestMarketCap();
    this.seedWorldForTitle();
    this.updateCanvasSize();
    this.bindEvents();
  }

  private loadBestMarketCap(): void {
    try {
      const saved = localStorage.getItem('crypto_whale_best_mcap');
      if (saved) {
        const parsed = Number(saved);
        if (Number.isFinite(parsed) && parsed > 0) {
          this.bestMarketCap = parsed;
        }
      }
    } catch {
      // ignore storage errors
    }
  }

  private saveBestMarketCap(value: number): void {
    if (value <= this.bestMarketCap) return;
    this.bestMarketCap = value;
    try {
      localStorage.setItem('crypto_whale_best_mcap', String(Math.round(value)));
    } catch {
      // ignore
    }
  }

  private bindEvents(): void {
    this.resizeObserver = new ResizeObserver(() => {
      this.updateCanvasSize();
    });
    this.resizeObserver.observe(this.canvas);

    window.addEventListener('resize', this.handleWindowResize);
    window.addEventListener('mousemove', this.handleMouseMove);
    window.addEventListener('mousedown', this.handleMouseDown);
    window.addEventListener('mouseup', this.handleMouseUp);
    window.addEventListener('touchstart', this.handleTouchStart, { passive: false });
    window.addEventListener('touchmove', this.handleTouchMove, { passive: false });
    window.addEventListener('touchend', this.handleTouchEnd);
    window.addEventListener('touchcancel', this.handleTouchEnd);
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.clearHeldInputs);
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
  }

  public destroy(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.sound.stopLoops();
    this.resizeObserver?.disconnect();
    window.removeEventListener('resize', this.handleWindowResize);
    window.removeEventListener('mousemove', this.handleMouseMove);
    window.removeEventListener('mousedown', this.handleMouseDown);
    window.removeEventListener('mouseup', this.handleMouseUp);
    window.removeEventListener('touchstart', this.handleTouchStart);
    window.removeEventListener('touchmove', this.handleTouchMove);
    window.removeEventListener('touchend', this.handleTouchEnd);
    window.removeEventListener('touchcancel', this.handleTouchEnd);
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.clearHeldInputs);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
  }

  private handleWindowResize = (): void => {
    this.updateCanvasSize();
  };

  private updateCanvasSize(): void {
    const rect = this.canvas.getBoundingClientRect();
    this.canvasRect = rect;
    this.viewportWidth = Math.max(320, rect.width || window.innerWidth);
    this.viewportHeight = Math.max(320, rect.height || window.innerHeight);
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(this.viewportWidth * this.dpr);
    this.canvas.height = Math.round(this.viewportHeight * this.dpr);
    this.frozenFrameRendered = false;
  }

  private screenToWorld(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.canvasRect ?? this.canvas.getBoundingClientRect();
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
    const wx = (sx - this.viewportWidth / 2) / this.camZoom + this.camX;
    const wy = (sy - this.viewportHeight / 2) / this.camZoom + this.camY;
    return { x: wx, y: wy };
  }

  private handleMouseMove = (e: MouseEvent): void => {
    this.pointerActive = true;
    this.pointerScreenX = e.clientX;
    this.pointerScreenY = e.clientY;
  };

  private handleMouseDown = (e: MouseEvent): void => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement | null;
    if (target && target.closest('button, a, input, select, [role="button"]')) {
      return;
    }
    if (this.phase === 'playing') {
      this.sound.unlock();
      this.pointerActive = true;
      this.pointerScreenX = e.clientX;
      this.pointerScreenY = e.clientY;
      this.mouseBoostHeld = true;
    }
  };

  private handleMouseUp = (): void => {
    this.mouseBoostHeld = false;
  };

  private handleTouchStart = (e: TouchEvent): void => {
    const target = e.target as HTMLElement | null;
    if (target && target.closest('button, a, input, select, [role="button"]')) {
      return;
    }
    if (this.phase === 'playing' && e.touches.length > 0) {
      this.sound.unlock();
      const t = e.touches[0];
      this.pointerActive = true;
      this.pointerScreenX = t.clientX;
      this.pointerScreenY = t.clientY;
      if (e.touches.length >= 2) {
        this.mouseBoostHeld = true;
      }
    }
  };

  private handleTouchMove = (e: TouchEvent): void => {
    if (this.phase === 'playing' && e.touches.length > 0) {
      e.preventDefault();
      const t = e.touches[0];
      this.pointerActive = true;
      this.pointerScreenX = t.clientX;
      this.pointerScreenY = t.clientY;
    }
  };

  private handleTouchEnd = (e: TouchEvent): void => {
    if (e.touches.length < 2) {
      this.mouseBoostHeld = false;
    }
  };

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (e.repeat) {
      if (e.code === 'Space') {
        this.keysHeld.add('Space');
      }
      return;
    }

    const code = e.code;

    if (code === 'Escape' || code === 'KeyP') {
      if (this.phase === 'playing') {
        e.preventDefault();
        this.pauseGame();
        return;
      }
      if (this.phase === 'paused') {
        e.preventDefault();
        this.resumeGame();
        return;
      }
    }

    if (code === 'KeyM') {
      this.toggleMute();
      return;
    }

    if (this.phase === 'title' && (code === 'Enter' || code === 'Space')) {
      e.preventDefault();
      this.startNewGame(this.starterSkin);
      return;
    }

    if (this.phase === 'playing') {
      if (code === 'Space') {
        e.preventDefault();
        this.sound.unlock();
      }
      this.keysHeld.add(code);
    }
  };

  private handleKeyUp = (e: KeyboardEvent): void => {
    this.keysHeld.delete(e.code);
  };

  private handleVisibilityChange = (): void => {
    if (document.hidden) {
      this.clearHeldInputs();
    }
  };

  private clearHeldInputs = (): void => {
    this.keysHeld.clear();
    this.mouseBoostHeld = false;
    this.externalBoostHeld = false;
    this.joystickVecX = 0;
    this.joystickVecY = 0;
    this.sound.setBoostActive(false);
  };

  public setJoystickVector(x: number, y: number): void {
    this.joystickVecX = x;
    this.joystickVecY = y;
  }

  public setExternalBoost(active: boolean): void {
    this.externalBoostHeld = active;
    if (active) {
      this.sound.unlock();
    }
  }

  public setStarterSkin(skin: StarterCoinId): void {
    this.starterSkin = skin;
    this.sound.playUiClick();
  }

  public getStarterSkin(): StarterCoinId {
    return this.starterSkin;
  }

  public isMuted(): boolean {
    return this.sound.isMuted();
  }

  public toggleMute(): boolean {
    const next = !this.sound.isMuted();
    this.sound.setMuted(next);
    if (!next) {
      this.sound.playUiClick();
    }
    return next;
  }

  public startLoop(): void {
    if (this.rafId !== null) return;
    this.lastTimestamp = performance.now();
    const tick = (now: number) => {
      const rawDt = Math.max(0, (now - this.lastTimestamp) / 1000);
      this.lastTimestamp = now;
      const dt = Math.min(rawDt, 0.05);
      if (this.phase === 'paused' || this.phase === 'gameover') {
        if (!this.frozenFrameRendered) {
          this.render();
          this.frozenFrameRendered = true;
        }
      } else {
        this.frozenFrameRendered = false;
        this.update(dt);
        this.render();
      }
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  private setPhase(nextPhase: GamePhase): void {
    this.phase = nextPhase;
    this.frozenFrameRendered = false;
    document.body.dataset.state = nextPhase;
    this.callbacks.onPhaseChange(nextPhase);
  }

  public startNewGame(skin?: StarterCoinId, fromUserGesture = true): void {
    if (skin) {
      this.starterSkin = skin;
    }
    if (fromUserGesture) {
      this.sound.unlock();
      this.sound.playUiClick();
    }
    this.clearHeldInputs();
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    this.coins = [];
    this.pellets = [];
    this.rugPulls = [];
    this.clearEffects();
    this.coinsAbsorbed = 0;
    this.streakCount = 0;
    this.bullRunTimer = 0;
    this.fireworkTimer = 0;
    this.rugPullCooldown = 0;
    this.spawnShieldTimer = 2.8;
    this.survivalSeconds = 0;
    this.hitstopTimer = 0;
    this.liquidationDelayTimer = 0;
    this.pendingSummary = null;
    this.trauma = 0;

    // Seed ambient pellets
    for (let i = 0; i < TARGET_PELLET_COUNT; i++) {
      this.spawnRandomPellet();
    }

    // Spawn diverse AI coins across tiers
    for (let i = 0; i < TARGET_AI_COUNT; i++) {
      this.spawnAiCoin(true);
    }

    // Spawn player in a verified safe central open pocket away from edges
    const safePos = findSafeSpawnPosition(this.coins, PLAYER_START_MASS, Math.random, 760);
    const starterTier = getTierForMass(PLAYER_START_MASS, this.starterSkin);
    this.peakTier = starterTier;

    // Seed Rug Pull traps away from player's starting spot
    for (let i = 0; i < TARGET_RUG_PULL_COUNT; i++) {
      this.spawnRugPullZone(safePos.x, safePos.y);
    }

    const player: CoinEntity = {
      id: 'player',
      name: 'YOU',
      isPlayer: true,
      starterSkin: this.starterSkin,
      x: safePos.x,
      y: safePos.y,
      vx: 0,
      vy: 0,
      mass: PLAYER_START_MASS,
      radius: massToRadius(PLAYER_START_MASS),
      tier: starterTier,
      isBoosting: false,
      boostShedAcc: 0,
      hitFlash: 0,
      squashX: 1,
      squashY: 1,
      policy: 'forager',
      aiTargetX: safePos.x,
      aiTargetY: safePos.y,
      aiDecisionTimer: 0,
      telegraphTimer: 0,
      lungeTimer: 0,
      lungeDirX: 0,
      lungeDirY: 0,
      trailAcc: 0,
    };

    this.coins.push(player);
    this.camX = player.x;
    this.camY = player.y;
    this.camZoom = computeTargetZoom(player.radius, this.viewportWidth, this.viewportHeight);
    this.pointerActive = false;

    this.setPhase('playing');
    this.pushHudSnapshot();
  }

  public pauseGame(): void {
    if (this.phase !== 'playing') return;
    this.clearHeldInputs();
    this.sound.stopLoops();
    this.sound.playUiClick();
    this.setPhase('paused');
  }

  public resumeGame(): void {
    if (this.phase !== 'paused') return;
    this.clearHeldInputs();
    this.sound.playUiClick();
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    this.setPhase('playing');
  }

  public returnToTitle(): void {
    this.clearHeldInputs();
    this.sound.stopLoops();
    this.sound.playUiClick();
    this.seedWorldForTitle();
    this.setPhase('title');
  }

  private seedWorldForTitle(): void {
    this.coins = [];
    this.pellets = [];
    this.rugPulls = [];
    this.clearEffects();
    this.streakCount = 0;
    this.bullRunTimer = 0;
    this.liquidationDelayTimer = 0;
    this.pendingSummary = null;
    for (let i = 0; i < TARGET_PELLET_COUNT; i++) {
      this.spawnRandomPellet();
    }
    for (let i = 0; i < TARGET_AI_COUNT; i++) {
      this.spawnAiCoin(true);
    }
    for (let i = 0; i < TARGET_RUG_PULL_COUNT; i++) {
      this.spawnRugPullZone();
    }
    this.camX = ARENA_WIDTH / 2;
    this.camY = ARENA_HEIGHT / 2;
    this.camZoom = 0.78;
  }

  private spawnRugPullZone(avoidX?: number, avoidY?: number): void {
    const margin = 240;
    let x = margin + Math.random() * (ARENA_WIDTH - margin * 2);
    let y = margin + Math.random() * (ARENA_HEIGHT - margin * 2);
    for (let attempt = 0; attempt < 10; attempt++) {
      const cx = margin + Math.random() * (ARENA_WIDTH - margin * 2);
      const cy = margin + Math.random() * (ARENA_HEIGHT - margin * 2);
      if (avoidX !== undefined && avoidY !== undefined && Math.hypot(cx - avoidX, cy - avoidY) < 420) {
        continue;
      }
      x = cx;
      y = cy;
      break;
    }
    this.rugPulls.push({
      id: this.nextRugPullId++,
      x,
      y,
      radius: 54 + Math.random() * 22,
      pulseOffset: Math.random() * Math.PI * 2,
      ttl: 22 + Math.random() * 18,
    });
  }

  private emitFireworkBurst(centerX: number, centerY: number): void {
    const color = FIREWORK_COLORS[Math.floor(Math.random() * FIREWORK_COLORS.length)];
    this.emitParticles(centerX, centerY, 20, color, 95, 320, false);
    this.emitParticles(centerX, centerY, 8, '#F8FAFC', 60, 210, true);
  }

  private clearEffects(): void {
    for (let i = 0; i < this.particles.length; i++) {
      this.particles[i].active = false;
    }
    for (let i = 0; i < this.popups.length; i++) {
      this.popups[i].active = false;
    }
  }

  private spawnRandomPellet(): void {
    const margin = 80;
    const x = margin + Math.random() * (ARENA_WIDTH - margin * 2);
    const y = margin + Math.random() * (ARENA_HEIGHT - margin * 2);
    const isRich = Math.random() < 0.14;
    const mass = isRich ? 3.2 : 1.4;
    this.pellets.push({
      id: this.nextPelletId++,
      x,
      y,
      mass,
      radius: isRich ? 7.5 : 5,
      color: PELLET_COLORS[Math.floor(Math.random() * PELLET_COLORS.length)],
      pulseOffset: Math.random() * Math.PI * 2,
      isShed: false,
      ttl: -1,
    });
  }

  private spawnShedPellet(x: number, y: number, vx: number, vy: number, color: string): void {
    this.pellets.push({
      id: this.nextPelletId++,
      x: clampToArena(x + vx * 0.04, ARENA_WIDTH, 40),
      y: clampToArena(y + vy * 0.04, ARENA_HEIGHT, 40),
      mass: BOOST_PELLET_COST * 0.78,
      radius: 6.5,
      color,
      pulseOffset: Math.random() * Math.PI * 2,
      isShed: true,
      ttl: 18,
    });
  }

  private spawnAiCoin(initialSpread: boolean): void {
    let mass = 18 + Math.random() * 15;
    if (initialSpread) {
      const roll = Math.random();
      if (roll > 0.9) {
        mass = 880 + Math.random() * 480; // Apex BTC / ETH whale
      } else if (roll > 0.73) {
        mass = 240 + Math.random() * 320; // ADA / SOL hunter
      } else if (roll > 0.45) {
        mass = 52 + Math.random() * 95; // DOGE / SHIB
      } else {
        mass = 18 + Math.random() * 15; // Small edible starter coins
      }
    } else {
      // Dynamic difficulty ramp: gradually seed slightly stronger mid-tier rivals over time
      const timeBoost = Math.min(1.5, 1 + this.survivalSeconds / 150);
      const roll = Math.random();
      if (roll > 0.91) {
        mass = (650 + Math.random() * 520) * timeBoost;
      } else if (roll > 0.62) {
        mass = (85 + Math.random() * 170) * timeBoost;
      } else {
        mass = 18 + Math.random() * 20;
      }
    }

    const pos = findSafeSpawnPosition(this.coins, mass * 0.6);
    const tier = getTierForMass(mass, Math.random() < 0.45 ? 'DOGE' : 'PEPE');
    const name = AI_NAMES[(this.nextAiId - 1) % AI_NAMES.length];

    this.coins.push({
      id: `ai-${this.nextAiId++}`,
      name,
      isPlayer: false,
      starterSkin: Math.random() < 0.5 ? 'PEPE' : 'DOGE',
      x: pos.x,
      y: pos.y,
      vx: 0,
      vy: 0,
      mass,
      radius: massToRadius(mass),
      tier,
      isBoosting: false,
      boostShedAcc: 0,
      hitFlash: 0,
      squashX: 1,
      squashY: 1,
      policy: deriveAiPolicy(mass),
      aiTargetX: 250 + Math.random() * (ARENA_WIDTH - 500),
      aiTargetY: 250 + Math.random() * (ARENA_HEIGHT - 500),
      aiDecisionTimer: Math.random() * 0.4,
      telegraphTimer: 0,
      lungeTimer: 0,
      lungeDirX: 0,
      lungeDirY: 0,
      trailAcc: 0,
    });
  }

  private emitParticles(
    x: number,
    y: number,
    count: number,
    color: string,
    speedMin: number,
    speedMax: number,
    isShard = false,
  ): void {
    for (let i = 0; i < count; i++) {
      const p = this.particles[this.particleCursor];
      this.particleCursor = (this.particleCursor + 1) % PARTICLE_POOL_SIZE;
      const angle = Math.random() * Math.PI * 2;
      const speed = speedMin + Math.random() * (speedMax - speedMin);
      p.active = true;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.radius = isShard ? 4 + Math.random() * 6 : 2.2 + Math.random() * 3.5;
      p.maxLife = isShard ? 0.55 + Math.random() * 0.35 : 0.32 + Math.random() * 0.25;
      p.life = p.maxLife;
      p.color = color;
      p.isShard = isShard;
      p.angle = Math.random() * Math.PI * 2;
      p.spin = (Math.random() - 0.5) * 14;
    }
  }

  private emitPopup(x: number, y: number, text: string, color: string, scale = 1): void {
    const popup = this.popups[this.popupCursor];
    this.popupCursor = (this.popupCursor + 1) % POPUP_POOL_SIZE;
    popup.active = true;
    popup.x = x;
    popup.y = y;
    popup.vy = -48;
    popup.text = text;
    popup.color = color;
    popup.maxLife = 0.95;
    popup.life = popup.maxLife;
    popup.scale = scale;
  }

  private update(dt: number): void {
    if (this.phase === 'paused' || this.phase === 'gameover') {
      return;
    }

    this.simTime += dt;
    this.trauma = Math.max(0, this.trauma - dt * 1.9);

    // Real-time particle & popup animations always advance (even during hitstop)
    this.updateEffects(dt);

    // Handle dramatic liquidation shatter beat before modal opens
    if (this.liquidationDelayTimer > 0) {
      this.liquidationDelayTimer -= dt;
      if (this.liquidationDelayTimer <= 0 && this.pendingSummary) {
        const summary = this.pendingSummary;
        this.pendingSummary = null;
        this.setPhase('gameover');
        this.callbacks.onGameOver(summary);
      }
      return;
    }

    // Hitstop freeze pauses simulation physics briefly on heavy impacts
    if (this.hitstopTimer > 0) {
      this.hitstopTimer = Math.max(0, this.hitstopTimer - dt);
      return;
    }

    if (this.phase === 'playing') {
      this.survivalSeconds += dt;
      this.rugPullCooldown = Math.max(0, this.rugPullCooldown - dt);
      this.spawnShieldTimer = Math.max(0, this.spawnShieldTimer - dt);
      if (this.bullRunTimer > 0) {
        this.bullRunTimer = Math.max(0, this.bullRunTimer - dt);
        this.fireworkTimer -= dt;
        if (this.fireworkTimer <= 0) {
          this.fireworkTimer = 0.34;
          const fx = this.camX + (Math.random() - 0.5) * (this.viewportWidth / this.camZoom) * 0.78;
          const fy = this.camY + (Math.random() - 0.5) * (this.viewportHeight / this.camZoom) * 0.78;
          this.emitFireworkBurst(fx, fy);
          this.sound.playFireworkPop();
        }
      }
    }

    // Update Rug Pull trap zones (relocate expired traps)
    const playerRef = this.coins.find((c) => c.isPlayer);
    for (let i = this.rugPulls.length - 1; i >= 0; i--) {
      this.rugPulls[i].ttl -= dt;
      if (this.rugPulls[i].ttl <= 0) {
        this.rugPulls.splice(i, 1);
      }
    }
    while (this.rugPulls.length < TARGET_RUG_PULL_COUNT) {
      this.spawnRugPullZone(playerRef?.x, playerRef?.y);
    }

    // Update pellets (TTL expiry & respawn)
    for (let i = this.pellets.length - 1; i >= 0; i--) {
      const p = this.pellets[i];
      if (p.ttl > 0) {
        p.ttl -= dt;
        if (p.ttl <= 0) {
          this.pellets.splice(i, 1);
        }
      }
    }
    while (this.pellets.length < TARGET_PELLET_COUNT) {
      this.spawnRandomPellet();
    }

    // Bull Run magnetic pull on nearby pellets & smaller edible coins
    if (this.phase === 'playing' && this.bullRunTimer > 0 && playerRef) {
      for (let i = 0; i < this.pellets.length; i++) {
        const p = this.pellets[i];
        const pull = computeBullRunMagnetPull(
          playerRef.x,
          playerRef.y,
          playerRef.mass,
          p.x,
          p.y,
          p.mass,
          true,
          dt,
        );
        if (pull) {
          p.x += pull.vx;
          p.y += pull.vy;
        }
      }
      for (let i = 0; i < this.coins.length; i++) {
        const c = this.coins[i];
        if (c.isPlayer) continue;
        const pull = computeBullRunMagnetPull(
          playerRef.x,
          playerRef.y,
          playerRef.mass,
          c.x,
          c.y,
          c.mass,
          false,
          dt,
        );
        if (pull) {
          c.x += pull.vx;
          c.y += pull.vy;
        }
      }
    }

    // Respawn AI to keep arena lively
    const aiCount = this.coins.reduce((acc, c) => acc + (c.isPlayer ? 0 : 1), 0);
    if (aiCount < TARGET_AI_COUNT) {
      this.spawnAiCoin(false);
    }

    // Step player & AI coins
    const aggressionScale = 1 + Math.min(0.35, this.survivalSeconds / 180);
    for (let i = 0; i < this.coins.length; i++) {
      const coin = this.coins[i];
      coin.hitFlash = Math.max(0, coin.hitFlash - dt);
      coin.squashX += (1 - coin.squashX) * Math.min(1, dt * 14);
      coin.squashY += (1 - coin.squashY) * Math.min(1, dt * 14);

      if (coin.isPlayer) {
        this.stepPlayerCoin(coin, dt);
      } else {
        this.stepAiCoin(coin, dt, aggressionScale);
      }

      // Clamp to arena boundaries with gentle bounce
      const r = coin.radius;
      if (coin.x < r) {
        coin.x = r;
        coin.vx = Math.abs(coin.vx) * 0.4;
      } else if (coin.x > ARENA_WIDTH - r) {
        coin.x = ARENA_WIDTH - r;
        coin.vx = -Math.abs(coin.vx) * 0.4;
      }
      if (coin.y < r) {
        coin.y = r;
        coin.vy = Math.abs(coin.vy) * 0.4;
      } else if (coin.y > ARENA_HEIGHT - r) {
        coin.y = ARENA_HEIGHT - r;
        coin.vy = -Math.abs(coin.vy) * 0.4;
      }
    }

    // Pellet absorptions
    this.resolvePelletCollisions();

    // Rug Pull trap collisions
    this.resolveRugPullCollisions();

    // Coin-vs-coin collisions
    this.resolveCoinCollisions();

    // Update camera
    if (this.phase === 'title') {
      // Atmospheric live world camera tour
      const tourX = ARENA_WIDTH / 2 + Math.cos(this.simTime * 0.12) * 900;
      const tourY = ARENA_HEIGHT / 2 + Math.sin(this.simTime * 0.17) * 720;
      this.camX += (tourX - this.camX) * Math.min(1, dt * 1.4);
      this.camY += (tourY - this.camY) * Math.min(1, dt * 1.4);
      this.camZoom += (0.76 - this.camZoom) * Math.min(1, dt * 2);
    } else {
      const player = this.coins.find((c) => c.isPlayer);
      if (player) {
        this.camX += (player.x - this.camX) * Math.min(1, dt * 9);
        this.camY += (player.y - this.camY) * Math.min(1, dt * 9);
        const targetZoom = computeTargetZoom(
          player.radius,
          this.viewportWidth,
          this.viewportHeight,
        );
        this.camZoom += (targetZoom - this.camZoom) * Math.min(1, dt * 3.5);
      }
    }

    // Throttled HUD sync (~15Hz)
    if (this.phase === 'playing') {
      this.hudSyncTimer += dt;
      if (this.hudSyncTimer >= 0.065) {
        this.hudSyncTimer = 0;
        this.pushHudSnapshot();
      }
    }
  }

  private stepPlayerCoin(player: CoinEntity, dt: number): void {
    // Check keyboard WASD/Arrows steering override
    let keyDx = 0;
    let keyDy = 0;
    if (this.keysHeld.has('KeyW') || this.keysHeld.has('ArrowUp')) keyDy -= 1;
    if (this.keysHeld.has('KeyS') || this.keysHeld.has('ArrowDown')) keyDy += 1;
    if (this.keysHeld.has('KeyA') || this.keysHeld.has('ArrowLeft')) keyDx -= 1;
    if (this.keysHeld.has('KeyD') || this.keysHeld.has('ArrowRight')) keyDx += 1;

    let dirX = 0;
    let dirY = 0;
    let throttle = 0;

    if (keyDx !== 0 || keyDy !== 0) {
      const len = Math.hypot(keyDx, keyDy);
      dirX = keyDx / len;
      dirY = keyDy / len;
      throttle = 1;
    } else if (Math.hypot(this.joystickVecX, this.joystickVecY) > 0.01) {
      const len = Math.hypot(this.joystickVecX, this.joystickVecY);
      dirX = this.joystickVecX / len;
      dirY = this.joystickVecY / len;
      throttle = Math.min(1, len);
    } else if (this.pointerActive) {
      const worldTarget = this.screenToWorld(this.pointerScreenX, this.pointerScreenY);
      const dx = worldTarget.x - player.x;
      const dy = worldTarget.y - player.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 6) {
        dirX = dx / dist;
        dirY = dy / dist;
        throttle = Math.min(1, dist / Math.max(45, player.radius * 1.4));
      }
    }

    const wantsBoost =
      this.keysHeld.has('Space') || this.mouseBoostHeld || this.externalBoostHeld;
    const boostResult = applyLeverageBoost(player.mass, dt, wantsBoost);
    player.mass = boostResult.nextMass;
    player.isBoosting = boostResult.isBoosting;
    player.radius = massToRadius(player.mass);
    player.tier = getTierForMass(player.mass, player.starterSkin);
    this.sound.setBoostActive(player.isBoosting);

    const bullRunMult = this.bullRunTimer > 0 ? BULL_RUN_SPEED_MULTIPLIER : 1;

    if (boostResult.shedMass > 0) {
      player.boostShedAcc += boostResult.shedMass;
      if (player.boostShedAcc >= BOOST_PELLET_COST) {
        player.boostShedAcc -= BOOST_PELLET_COST;
        const backX = player.vx !== 0 || player.vy !== 0 ? -player.vx : -dirX;
        const backY = player.vx !== 0 || player.vy !== 0 ? -player.vy : -dirY;
        const backLen = Math.max(1, Math.hypot(backX, backY));
        this.spawnShedPellet(
          player.x + (backX / backLen) * (player.radius + 8),
          player.y + (backY / backLen) * (player.radius + 8),
          (backX / backLen) * 90,
          (backY / backLen) * 90,
          '#22D3EE',
        );
      }
    }

    const baseSpeed = computeBaseSpeed(player.mass) * boostResult.speedMultiplier * bullRunMult;
    const targetVx = dirX * baseSpeed * (player.isBoosting ? Math.max(0.65, throttle) : throttle);
    const targetVy = dirY * baseSpeed * (player.isBoosting ? Math.max(0.65, throttle) : throttle);

    // Smooth momentum inertia
    const accel = player.isBoosting ? 11 : 7.5;
    player.vx += (targetVx - player.vx) * Math.min(1, dt * accel);
    player.vy += (targetVy - player.vy) * Math.min(1, dt * accel);
    player.x += player.vx * dt;
    player.y += player.vy * dt;

    // Trail particles when boosting or moving fast
    const speed = Math.hypot(player.vx, player.vy);
    if (player.isBoosting || speed > 180) {
      player.trailAcc += dt * (player.isBoosting ? 42 : 14);
      while (player.trailAcc >= 1) {
        player.trailAcc -= 1;
        this.emitParticles(
          player.x - (player.vx / Math.max(1, speed)) * player.radius * 0.7,
          player.y - (player.vy / Math.max(1, speed)) * player.radius * 0.7,
          1,
          player.isBoosting ? '#22D3EE' : player.tier.color,
          20,
          75,
          false,
        );
      }
    }
  }

  private stepAiCoin(ai: CoinEntity, dt: number, aggressionScale: number): void {
    ai.aiDecisionTimer -= dt;
    if (ai.aiDecisionTimer <= 0 || Math.hypot(ai.aiTargetX - ai.x, ai.aiTargetY - ai.y) < 40) {
      ai.aiDecisionTimer = 0.22 + Math.random() * 0.16;
      const decision = stepAiDecision(ai, this.coins, this.pellets, 0.25, aggressionScale);
      ai.aiTargetX = decision.targetX;
      ai.aiTargetY = decision.targetY;
      ai.telegraphTimer = decision.telegraphTimer;
      ai.lungeTimer = decision.lungeTimer;
      ai.lungeDirX = decision.lungeDirX;
      ai.lungeDirY = decision.lungeDirY;
      ai.isBoosting = decision.wantsBoost;

      // Occasional random wander target if idle
      if (Math.hypot(ai.aiTargetX - ai.x, ai.aiTargetY - ai.y) < 35) {
        ai.aiTargetX = 220 + Math.random() * (ARENA_WIDTH - 440);
        ai.aiTargetY = 220 + Math.random() * (ARENA_HEIGHT - 440);
      }
    } else {
      ai.telegraphTimer = Math.max(0, ai.telegraphTimer - dt);
      ai.lungeTimer = Math.max(0, ai.lungeTimer - dt);
    }

    const boostResult = applyLeverageBoost(ai.mass, dt, ai.isBoosting);
    ai.mass = boostResult.nextMass;
    ai.isBoosting = boostResult.isBoosting;
    ai.radius = massToRadius(ai.mass);
    ai.tier = getTierForMass(ai.mass, ai.starterSkin);
    ai.policy = deriveAiPolicy(ai.mass);

    const dx = ai.aiTargetX - ai.x;
    const dy = ai.aiTargetY - ai.y;
    const dist = Math.max(1, Math.hypot(dx, dy));
    // Slight windup slow-down during telegraph so player can read incoming lunge
    const telegraphBrake = ai.telegraphTimer > 0 ? 0.65 : 1;
    const speed = computeBaseSpeed(ai.mass) * boostResult.speedMultiplier * telegraphBrake;

    const targetVx = (dx / dist) * speed;
    const targetVy = (dy / dist) * speed;
    ai.vx += (targetVx - ai.vx) * Math.min(1, dt * 6);
    ai.vy += (targetVy - ai.vy) * Math.min(1, dt * 6);
    ai.x += ai.vx * dt;
    ai.y += ai.vy * dt;
  }

  private resolvePelletCollisions(): void {
    for (let pIdx = this.pellets.length - 1; pIdx >= 0; pIdx--) {
      const p = this.pellets[pIdx];
      for (let cIdx = 0; cIdx < this.coins.length; cIdx++) {
        const coin = this.coins[cIdx];
        const dx = p.x - coin.x;
        const dy = p.y - coin.y;
        const reach = coin.radius + p.radius * 0.6;
        if (dx * dx + dy * dy <= reach * reach) {
          const prevCap = massToMarketCap(coin.mass);
          coin.mass += p.mass;
          coin.radius = massToRadius(coin.mass);
          const prevTierId = coin.tier.id;
          coin.tier = getTierForMass(coin.mass, coin.starterSkin);

          if (coin.isPlayer) {
            const newCap = massToMarketCap(coin.mass);
            this.saveBestMarketCap(newCap);
            this.sound.playPelletPop();
            coin.squashX = 1.07;
            coin.squashY = 0.94;
            this.emitParticles(p.x, p.y, 4, p.color, 35, 110, false);

            const capGain = newCap - prevCap;
            if (p.isShed || capGain >= 800_000) {
              this.emitPopup(p.x, p.y - 10, `+${formatMarketCap(capGain)}`, '#22D3EE', 0.88);
            }

            if (coin.tier.id !== prevTierId && tierOrderIndex(coin.tier.id) > tierOrderIndex(this.peakTier.id)) {
              this.peakTier = coin.tier;
              this.sound.playTierEvolve();
              this.emitPopup(
                coin.x,
                coin.y - coin.radius - 26,
                `EVOLVED · ${coin.tier.symbol}`,
                coin.tier.color,
                1.22,
              );
              this.emitParticles(coin.x, coin.y, 18, coin.tier.color, 90, 260, false);
            }
          }

          this.pellets.splice(pIdx, 1);
          break;
        }
      }
    }
  }

  private resolveRugPullCollisions(): void {
    if (this.phase !== 'playing' || this.rugPullCooldown > 0) return;
    const player = this.coins.find((c) => c.isPlayer);
    if (!player) return;

    for (let i = this.rugPulls.length - 1; i >= 0; i--) {
      const trap = this.rugPulls[i];
      const dx = player.x - trap.x;
      const dy = player.y - trap.y;
      const reach = player.radius * 0.72 + trap.radius * 0.85;
      if (dx * dx + dy * dy <= reach * reach) {
        player.mass = applyRugPullPenalty(player.mass);
        player.radius = massToRadius(player.mass);
        player.tier = getTierForMass(player.mass, player.starterSkin);
        player.hitFlash = 0.085;
        player.squashX = 0.78;
        player.squashY = 1.24;

        // Taking damage resets streak and ends any active Bull Run
        this.streakCount = 0;
        this.bullRunTimer = 0;
        this.rugPullCooldown = 0.9;
        this.hitstopTimer = 0.055;
        this.trauma = Math.min(1, this.trauma + 0.65);

        this.sound.playRugPullAlert();
        this.emitParticles(player.x, player.y, 24, '#F43F5E', 85, 290, true);
        this.emitPopup(player.x, player.y - player.radius - 16, 'RUG PULL! -30%', '#F43F5E', 1.28);

        this.rugPulls.splice(i, 1);
        this.spawnRugPullZone(player.x, player.y);
        this.pushHudSnapshot();
        break;
      }
    }
  }

  private resolveCoinCollisions(): void {
    const deadIndices = new Set<number>();

    for (let i = 0; i < this.coins.length; i++) {
      if (deadIndices.has(i)) continue;
      const a = this.coins[i];

      for (let j = i + 1; j < this.coins.length; j++) {
        if (deadIndices.has(j)) continue;
        const b = this.coins[j];

        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy);
        const overlapThreshold = (a.radius + b.radius) * 0.78;
        if (dist >= overlapThreshold) continue;

        const outcome = resolveCollisionOutcome(a.mass, b.mass);
        const involvesProtectedPlayer =
          this.spawnShieldTimer > 0 &&
          ((outcome === 'a_eats_b' && b.isPlayer) || (outcome === 'b_eats_a' && a.isPlayer));
        if (outcome === 'bounce' || involvesProtectedPlayer) {
          // Gentle elastic separation for near-equal coins or spawn-shielded player
          const nx = dist > 0.01 ? dx / dist : 1;
          const ny = dist > 0.01 ? dy / dist : 0;
          const push = Math.max(2, overlapThreshold - dist) * 0.5;
          a.x -= nx * push;
          a.y -= ny * push;
          b.x += nx * push;
          b.y += ny * push;
          a.vx -= nx * 40;
          a.vy -= ny * 40;
          b.vx += nx * 40;
          b.vy += ny * 40;
          continue;
        }

        const winner = outcome === 'a_eats_b' ? a : b;
        const loser = outcome === 'a_eats_b' ? b : a;
        const loserIdx = outcome === 'a_eats_b' ? j : i;

        deadIndices.add(loserIdx);

        const prevWinnerCap = massToMarketCap(winner.mass);
        const prevWinnerTierId = winner.tier.id;
        winner.mass += computeAbsorbedMassGain(loser.mass);
        winner.radius = massToRadius(winner.mass);
        winner.tier = getTierForMass(winner.mass, winner.starterSkin);
        winner.hitFlash = 0.065;
        winner.squashX = 1.18;
        winner.squashY = 0.84;

        this.emitParticles(loser.x, loser.y, 16, loser.tier.color, 70, 260, true);

        if (winner.isPlayer) {
          this.coinsAbsorbed += 1;
          const newCap = massToMarketCap(winner.mass);
          this.saveBestMarketCap(newCap);
          const capGain = Math.max(100_000, newCap - prevWinnerCap);

          this.sound.playCoinAbsorb(loser.mass);
          this.hitstopTimer = loser.mass > 120 ? 0.05 : 0.032;
          this.trauma = Math.min(1, this.trauma + (loser.mass > 120 ? 0.42 : 0.24));

          this.emitPopup(
            loser.x,
            loser.y - 12,
            `+${formatMarketCap(capGain)}`,
            '#10B981',
            loser.mass > 120 ? 1.25 : 1.05,
          );

          // Advance 5-coin streak toward Bull Run
          const streakRes = advanceCoinStreak(this.streakCount, this.bullRunTimer > 0);
          this.streakCount = streakRes.nextStreak;
          if (streakRes.triggeredBullRun) {
            this.bullRunTimer = BULL_RUN_DURATION;
            this.fireworkTimer = 0.1;
            this.sound.playBullRunFanfare();
            this.emitFireworkBurst(winner.x, winner.y);
            this.emitPopup(
              winner.x,
              winner.y - winner.radius - 44,
              'BULL RUN! 2x SPEED',
              '#22D3EE',
              1.4,
            );
          }

          if (
            winner.tier.id !== prevWinnerTierId &&
            tierOrderIndex(winner.tier.id) > tierOrderIndex(this.peakTier.id)
          ) {
            this.peakTier = winner.tier;
            this.sound.playTierEvolve();
            this.emitPopup(
              winner.x,
              winner.y - winner.radius - 30,
              `EVOLVED · ${winner.tier.symbol}`,
              winner.tier.color,
              1.3,
            );
            this.emitParticles(winner.x, winner.y, 24, winner.tier.color, 110, 310, false);
          }
        } else if (loser.isPlayer) {
          // Player liquidated! Trigger dramatic shatter + 0.48s beat before Game Over modal
          this.sound.playLiquidationCrash();
          this.clearHeldInputs();
          this.hitstopTimer = 0.075;
          this.trauma = 0.95;
          this.emitParticles(loser.x, loser.y, 34, '#F43F5E', 110, 420, true);
          this.emitParticles(loser.x, loser.y, 20, loser.tier.color, 80, 300, true);
          this.emitPopup(loser.x, loser.y - 20, 'LIQUIDATED!', '#F43F5E', 1.4);

          const finalCap = massToMarketCap(loser.mass);
          this.saveBestMarketCap(finalCap);
          this.pendingSummary = {
            finalMarketCap: finalCap,
            bestMarketCap: Math.max(this.bestMarketCap, finalCap),
            coinsAbsorbed: this.coinsAbsorbed,
            peakTier: this.peakTier,
            survivalSeconds: Math.round(this.survivalSeconds),
            liquidatedBy: `${winner.name} (${winner.tier.symbol})`,
          };
          this.liquidationDelayTimer = 0.48;
          this.pushHudSnapshot(winner.name);
        }

        if (loserIdx === i) break;
      }
    }

    if (deadIndices.size > 0) {
      this.coins = this.coins.filter((_, idx) => !deadIndices.has(idx));
    }
  }

  private updateEffects(dt: number): void {
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= Math.pow(0.08, dt);
      p.vy *= Math.pow(0.08, dt);
      p.angle += p.spin * dt;
    }

    for (let i = 0; i < this.popups.length; i++) {
      const pop = this.popups[i];
      if (!pop.active) continue;
      pop.life -= dt;
      if (pop.life <= 0) {
        pop.active = false;
        continue;
      }
      pop.y += pop.vy * dt;
    }
  }

  private pushHudSnapshot(liquidatedBy: string | null = null): void {
    const player = this.coins.find((c) => c.isPlayer);
    const lb = buildLeaderboard(this.coins, 5);

    const mass = player ? player.mass : PLAYER_START_MASS;
    const marketCap = player
      ? massToMarketCap(player.mass)
      : this.pendingSummary?.finalMarketCap ?? 0;
    const tier = player ? player.tier : this.peakTier;
    const nextTier = player ? getNextTierForMass(player.mass, player.starterSkin) : null;
    const tierProgress = player ? getTierProgress(player.mass, player.starterSkin) : 1;

    const radarPoints = this.coins.map((c) => ({
      xNorm: c.x / ARENA_WIDTH,
      yNorm: c.y / ARENA_HEIGHT,
      isPlayer: c.isPlayer,
      isThreat: player ? c.mass >= player.mass * CAN_ABSORB_RATIO : false,
      isEdible: player ? player.mass >= c.mass * CAN_ABSORB_RATIO : false,
      isWhale: c.tier.id === 'BTC',
    }));

    this.callbacks.onHudUpdate({
      phase: this.phase,
      marketCap,
      bestMarketCap: Math.max(this.bestMarketCap, marketCap),
      coinsAbsorbed: this.coinsAbsorbed,
      tier,
      nextTier,
      tierProgress,
      mass: Math.round(mass),
      canBoost: player ? player.mass > MIN_BOOST_MASS + 0.5 : false,
      isBoosting: player ? player.isBoosting : false,
      boostReservePct: computeBoostReservePct(mass),
      streakCount: this.streakCount,
      bullRunTimer: this.bullRunTimer,
      leaderboard: lb.entries,
      playerRank: lb.playerRank,
      totalEntities: this.coins.length,
      survivalSeconds: Math.round(this.survivalSeconds),
      liquidatedBy,
      radarPoints,
    });
  }

  private render(): void {
    const ctx = this.ctx;
    const w = this.viewportWidth;
    const h = this.viewportHeight;

    ctx.save();
    ctx.scale(this.dpr, this.dpr);

    // 1. Deep obsidian terminal background
    ctx.fillStyle = '#070A0F';
    ctx.fillRect(0, 0, w, h);

    // Camera shake offset (trauma^2)
    const shakeMag = this.trauma * this.trauma * 18;
    const shakeX = shakeMag > 0.1 ? (Math.random() * 2 - 1) * shakeMag : 0;
    const shakeY = shakeMag > 0.1 ? (Math.random() * 2 - 1) * shakeMag : 0;

    ctx.save();
    ctx.translate(w / 2 + shakeX, h / 2 + shakeY);
    ctx.scale(this.camZoom, this.camZoom);
    ctx.translate(-this.camX, -this.camY);

    // 2. Cyberpunk terminal grid inside visible viewport bounds
    this.renderArenaGrid(ctx, w, h);

    // 2b. Rug Pull trap zones (pulsing crimson danger fields)
    const halfViewW = w / (2 * this.camZoom) + 140;
    const halfViewH = h / (2 * this.camZoom) + 140;
    const minVisX = this.camX - halfViewW;
    const maxVisX = this.camX + halfViewW;
    const minVisY = this.camY - halfViewH;
    const maxVisY = this.camY + halfViewH;

    for (let i = 0; i < this.rugPulls.length; i++) {
      const trap = this.rugPulls[i];
      if (
        trap.x + trap.radius < minVisX ||
        trap.x - trap.radius > maxVisX ||
        trap.y + trap.radius < minVisY ||
        trap.y - trap.radius > maxVisY
      ) {
        continue;
      }
      const blink = 0.5 + 0.5 * Math.sin(this.simTime * 7.5 + trap.pulseOffset);
      ctx.save();
      ctx.translate(trap.x, trap.y);

      // Pulsing hazard fill
      ctx.beginPath();
      ctx.arc(0, 0, trap.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(244, 63, 94, ${0.12 + blink * 0.18})`;
      ctx.fill();

      // Rotating dashed warning perimeter
      ctx.save();
      ctx.rotate(this.simTime * 1.1);
      ctx.strokeStyle = `rgba(244, 63, 94, ${0.55 + blink * 0.45})`;
      ctx.lineWidth = 3;
      ctx.setLineDash([12, 8]);
      ctx.beginPath();
      ctx.arc(0, 0, trap.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // Hazard warning triangle icon + label
      ctx.strokeStyle = '#FDA4AF';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -18);
      ctx.lineTo(16, 10);
      ctx.lineTo(-16, 10);
      ctx.closePath();
      ctx.stroke();

      ctx.fillStyle = '#FDA4AF';
      ctx.font = '700 11px "Outfit", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('!', 0, -1);

      ctx.font = '700 11px "JetBrains Mono", monospace';
      ctx.fillStyle = '#FECDD3';
      ctx.fillText('RUG PULL -30%', 0, 24);
      ctx.restore();
    }

    // 3. Pellets (satoshi / gas nodes)
    for (let i = 0; i < this.pellets.length; i++) {
      const p = this.pellets[i];
      if (p.x < minVisX || p.x > maxVisX || p.y < minVisY || p.y > maxVisY) continue;
      const pulse = 1 + Math.sin(this.simTime * 3.8 + p.pulseOffset) * 0.16;
      const pr = p.radius * pulse;

      ctx.beginPath();
      ctx.arc(p.x, p.y, pr * 1.85, 0, Math.PI * 2);
      ctx.fillStyle = p.color + '26';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(p.x, p.y, pr, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
    }

    // 4. Particles (below coins)
    for (let i = 0; i < this.particles.length; i++) {
      const pt = this.particles[i];
      if (!pt.active) continue;
      if (pt.x < minVisX || pt.x > maxVisX || pt.y < minVisY || pt.y > maxVisY) continue;
      const alpha = Math.max(0, pt.life / pt.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(pt.x, pt.y);
      ctx.fillStyle = pt.color;
      if (pt.isShard) {
        ctx.rotate(pt.angle);
        ctx.beginPath();
        ctx.moveTo(-pt.radius, -pt.radius * 0.6);
        ctx.lineTo(pt.radius, 0);
        ctx.lineTo(-pt.radius * 0.4, pt.radius);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, pt.radius * alpha, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // 5. Player subtle cursor steering vector
    const player = this.coins.find((c) => c.isPlayer);
    if (player && this.phase === 'playing' && this.pointerActive) {
      const target = this.screenToWorld(this.pointerScreenX, this.pointerScreenY);
      const dx = target.x - player.x;
      const dy = target.y - player.y;
      const dist = Math.hypot(dx, dy);
      if (dist > player.radius + 14) {
        const nx = dx / dist;
        const ny = dy / dist;
        const lineLen = Math.min(dist, player.radius + 76);
        ctx.save();
        ctx.strokeStyle = player.isBoosting
          ? 'rgba(34, 211, 238, 0.5)'
          : 'rgba(34, 211, 238, 0.22)';
        ctx.lineWidth = player.isBoosting ? 2.5 : 1.5;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(player.x + nx * (player.radius + 8), player.y + ny * (player.radius + 8));
        ctx.lineTo(player.x + nx * lineLen, player.y + ny * lineLen);
        ctx.stroke();
        ctx.restore();
      }
    }

    // 6. Coins sorted by mass ascending so whales render cleanly over small coins
    const sortedCoins = [...this.coins].sort((a, b) => a.mass - b.mass);
    const playerMass = this.phase === 'playing' && player ? player.mass : null;

    for (let i = 0; i < sortedCoins.length; i++) {
      const c = sortedCoins[i];
      if (
        c.x + c.radius + 40 < minVisX ||
        c.x - c.radius - 40 > maxVisX ||
        c.y + c.radius + 40 < minVisY ||
        c.y - c.radius - 40 > maxVisY
      ) {
        continue;
      }

      // Lunge telegraph sight-line for hunters/whales
      if (c.telegraphTimer > 0 && c.lungeDirX !== 0) {
        ctx.save();
        ctx.strokeStyle = 'rgba(244, 63, 94, 0.55)';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([8, 6]);
        ctx.beginPath();
        ctx.moveTo(c.x, c.y);
        ctx.lineTo(c.x + c.lungeDirX * (c.radius + 170), c.y + c.lungeDirY * (c.radius + 170));
        ctx.stroke();
        ctx.restore();
      }

      renderCoinEntity(ctx, c, playerMass, this.simTime, this.phase !== 'title');
    }

    // 7. Floating "+$100M" / Tier Up popups
    for (let i = 0; i < this.popups.length; i++) {
      const pop = this.popups[i];
      if (!pop.active) continue;
      const alpha = Math.min(1, (pop.life / pop.maxLife) * 1.4);
      ctx.save();
      ctx.globalAlpha = alpha;
      const fontSize = Math.round(16 * pop.scale);
      ctx.font = `700 ${fontSize}px "JetBrains Mono", monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.strokeStyle = 'rgba(7, 10, 15, 0.92)';
      ctx.lineWidth = 4;
      ctx.strokeText(pop.text, pop.x, pop.y);
      ctx.fillStyle = pop.color;
      ctx.fillText(pop.text, pop.x, pop.y);
      ctx.restore();
    }

    ctx.restore();

    // Bull Run full-screen neon aura & magnet ring
    if (this.phase === 'playing' && this.bullRunTimer > 0) {
      const bullPulse = 0.55 + 0.45 * Math.sin(this.simTime * 10);
      ctx.save();
      ctx.strokeStyle = `rgba(34, 211, 238, ${0.35 + bullPulse * 0.35})`;
      ctx.lineWidth = 10;
      ctx.strokeRect(5, 5, w - 10, h - 10);
      ctx.strokeStyle = `rgba(16, 185, 129, ${0.22 + bullPulse * 0.25})`;
      ctx.lineWidth = 4;
      ctx.strokeRect(14, 14, w - 28, h - 28);
      ctx.restore();
    }

    // Subtle dark edge vignette during active play
    if (this.phase === 'playing' && this.trauma > 0.15) {
      ctx.save();
      ctx.strokeStyle = `rgba(244, 63, 94, ${Math.min(0.45, this.trauma * 0.5)})`;
      ctx.lineWidth = 12;
      ctx.strokeRect(0, 0, w, h);
      ctx.restore();
    }

    ctx.restore();
  }

  private renderArenaGrid(
    ctx: CanvasRenderingContext2D,
    viewportW: number,
    viewportH: number,
  ): void {
    const halfW = viewportW / (2 * this.camZoom) + 120;
    const halfH = viewportH / (2 * this.camZoom) + 120;

    const startX = Math.max(0, Math.floor((this.camX - halfW) / 100) * 100);
    const endX = Math.min(ARENA_WIDTH, Math.ceil((this.camX + halfW) / 100) * 100);
    const startY = Math.max(0, Math.floor((this.camY - halfH) / 100) * 100);
    const endY = Math.min(ARENA_HEIGHT, Math.ceil((this.camY + halfH) / 100) * 100);

    // Subtle minor grid
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.055)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = startX; x <= endX; x += 100) {
      ctx.moveTo(x, startY);
      ctx.lineTo(x, endY);
    }
    for (let y = startY; y <= endY; y += 100) {
      ctx.moveTo(startX, y);
      ctx.lineTo(endX, y);
    }
    ctx.stroke();

    // Major terminal sectors every 500px
    const majStartX = Math.max(0, Math.floor(startX / 500) * 500);
    const majStartY = Math.max(0, Math.floor(startY / 500) * 500);
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.12)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let x = majStartX; x <= endX; x += 500) {
      ctx.moveTo(x, startY);
      ctx.lineTo(x, endY);
    }
    for (let y = majStartY; y <= endY; y += 500) {
      ctx.moveTo(startX, y);
      ctx.lineTo(endX, y);
    }
    ctx.stroke();

    // Arena laser boundary (layered glow without CPU shadowBlur)
    ctx.save();
    ctx.strokeStyle = 'rgba(244, 63, 94, 0.22)';
    ctx.lineWidth = 16;
    ctx.strokeRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);
    ctx.strokeStyle = '#F43F5E';
    ctx.lineWidth = 5;
    ctx.strokeRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);
    ctx.restore();
  }
}
