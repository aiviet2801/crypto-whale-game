import { formatMarketCap } from '../game/rules';
import type { RunSummary } from '../game/types';
import { CoinBadgeSvg } from './CoinBadgeSvg';

interface PauseModalProps {
  onResume: () => void;
  onRestart: () => void;
  onTitle: () => void;
}

export function PauseModal({ onResume, onRestart, onTitle }: PauseModalProps) {
  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-[#070A0F]/80"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pause-title"
    >
      <div className="w-full max-w-sm rounded-xl border border-slate-700/70 bg-[#0B101A] p-7 text-center shadow-2xl">
        <h2
          id="pause-title"
          className="font-display text-2xl font-bold text-slate-50 tracking-tight"
        >
          Market Paused
        </h2>
        <p className="mt-1.5 text-sm text-slate-400">
          Position frozen. Resume to continue hunting liquidity.
        </p>

        <div className="mt-6 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={onResume}
            className="w-full py-3 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-[#070A0F] font-display font-bold text-sm tracking-wide transition-colors cursor-pointer min-h-[44px]"
          >
            Resume
          </button>
          <button
            type="button"
            onClick={onRestart}
            className="w-full py-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold text-sm transition-colors cursor-pointer min-h-[44px]"
          >
            Restart Run
          </button>
          <button
            type="button"
            onClick={onTitle}
            className="w-full py-2.5 rounded-lg text-slate-400 hover:text-slate-200 font-medium text-sm transition-colors cursor-pointer min-h-[44px]"
          >
            Return to Title
          </button>
        </div>
      </div>
    </div>
  );
}

interface GameOverModalProps {
  summary: RunSummary;
  onPlayAgain: () => void;
  onTitle: () => void;
}

export function GameOverModal({ summary, onPlayAgain, onTitle }: GameOverModalProps) {
  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-[#070A0F]/82"
      role="dialog"
      aria-modal="true"
      aria-labelledby="gameover-title"
    >
      <div className="w-full max-w-md rounded-xl border border-rose-500/40 bg-[#0B101A] p-7 shadow-2xl">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-rose-400">
              Margin Call
            </div>
            <h2
              id="gameover-title"
              className="font-display text-3xl font-extrabold text-slate-50 tracking-tight mt-0.5"
            >
              Liquidated! Game Over
            </h2>
          </div>
          <CoinBadgeSvg tierId={summary.peakTier.id} size={44} />
        </div>

        <p className="mt-2 text-sm text-slate-400">
          Absorbed by <span className="text-slate-200 font-medium">{summary.liquidatedBy}</span> after{' '}
          <span className="font-mono-num text-slate-200">{summary.survivalSeconds}s</span>.
        </p>

        {/* Stat Tiles */}
        <div className="mt-6 grid grid-cols-2 gap-3">
          <div className="p-3.5 rounded-lg bg-[#111827] border border-slate-800">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Final Market Cap
            </div>
            <div
              data-testid="gameover-market-cap"
              className="font-mono-num text-2xl font-bold text-cyan-300 mt-1"
            >
              {formatMarketCap(summary.finalMarketCap)}
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-[#111827] border border-slate-800">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Coins Absorbed
            </div>
            <div
              data-testid="gameover-absorbed"
              className="font-mono-num text-2xl font-bold text-emerald-400 mt-1"
            >
              {summary.coinsAbsorbed}
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-[#111827] border border-slate-800">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Peak Tier
            </div>
            <div className="font-display text-lg font-bold text-slate-100 mt-1">
              {summary.peakTier.name}
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-[#111827] border border-slate-800">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Best Market Cap
            </div>
            <div className="font-mono-num text-lg font-bold text-amber-300 mt-1">
              {formatMarketCap(summary.bestMarketCap)}
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <button
            type="button"
            data-start="true"
            onClick={(e) => {
              e.currentTarget.blur();
              onPlayAgain();
            }}
            className="flex-1 py-3 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-[#070A0F] font-display font-bold text-sm tracking-wide transition-colors cursor-pointer min-h-[46px]"
          >
            Play Again
          </button>
          <button
            type="button"
            onClick={onTitle}
            className="px-5 py-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm transition-colors cursor-pointer min-h-[46px]"
          >
            Title
          </button>
        </div>
      </div>
    </div>
  );
}
