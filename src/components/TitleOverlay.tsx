import { Volume2, VolumeX } from 'lucide-react';
import { formatMarketCap } from '../game/rules';
import type { StarterCoinId } from '../game/types';
import { CoinBadgeSvg, CryptoWhaleTitleSvg } from './CoinBadgeSvg';

interface TitleOverlayProps {
  starterSkin: StarterCoinId;
  bestMarketCap: number;
  isMuted: boolean;
  onSelectSkin: (skin: StarterCoinId) => void;
  onStart: () => void;
  onToggleMute: () => void;
}

export function TitleOverlay({
  starterSkin,
  bestMarketCap,
  isMuted,
  onSelectSkin,
  onStart,
  onToggleMute,
}: TitleOverlayProps) {
  return (
    <div className="fixed inset-0 z-20 flex flex-col justify-between pointer-events-none">
      {/* Asymmetric calm radial scrim leaving right/live arena visible */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(circle at 24% 48%, rgba(7, 10, 15, 0.88) 0%, rgba(7, 10, 15, 0.62) 45%, rgba(7, 10, 15, 0.25) 100%)',
        }}
      />

      {/* Top safe margin with single mute utility button */}
      <div className="relative z-10 flex items-center justify-end p-5 sm:p-8">
        <button
          type="button"
          onClick={(e) => {
            e.currentTarget.blur();
            onToggleMute();
          }}
          aria-label={isMuted ? 'Unmute audio' : 'Mute audio'}
          className="pointer-events-auto flex items-center justify-center w-11 h-11 rounded-lg bg-[#0B101A]/90 border border-slate-700/60 text-slate-200 hover:border-cyan-400/70 hover:text-cyan-300 transition-colors focus-visible:outline-2 focus-visible:outline-cyan-400"
        >
          {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
        </button>
      </div>

      {/* Main Focal Region (Left-aligned over calm negative space) */}
      <div className="relative z-10 px-6 sm:px-14 lg:px-20 max-w-xl pointer-events-auto">
        <CryptoWhaleTitleSvg />

        <p className="mt-4 text-base sm:text-lg text-slate-300 leading-relaxed max-w-md">
          Absorb satoshi nodes and smaller tokens to evolve into a Bitcoin whale. Avoid larger predators or risk instant liquidation.
        </p>

        {/* Starter coin selection */}
        <div className="mt-7">
          <div className="text-xs font-medium tracking-wider uppercase text-slate-400 mb-2.5">
            Starter Token
          </div>
          <div className="inline-flex items-center gap-2 p-1.5 rounded-lg bg-[#0B101A]/95 border border-slate-800">
            <button
              type="button"
              onClick={() => onSelectSkin('PEPE')}
              className={`flex items-center gap-2.5 px-4 py-2 rounded-md text-sm font-semibold transition-colors whitespace-nowrap shrink-0 min-h-[44px] ${
                starterSkin === 'PEPE'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/60'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              <CoinBadgeSvg tierId="PEPE" size={22} />
              <span>PEPE</span>
            </button>
            <button
              type="button"
              onClick={() => onSelectSkin('DOGE')}
              className={`flex items-center gap-2.5 px-4 py-2 rounded-md text-sm font-semibold transition-colors whitespace-nowrap shrink-0 min-h-[44px] ${
                starterSkin === 'DOGE'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/60'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              <CoinBadgeSvg tierId="DOGE" size={22} />
              <span>DOGE</span>
            </button>
          </div>
        </div>

        {/* Primary Start CTA + Optional Best Record */}
        <div className="mt-7 flex flex-wrap items-center gap-5">
          <button
            type="button"
            data-start="true"
            onClick={(e) => {
              e.currentTarget.blur();
              onStart();
            }}
            className="px-8 py-3.5 rounded-lg bg-cyan-400 hover:bg-cyan-300 active:scale-[0.98] text-[#070A0F] font-display font-bold text-base tracking-wide transition-all cursor-pointer whitespace-nowrap shrink-0 min-h-[48px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
          >
            Enter Arena
          </button>

          {bestMarketCap > 0 && (
            <div className="text-sm text-slate-400">
              Best Market Cap{' '}
              <span className="font-mono-num font-bold text-amber-300 ml-1">
                {formatMarketCap(bestMarketCap)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Bottom flat borderless control hint */}
      <div className="relative z-10 px-6 sm:px-14 lg:px-20 pb-6 pt-4">
        <p className="text-xs sm:text-sm text-slate-400 font-medium tracking-wide">
          Mouse or Touch Steer · Hold Space or Click for Leverage Boost · Esc Pause
        </p>
      </div>
    </div>
  );
}
