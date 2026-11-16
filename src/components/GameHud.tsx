import { Pause, Volume2, VolumeX, Zap } from 'lucide-react';
import { BULL_RUN_DURATION, BULL_RUN_STREAK_TARGET, formatMarketCap } from '../game/rules';
import type { HudSnapshot } from '../game/types';
import { CoinBadgeSvg } from './CoinBadgeSvg';
import { VirtualJoystick } from './VirtualJoystick';

interface GameHudProps {
  hud: HudSnapshot;
  isMuted: boolean;
  onToggleMute: () => void;
  onPause: () => void;
  onBoostHoldChange: (held: boolean) => void;
  onJoystickChange: (x: number, y: number) => void;
}

export function GameHud({
  hud,
  isMuted,
  onToggleMute,
  onPause,
  onBoostHoldChange,
  onJoystickChange,
}: GameHudProps) {
  const isBullRun = hud.bullRunTimer > 0;
  const bullRunPct = Math.max(0, Math.min(1, hud.bullRunTimer / BULL_RUN_DURATION));
  const isCoarsePointer =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(pointer: coarse)').matches;

  return (
    <div className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between p-3.5 sm:p-5">
      {/* Top Row: Left Vitals & Right Leaderboard + Utility Controls */}
      <div className="flex items-start justify-between gap-3">
        {/* Cluster 1: Top-Left Player Market Cap, Tier Evolution & Bull Run Streak */}
        <div
          className={`px-3.5 py-2.5 sm:px-4 sm:py-3 rounded-lg border bg-[#0B101A]/88 min-w-[196px] sm:min-w-[248px] transition-colors ${
            isBullRun ? 'border-cyan-400/80' : 'border-slate-700/50'
          }`}
          style={{ boxShadow: '0 8px 24px rgba(0, 0, 0, 0.45)' }}
        >
          <div className="flex items-center gap-3">
            <CoinBadgeSvg tierId={hud.tier.id} size={32} />
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 leading-none">
                {hud.tier.name} · #{hud.playerRank}
              </div>
              <div
                data-testid="hud-market-cap"
                className="font-mono-num text-xl sm:text-3xl font-bold text-slate-50 leading-tight mt-0.5"
              >
                {formatMarketCap(hud.marketCap)}
              </div>
            </div>
          </div>

          {/* Evolution Progress */}
          <div className="mt-2">
            <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
              <span>{hud.nextTier ? `Next: ${hud.nextTier.symbol}` : 'Apex Whale'}</span>
              <span className="font-mono-num text-slate-300">{hud.coinsAbsorbed} Absorbed</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full rounded-full transition-transform duration-150 origin-left"
                style={{
                  width: '100%',
                  transform: `scaleX(${Math.max(0.04, hud.tierProgress)})`,
                  backgroundColor: hud.tier.color,
                }}
              />
            </div>
          </div>

          {/* Bull Run Streak Pips or Active Countdown */}
          <div className="mt-2.5 pt-2 border-t border-slate-800/90">
            {isBullRun ? (
              <div>
                <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-cyan-300">
                  <span data-testid="bull-run-badge">Bull Run · 2x Magnet</span>
                  <span className="font-mono-num">{hud.bullRunTimer.toFixed(1)}s</span>
                </div>
                <div className="mt-1 h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-cyan-400 origin-left"
                    style={{
                      width: '100%',
                      transform: `scaleX(${bullRunPct})`,
                    }}
                  />
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Bull Streak
                </span>
                <div className="flex items-center gap-1" data-testid="streak-pips">
                  {Array.from({ length: BULL_RUN_STREAK_TARGET }).map((_, idx) => (
                    <span
                      key={idx}
                      className={`w-3.5 h-1.5 rounded-sm transition-colors ${
                        idx < hud.streakCount ? 'bg-emerald-400' : 'bg-slate-800'
                      }`}
                    />
                  ))}
                  <span className="font-mono-num text-[11px] text-slate-300 ml-1">
                    {hud.streakCount}/{BULL_RUN_STREAK_TARGET}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Cluster 2: Top-Right Mini Leaderboard + Square Utility Buttons */}
        <div className="flex items-start gap-2.5">
          <div
            className="hidden md:block px-3.5 py-2.5 rounded-lg border border-slate-700/50 bg-[#0B101A]/88 w-[216px]"
            style={{ boxShadow: '0 8px 24px rgba(0, 0, 0, 0.45)' }}
            aria-label="Live Leaderboard"
          >
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Top Whales
            </div>
            <div className="space-y-1">
              {hud.leaderboard.map((entry) => (
                <div
                  key={entry.id}
                  className={`flex items-center justify-between gap-2 text-xs px-1.5 py-0.5 rounded ${
                    entry.isPlayer
                      ? 'bg-cyan-400/15 text-cyan-300 font-semibold'
                      : 'text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-mono-num text-slate-500 w-3.5 text-right">
                      {entry.rank}
                    </span>
                    <span className="truncate">{entry.name}</span>
                  </div>
                  <span className="font-mono-num shrink-0 text-[11px]">
                    {formatMarketCap(entry.marketCap)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 pointer-events-auto">
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                onToggleMute();
              }}
              aria-label={isMuted ? 'Unmute audio (M)' : 'Mute audio (M)'}
              title={isMuted ? 'Unmute (M)' : 'Mute (M)'}
              className="flex items-center justify-center w-10 h-10 rounded-lg bg-[#0B101A]/90 border border-slate-700/60 text-slate-200 hover:border-cyan-400/70 hover:text-cyan-300 transition-colors cursor-pointer"
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                onPause();
              }}
              aria-label="Pause game (P)"
              title="Pause (P)"
              className="flex items-center justify-center w-10 h-10 rounded-lg bg-[#0B101A]/90 border border-slate-700/60 text-slate-200 hover:border-cyan-400/70 hover:text-cyan-300 transition-colors cursor-pointer"
            >
              <Pause className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Row: Desktop Radar + Boost OR Mobile Virtual Joystick + Thumb Boost */}
      <div className="flex items-end justify-between gap-4">
        {/* Desktop Bottom-Left Radar + Leverage Boost */}
        <div className={`${isCoarsePointer ? 'hidden' : 'hidden md:flex'} items-end gap-3`}>
          <div
            className="relative w-24 h-24 rounded-lg border border-slate-700/50 bg-[#0B101A]/88 overflow-hidden"
            aria-hidden="true"
          >
            <div className="absolute inset-0 opacity-20 border border-cyan-500/30 m-2" />
            {hud.radarPoints.map((pt, idx) => (
              <span
                key={idx}
                className="absolute rounded-full"
                style={{
                  left: `${Math.max(4, Math.min(96, pt.xNorm * 100))}%`,
                  top: `${Math.max(4, Math.min(96, pt.yNorm * 100))}%`,
                  width: pt.isPlayer ? 7 : pt.isWhale ? 5 : 3,
                  height: pt.isPlayer ? 7 : pt.isWhale ? 5 : 3,
                  transform: 'translate(-50%, -50%)',
                  backgroundColor: pt.isPlayer
                    ? '#22D3EE'
                    : pt.isWhale
                      ? '#F59E0B'
                      : pt.isThreat
                        ? '#F43F5E'
                        : pt.isEdible
                          ? '#10B981'
                          : '#64748B',
                }}
              />
            ))}
          </div>

          <button
            type="button"
            tabIndex={-1}
            onMouseDown={() => onBoostHoldChange(true)}
            onMouseUp={() => onBoostHoldChange(false)}
            onMouseLeave={() => onBoostHoldChange(false)}
            aria-label="Hold for Leverage Boost"
            className={`pointer-events-auto flex items-center gap-3 px-3.5 py-2.5 rounded-lg border transition-colors cursor-pointer min-h-[44px] ${
              hud.isBoosting
                ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
                : hud.canBoost
                  ? 'bg-[#0B101A]/88 border-slate-700/60 text-slate-200 hover:border-cyan-400/60'
                  : 'bg-[#0B101A]/75 border-slate-800 text-slate-500'
            }`}
          >
            <Zap
              className={`w-4 h-4 shrink-0 ${
                hud.isBoosting ? 'text-cyan-300' : hud.canBoost ? 'text-cyan-400' : 'text-slate-600'
              }`}
            />
            <div className="text-left">
              <div className="flex items-center justify-between gap-3 text-[11px] font-semibold uppercase tracking-wider">
                <span>Leverage Boost</span>
                <span className="font-mono-num">
                  {hud.canBoost ? `${hud.boostReservePct}%` : 'Low Mass'}
                </span>
              </div>
              <div className="mt-1 h-1.5 w-32 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full rounded-full transition-transform duration-100 origin-left"
                  style={{
                    width: '100%',
                    transform: `scaleX(${Math.max(0, Math.min(1, hud.boostReservePct / 100))})`,
                    backgroundColor: hud.isBoosting ? '#22D3EE' : '#38BDF8',
                  }}
                />
              </div>
            </div>
          </button>
        </div>

        {/* Mobile Bottom-Left Virtual Joystick */}
        <div className={isCoarsePointer ? 'block' : 'md:hidden'}>
          <VirtualJoystick onChange={onJoystickChange} />
        </div>

        {/* Mobile Bottom-Right Thumb Boost Button */}
        <div className={`${isCoarsePointer ? 'flex' : 'md:hidden flex'} flex-col items-end gap-2`}>
          <div className="px-2.5 py-1 rounded border border-slate-700/50 bg-[#0B101A]/88 text-[11px] text-slate-300 font-mono-num">
            Rank #{hud.playerRank}/{hud.totalEntities}
          </div>
          <button
            type="button"
            tabIndex={-1}
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onBoostHoldChange(true);
            }}
            onPointerUp={() => onBoostHoldChange(false)}
            onPointerCancel={() => onBoostHoldChange(false)}
            onPointerLeave={() => onBoostHoldChange(false)}
            aria-label="Hold for Leverage Boost"
            className={`pointer-events-auto flex items-center justify-center gap-2 w-24 h-14 rounded-xl border font-display font-bold text-sm transition-colors touch-none ${
              hud.isBoosting
                ? 'bg-cyan-500/25 border-cyan-300 text-cyan-100'
                : hud.canBoost
                  ? 'bg-[#0B101A]/90 border-cyan-500/60 text-cyan-300'
                  : 'bg-[#0B101A]/75 border-slate-800 text-slate-500'
            }`}
          >
            <Zap className="w-4 h-4 shrink-0" />
            <span>Boost</span>
          </button>
        </div>
      </div>
    </div>
  );
}
