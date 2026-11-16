/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState } from 'react';
import { GameHud } from './components/GameHud';
import { GameOverModal, PauseModal } from './components/StatusModals';
import { TitleOverlay } from './components/TitleOverlay';
import { CryptoWhaleEngine } from './game/engine';
import { PLAYER_START_MASS, getTierForMass, massToMarketCap } from './game/rules';
import type { GamePhase, HudSnapshot, RunSummary, StarterCoinId } from './game/types';

function createInitialHud(skin: StarterCoinId): HudSnapshot {
  const tier = getTierForMass(PLAYER_START_MASS, skin);
  return {
    phase: 'title',
    marketCap: massToMarketCap(PLAYER_START_MASS),
    bestMarketCap: 0,
    coinsAbsorbed: 0,
    tier,
    nextTier: getTierForMass(60, 'PEPE'),
    tierProgress: 0,
    mass: PLAYER_START_MASS,
    canBoost: true,
    isBoosting: false,
    boostReservePct: 7,
    streakCount: 0,
    bullRunTimer: 0,
    leaderboard: [],
    playerRank: 1,
    totalEntities: 1,
    survivalSeconds: 0,
    liquidatedBy: null,
    radarPoints: [],
  };
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<CryptoWhaleEngine | null>(null);

  const [phase, setPhase] = useState<GamePhase>('title');
  const [starterSkin, setStarterSkin] = useState<StarterCoinId>('PEPE');
  const [isMuted, setIsMuted] = useState(false);
  const [hud, setHud] = useState<HudSnapshot>(() => createInitialHud('PEPE'));
  const [runSummary, setRunSummary] = useState<RunSummary | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    document.body.dataset.state = 'title';

    const engine = new CryptoWhaleEngine(canvas, {
      onPhaseChange: (nextPhase) => {
        setPhase(nextPhase);
      },
      onHudUpdate: (snapshot) => {
        setHud(snapshot);
      },
      onGameOver: (summary) => {
        setRunSummary(summary);
      },
    });

    engineRef.current = engine;
    engine.startLoop();

    // Support ?autostart=1 for automated & direct-play entry
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      engine.startNewGame('PEPE', false);
    }

    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  // Sync mute state if toggled via 'M' keyboard shortcut inside engine
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyM' && engineRef.current) {
        setIsMuted(engineRef.current.isMuted());
      }
      if (phase === 'gameover' && e.code === 'Enter') {
        e.preventDefault();
        engineRef.current?.startNewGame(starterSkin);
      }
    };
    window.addEventListener('keyup', handleKey);
    return () => window.removeEventListener('keyup', handleKey);
  }, [phase, starterSkin]);

  const handleSelectSkin = (skin: StarterCoinId) => {
    setStarterSkin(skin);
    engineRef.current?.setStarterSkin(skin);
  };

  const handleStart = () => {
    setRunSummary(null);
    engineRef.current?.startNewGame(starterSkin);
  };

  const handleToggleMute = () => {
    if (!engineRef.current) return;
    const muted = engineRef.current.toggleMute();
    setIsMuted(muted);
  };

  const handlePause = () => {
    engineRef.current?.pauseGame();
  };

  const handleResume = () => {
    engineRef.current?.resumeGame();
  };

  const handleReturnToTitle = () => {
    setRunSummary(null);
    engineRef.current?.returnToTitle();
  };

  const handleBoostHoldChange = (held: boolean) => {
    engineRef.current?.setExternalBoost(held);
  };

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#070A0F]">
      {/* Isolated Canvas Mount */}
      <div className="absolute inset-0">
        <canvas
          ref={canvasRef}
          data-testid="game-canvas"
          className="block w-full h-full cursor-crosshair"
        />
      </div>

      {/* Title Screen Overlay */}
      {phase === 'title' && (
        <TitleOverlay
          starterSkin={starterSkin}
          bestMarketCap={hud.bestMarketCap}
          isMuted={isMuted}
          onSelectSkin={handleSelectSkin}
          onStart={handleStart}
          onToggleMute={handleToggleMute}
        />
      )}

      {/* Active Gameplay HUD */}
      {phase === 'playing' && (
        <GameHud
          hud={hud}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
          onPause={handlePause}
          onBoostHoldChange={handleBoostHoldChange}
          onJoystickChange={(x, y) => engineRef.current?.setJoystickVector(x, y)}
        />
      )}

      {/* Pause Modal */}
      {phase === 'paused' && (
        <PauseModal
          onResume={handleResume}
          onRestart={handleStart}
          onTitle={handleReturnToTitle}
        />
      )}

      {/* Liquidated! Game Over Modal */}
      {phase === 'gameover' && runSummary && (
        <GameOverModal
          summary={runSummary}
          onPlayAgain={handleStart}
          onTitle={handleReturnToTitle}
        />
      )}
    </main>
  );
}
