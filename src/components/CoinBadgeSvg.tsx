import type { CoinTierId } from '../game/types';
import { COIN_TIERS } from '../game/rules';

interface CoinBadgeSvgProps {
  tierId: CoinTierId;
  size?: number;
}

export function CoinBadgeSvg({ tierId, size = 28 }: CoinBadgeSvgProps) {
  const tier = COIN_TIERS.find((t) => t.id === tierId) ?? COIN_TIERS[0];

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className="shrink-0"
    >
      <circle cx="16" cy="16" r="14" fill={tier.bgColor} stroke={tier.color} strokeWidth="2.2" />
      <circle cx="16" cy="16" r="11.2" stroke="rgba(255,255,255,0.16)" strokeWidth="1" />

      {tierId === 'PEPE' && (
        <g stroke={tier.textColor} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <ellipse cx="16" cy="17.5" rx="7.2" ry="4.8" fill="rgba(34,197,94,0.22)" />
          <circle cx="13.2" cy="13.5" r="2.1" fill="#070A0F" />
          <circle cx="18.8" cy="13.5" r="2.1" fill="#070A0F" />
          <circle cx="13.2" cy="13.5" r="0.8" fill="#F8FAFC" stroke="none" />
          <circle cx="18.8" cy="13.5" r="0.8" fill="#F8FAFC" stroke="none" />
          <path d="M12.2 18.6 Q16 20.5 19.8 18.2" />
        </g>
      )}

      {tierId === 'DOGE' && (
        <g stroke={tier.textColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12.5 10.5V21.5M12 10.5H16.2C20.5 10.5 20.5 21.5 16.2 21.5H12" />
          <path d="M10 16H17.5" strokeWidth="1.7" />
        </g>
      )}

      {tierId === 'SHIB' && (
        <g stroke={tier.textColor} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path
            d="M10.5 10L14 13H18L21.5 10L22.2 17L16 22.2L9.8 17L10.5 10Z"
            fill="rgba(249,115,22,0.2)"
          />
          <circle cx="13.6" cy="15.8" r="0.9" fill={tier.textColor} stroke="none" />
          <circle cx="18.4" cy="15.8" r="0.9" fill={tier.textColor} stroke="none" />
          <polygon points="14.8,18 17.2,18 16,19.8" fill={tier.textColor} stroke="none" />
        </g>
      )}

      {tierId === 'ADA' && (
        <g fill={tier.textColor}>
          <circle cx="16" cy="16" r="1.8" />
          {[0, 60, 120, 180, 240, 300].map((deg) => {
            const rad = (deg * Math.PI) / 180;
            const x = 16 + Math.cos(rad) * 4.6;
            const y = 16 + Math.sin(rad) * 4.6;
            const rad2 = ((deg + 30) * Math.PI) / 180;
            const x2 = 16 + Math.cos(rad2) * 7.4;
            const y2 = 16 + Math.sin(rad2) * 7.4;
            return (
              <g key={deg}>
                <circle cx={x} cy={y} r="1" />
                <circle cx={x2} cy={y2} r="0.7" />
              </g>
            );
          })}
        </g>
      )}

      {tierId === 'SOL' && (
        <g fill={tier.textColor}>
          <polygon points="10.8,10.5 22.2,10.5 20.6,12.8 9.2,12.8" />
          <polygon points="9.2,14.8 20.6,14.8 22.2,17.2 10.8,17.2" />
          <polygon points="10.8,19.2 22.2,19.2 20.6,21.5 9.2,21.5" />
        </g>
      )}

      {tierId === 'ETH' && (
        <g stroke={tier.textColor} strokeWidth="1.2" strokeLinejoin="round">
          <polygon points="16,8.2 20.8,16 16,18.5 11.2,16" fill="rgba(165,180,252,0.28)" />
          <line x1="16" y1="8.2" x2="16" y2="18.5" />
          <polygon points="11.2,17.5 16,23.8 20.8,17.5 16,20" fill={tier.textColor} stroke="none" />
        </g>
      )}

      {tierId === 'BTC' && (
        <g stroke={tier.textColor} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <line x1="14.2" y1="8.8" x2="14.2" y2="23.2" />
          <line x1="17.2" y1="8.8" x2="17.2" y2="11" />
          <line x1="17.2" y1="21" x2="17.2" y2="23.2" />
          <path d="M12.2 11H16.8C20.5 11 20.5 15.8 16.5 15.8H12.4M12.4 16H17.2C21.2 16 21.2 21 16.8 21H12.2" />
        </g>
      )}
    </svg>
  );
}

export function CryptoWhaleTitleSvg() {
  return (
    <svg
      viewBox="0 0 460 112"
      className="w-full max-w-[440px] h-auto"
      role="img"
      aria-label="Crypto Whale"
    >
      {/* Bespoke geometric whale-coin crest */}
      <g transform="translate(8, 12)">
        <circle cx="44" cy="44" r="40" fill="#0B1320" stroke="#22D3EE" strokeWidth="2.5" />
        <circle cx="44" cy="44" r="33" stroke="rgba(245, 158, 11, 0.45)" strokeWidth="1.25" strokeDasharray="4 4" />
        {/* Whale tail fluke rising inside coin crest */}
        <path
          d="M44 64C44 50 41 42 29 33C24 29 20 29 19 32C22 39 29 45 36 47C30 51 24 56 22 61C29 63 37 61 44 64Z"
          fill="#22D3EE"
        />
        <path
          d="M44 64C44 50 47 42 59 33C64 29 68 29 69 32C66 39 59 45 52 47C58 51 64 56 66 61C59 63 51 61 44 64Z"
          fill="#F59E0B"
        />
        <circle cx="44" cy="24" r="4.5" fill="#F8FAFC" />
      </g>

      {/* Lockup Typography */}
      <text
        x="110"
        y="50"
        fill="#F8FAFC"
        fontFamily="Outfit, sans-serif"
        fontWeight="800"
        fontSize="42"
        letterSpacing="-0.02em"
      >
        CRYPTO
      </text>
      <text
        x="110"
        y="92"
        fill="#22D3EE"
        fontFamily="Outfit, sans-serif"
        fontWeight="800"
        fontSize="44"
        letterSpacing="0.02em"
      >
        WHALE
      </text>
    </svg>
  );
}
