import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  MIN_BOOST_MASS,
  PLAYER_START_MASS,
  RUG_PULL_MIN_MASS,
  advanceCoinStreak,
  applyLeverageBoost,
  applyRugPullPenalty,
  buildLeaderboard,
  computeBullRunMagnetPull,
  computeJoystickVector,
  computeTargetZoom,
  findSafeSpawnPosition,
  formatMarketCap,
  getNextTierForMass,
  getTierForMass,
  getTierProgress,
  massToMarketCap,
  massToRadius,
  resolveCollisionOutcome,
  stepAiDecision,
} from './rules';

test('tier progression evolves from starter skin up to BTC whale', () => {
  assert.equal(getTierForMass(28, 'PEPE').id, 'PEPE');
  assert.equal(getTierForMass(28, 'DOGE').id, 'DOGE');
  assert.equal(getTierForMass(60, 'PEPE').id, 'DOGE');
  assert.equal(getTierForMass(130, 'PEPE').id, 'SHIB');
  assert.equal(getTierForMass(250, 'PEPE').id, 'ADA');
  assert.equal(getTierForMass(400, 'PEPE').id, 'SOL');
  assert.equal(getTierForMass(700, 'PEPE').id, 'ETH');
  assert.equal(getTierForMass(1200, 'PEPE').id, 'BTC');

  assert.equal(getNextTierForMass(28, 'PEPE')?.id, 'DOGE');
  assert.equal(getNextTierForMass(1200, 'PEPE'), null);
  assert.equal(getTierProgress(1200, 'PEPE'), 1);
});

test('market cap calculation and formatting produce clean tabular readouts', () => {
  const starterCap = massToMarketCap(PLAYER_START_MASS);
  assert.ok(starterCap > 1_000_000);
  assert.match(formatMarketCap(starterCap), /^\$\d+M$/);
  assert.equal(formatMarketCap(1_250_000_000), '$1.25B');
  assert.equal(formatMarketCap(12_400_000_000), '$12.4B');
  assert.equal(formatMarketCap(450_000), '$450K');
});

test('collision resolution enforces strict size advantage with safe tie buffer', () => {
  assert.equal(resolveCollisionOutcome(120, 100), 'a_eats_b');
  assert.equal(resolveCollisionOutcome(100, 120), 'b_eats_a');
  assert.equal(resolveCollisionOutcome(102, 100), 'bounce');
  assert.equal(resolveCollisionOutcome(100, 100), 'bounce');
});

test('leverage boost increases speed while draining mass down to safety floor', () => {
  const boosted = applyLeverageBoost(50, 0.5, true);
  assert.equal(boosted.isBoosting, true);
  assert.ok(boosted.speedMultiplier > 1.5);
  assert.ok(boosted.nextMass < 50);
  assert.ok(boosted.shedMass > 0);

  const clamped = applyLeverageBoost(MIN_BOOST_MASS, 0.5, true);
  assert.equal(clamped.isBoosting, false);
  assert.equal(clamped.speedMultiplier, 1);
  assert.equal(clamped.nextMass, MIN_BOOST_MASS);
});

test('camera smoothly zooms out as player radius grows', () => {
  const smallZoom = computeTargetZoom(massToRadius(PLAYER_START_MASS), 1440, 900);
  const largeZoom = computeTargetZoom(massToRadius(800), 1440, 900);
  assert.ok(smallZoom > largeZoom);
  assert.ok(largeZoom >= 0.42);
});

test('AI policies flee threats, hunt smaller targets, and telegraph lunges', () => {
  const predator = { id: 'p1', x: 500, y: 500, mass: 300, radius: 85, isPlayer: false };
  const smallAi = {
    id: 'a1',
    isPlayer: false,
    x: 620,
    y: 500,
    mass: 45,
    radius: 40,
    policy: 'forager' as const,
    aiTargetX: 0,
    aiTargetY: 0,
    telegraphTimer: 0,
    lungeTimer: 0,
    lungeDirX: 0,
    lungeDirY: 0,
  };
  const fleeDecision = stepAiDecision(smallAi, [predator, smallAi], [], 0.016);
  assert.ok(fleeDecision.targetX > smallAi.x);

  const hunterAi = {
    id: 'h1',
    isPlayer: false,
    x: 1000,
    y: 1000,
    mass: 180,
    radius: 70,
    policy: 'hunter' as const,
    aiTargetX: 1000,
    aiTargetY: 1000,
    telegraphTimer: 0,
    lungeTimer: 0,
    lungeDirX: 0,
    lungeDirY: 0,
  };
  const prey = { id: 'prey', x: 1120, y: 1000, mass: 45, radius: 40, isPlayer: true };
  const huntDecision = stepAiDecision(hunterAi, [hunterAi, prey], [], 0.016);
  assert.equal(huntDecision.targetX, prey.x);
  assert.ok(huntDecision.telegraphTimer > 0);
});

test('safe spawn avoids large predators and leaderboard sorts descending', () => {
  const whales = [
    { x: ARENA_WIDTH / 2, y: ARENA_HEIGHT / 2, mass: 1200, radius: 160 },
  ];
  const spawn = findSafeSpawnPosition(whales, PLAYER_START_MASS, () => 0.15);
  const dist = Math.hypot(spawn.x - whales[0].x, spawn.y - whales[0].y);
  assert.ok(dist > 450);

  const lb = buildLeaderboard(
    [
      { id: '1', name: 'A', tier: getTierForMass(30), mass: 30, isPlayer: true },
      { id: '2', name: 'B', tier: getTierForMass(900), mass: 900, isPlayer: false },
      { id: '3', name: 'C', tier: getTierForMass(200), mass: 200, isPlayer: false },
    ],
    2,
  );
  assert.equal(lb.entries[0].id, '2');
  assert.equal(lb.entries[1].id, '3');
  assert.equal(lb.playerRank, 3);
});

test('Rug Pull penalty slashes mass by 30% while respecting playable floor', () => {
  assert.equal(applyRugPullPenalty(100), 70);
  assert.equal(applyRugPullPenalty(18), RUG_PULL_MIN_MASS);
});

test('Bull Run triggers on 5 consecutive coins without damage and magnet pulls only edible coins', () => {
  let streak = 0;
  for (let i = 0; i < 4; i++) {
    const res = advanceCoinStreak(streak, false);
    assert.equal(res.triggeredBullRun, false);
    streak = res.nextStreak;
  }
  const trigger = advanceCoinStreak(streak, false);
  assert.equal(trigger.triggeredBullRun, true);
  assert.equal(trigger.nextStreak, 0);

  // Pulls smaller edible coin toward player
  const pullSmall = computeBullRunMagnetPull(500, 500, 120, 650, 500, 40, false, 0.016);
  assert.ok(pullSmall !== null && pullSmall.vx < 0);

  // Does NOT pull larger predator toward player
  const pullPredator = computeBullRunMagnetPull(500, 500, 120, 650, 500, 300, false, 0.016);
  assert.equal(pullPredator, null);

  // Pulls pellets within magnet radius
  const pullPellet = computeBullRunMagnetPull(500, 500, 40, 620, 500, 2, true, 0.016);
  assert.ok(pullPellet !== null && pullPellet.vx < 0);
});

test('Virtual joystick applies deadzone and clamps normalized magnitude to 1', () => {
  const dead = computeJoystickVector(3, 4, 50, 0.15);
  assert.equal(dead.magnitude, 0);

  const clamped = computeJoystickVector(120, 0, 50, 0.15);
  assert.equal(clamped.x, 1);
  assert.equal(clamped.y, 0);
  assert.equal(clamped.magnitude, 1);
});
