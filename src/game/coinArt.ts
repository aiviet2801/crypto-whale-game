import type { CoinEntity, CoinTierId } from './types';
import { CAN_ABSORB_RATIO, formatMarketCap, massToMarketCap } from './rules';

export function drawCoinLogo(
  ctx: CanvasRenderingContext2D,
  tierId: CoinTierId,
  r: number,
  color: string,
): void {
  const s = r * 0.44;
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  switch (tierId) {
    case 'PEPE': {
      // Stylized frog silhouette: wide crown + two prominent eyes + calm smirk
      ctx.beginPath();
      ctx.ellipse(0, s * 0.14, s * 0.92, s * 0.62, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(34, 197, 94, 0.22)';
      ctx.fill();
      ctx.lineWidth = Math.max(1.5, s * 0.14);
      ctx.stroke();

      // Eye bumps
      ctx.fillStyle = '#070A0F';
      ctx.beginPath();
      ctx.arc(-s * 0.36, -s * 0.36, s * 0.26, 0, Math.PI * 2);
      ctx.arc(s * 0.36, -s * 0.36, s * 0.26, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#F8FAFC';
      ctx.beginPath();
      ctx.arc(-s * 0.36, -s * 0.36, s * 0.11, 0, Math.PI * 2);
      ctx.arc(s * 0.36, -s * 0.36, s * 0.11, 0, Math.PI * 2);
      ctx.fill();

      // Smirk line
      ctx.beginPath();
      ctx.moveTo(-s * 0.5, s * 0.25);
      ctx.quadraticCurveTo(0, s * 0.48, s * 0.5, s * 0.2);
      ctx.stroke();
      break;
    }

    case 'DOGE': {
      // Bold stylized Ð (Doge D with horizontal crossbar)
      ctx.lineWidth = Math.max(2, s * 0.24);
      ctx.beginPath();
      ctx.moveTo(-s * 0.35, -s * 0.65);
      ctx.lineTo(-s * 0.35, s * 0.65);
      ctx.moveTo(-s * 0.42, -s * 0.65);
      ctx.lineTo(s * 0.05, -s * 0.65);
      ctx.bezierCurveTo(s * 0.72, -s * 0.65, s * 0.72, s * 0.65, s * 0.05, s * 0.65);
      ctx.lineTo(-s * 0.42, s * 0.65);
      ctx.stroke();

      // Crossbar
      ctx.lineWidth = Math.max(1.8, s * 0.18);
      ctx.beginPath();
      ctx.moveTo(-s * 0.68, 0);
      ctx.lineTo(s * 0.22, 0);
      ctx.stroke();
      break;
    }

    case 'SHIB': {
      // Geometric Shiba Inu angular head + pointed ears
      ctx.lineWidth = Math.max(1.8, s * 0.16);
      ctx.beginPath();
      ctx.moveTo(-s * 0.68, -s * 0.75);
      ctx.lineTo(-s * 0.25, -s * 0.38);
      ctx.lineTo(s * 0.25, -s * 0.38);
      ctx.lineTo(s * 0.68, -s * 0.75);
      ctx.lineTo(s * 0.76, s * 0.1);
      ctx.lineTo(0, s * 0.75);
      ctx.lineTo(-s * 0.76, s * 0.1);
      ctx.closePath();
      ctx.fillStyle = 'rgba(249, 115, 22, 0.2)';
      ctx.fill();
      ctx.stroke();

      // Eyes + nose triangle
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(-s * 0.28, -s * 0.04, s * 0.11, 0, Math.PI * 2);
      ctx.arc(s * 0.28, -s * 0.04, s * 0.11, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-s * 0.14, s * 0.24);
      ctx.lineTo(s * 0.14, s * 0.24);
      ctx.lineTo(0, s * 0.44);
      ctx.closePath();
      ctx.fill();
      break;
    }

    case 'ADA': {
      // Cardano starburst constellation (center ring + 6 inner + 6 outer dots)
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.2, 0, Math.PI * 2);
      ctx.fill();
      for (let i = 0; i < 6; i++) {
        const a1 = (i * Math.PI) / 3;
        ctx.beginPath();
        ctx.arc(Math.cos(a1) * s * 0.5, Math.sin(a1) * s * 0.5, s * 0.11, 0, Math.PI * 2);
        ctx.fill();

        const a2 = a1 + Math.PI / 6;
        ctx.beginPath();
        ctx.arc(Math.cos(a2) * s * 0.82, Math.sin(a2) * s * 0.82, s * 0.075, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }

    case 'SOL': {
      // Three slanted parallel parallelogram bars
      const bars = [-0.46, 0, 0.46];
      for (let i = 0; i < bars.length; i++) {
        const yOff = bars[i] * s;
        const dir = i === 1 ? -1 : 1;
        ctx.beginPath();
        ctx.moveTo(-s * 0.62 + dir * s * 0.16, yOff - s * 0.14);
        ctx.lineTo(s * 0.72 + dir * s * 0.16, yOff - s * 0.14);
        ctx.lineTo(s * 0.62 - dir * s * 0.16, yOff + s * 0.14);
        ctx.lineTo(-s * 0.72 - dir * s * 0.16, yOff + s * 0.14);
        ctx.closePath();
        ctx.fill();
      }
      break;
    }

    case 'ETH': {
      // Crisp Ethereum faceted diamond octahedron
      ctx.lineWidth = Math.max(1.5, s * 0.1);
      // Top facets
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.88);
      ctx.lineTo(s * 0.54, s * 0.04);
      ctx.lineTo(0, s * 0.3);
      ctx.lineTo(-s * 0.54, s * 0.04);
      ctx.closePath();
      ctx.fillStyle = 'rgba(165, 180, 252, 0.26)';
      ctx.fill();
      ctx.stroke();

      // Center vertical ridge
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.88);
      ctx.lineTo(0, s * 0.3);
      ctx.stroke();

      // Bottom chevron
      ctx.beginPath();
      ctx.moveTo(-s * 0.54, s * 0.18);
      ctx.lineTo(0, s * 0.88);
      ctx.lineTo(s * 0.54, s * 0.18);
      ctx.lineTo(0, s * 0.44);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
      break;
    }

    case 'BTC': {
      // Bold Bitcoin double-barred ₿
      ctx.lineWidth = Math.max(2, s * 0.18);
      // Top & bottom stems
      ctx.beginPath();
      ctx.moveTo(-s * 0.18, -s * 0.82);
      ctx.lineTo(-s * 0.18, s * 0.82);
      ctx.moveTo(s * 0.16, -s * 0.82);
      ctx.lineTo(s * 0.16, -s * 0.56);
      ctx.moveTo(s * 0.16, s * 0.56);
      ctx.lineTo(s * 0.16, s * 0.82);
      ctx.stroke();

      // Spine + two B loops
      ctx.beginPath();
      ctx.moveTo(-s * 0.38, -s * 0.56);
      ctx.lineTo(s * 0.14, -s * 0.56);
      ctx.bezierCurveTo(s * 0.62, -s * 0.56, s * 0.62, -s * 0.02, s * 0.12, -s * 0.02);
      ctx.lineTo(-s * 0.36, -s * 0.02);
      ctx.moveTo(-s * 0.36, 0.02);
      ctx.lineTo(s * 0.2, 0.02);
      ctx.bezierCurveTo(s * 0.72, 0.02, s * 0.72, s * 0.58, s * 0.16, s * 0.58);
      ctx.lineTo(-s * 0.38, s * 0.58);
      ctx.moveTo(-s * 0.32, -s * 0.56);
      ctx.lineTo(-s * 0.32, s * 0.58);
      ctx.stroke();
      break;
    }
  }

  ctx.restore();
}

export function renderCoinEntity(
  ctx: CanvasRenderingContext2D,
  coin: CoinEntity,
  playerMass: number | null,
  time: number,
  showLabels: boolean,
): void {
  const r = coin.radius;
  const { tier } = coin;

  ctx.save();
  ctx.translate(coin.x, coin.y);
  ctx.scale(coin.squashX, coin.squashY);

  // Predator / Prey relational ring when player is active
  if (!coin.isPlayer && playerMass !== null) {
    if (coin.mass >= playerMass * CAN_ABSORB_RATIO) {
      // Larger predator danger indicator (crimson dashed ring + pulse if telegraphing)
      const isTelegraphing = coin.telegraphTimer > 0 || coin.lungeTimer > 0;
      ctx.save();
      ctx.rotate(time * (isTelegraphing ? 2.4 : 0.7));
      ctx.strokeStyle = isTelegraphing
        ? 'rgba(244, 63, 94, 0.92)'
        : 'rgba(244, 63, 94, 0.42)';
      ctx.lineWidth = isTelegraphing ? 3.5 : 2;
      ctx.setLineDash([10, 8]);
      ctx.beginPath();
      ctx.arc(0, 0, r + (isTelegraphing ? 12 : 8), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    } else if (playerMass >= coin.mass * CAN_ABSORB_RATIO) {
      // Strictly smaller edible coin indicator
      ctx.save();
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.38)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(0, 0, r + 5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  // Player cyan directional halo & boost aura
  if (coin.isPlayer) {
    ctx.save();
    ctx.strokeStyle = coin.isBoosting
      ? 'rgba(34, 211, 238, 0.92)'
      : 'rgba(34, 211, 238, 0.45)';
    ctx.lineWidth = coin.isBoosting ? 3.5 : 2;
    ctx.beginPath();
    ctx.arc(0, 0, r + (coin.isBoosting ? 9 : 6), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Fast layered outer neon glow (zero shadowBlur overhead)
  ctx.beginPath();
  ctx.arc(0, 0, r + (coin.isBoosting ? 7 : 5), 0, Math.PI * 2);
  ctx.fillStyle = coin.isBoosting ? 'rgba(34, 211, 238, 0.14)' : tier.glowColor.replace(/[\d.]+\)$/, '0.14)');
  ctx.fill();

  // Coin body background
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = tier.bgColor;
  ctx.fill();

  // Crisp neon border
  ctx.lineWidth = Math.max(2.5, Math.min(5.5, r * 0.08));
  ctx.strokeStyle = coin.isBoosting ? '#22D3EE' : tier.color;
  ctx.stroke();

  // Inner concentric minted ring
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.84, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
  ctx.lineWidth = 1.25;
  ctx.stroke();

  // Custom vector logo
  ctx.save();
  ctx.translate(0, -r * 0.08);
  drawCoinLogo(ctx, tier.id, r, tier.textColor);
  ctx.restore();

  // Hit flash overlay (40-60ms impact feedback)
  if (coin.hitFlash > 0) {
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(0.65, coin.hitFlash * 8)})`;
    ctx.fill();
  }

  // Ticker + Market Cap label inside or below coin
  if (showLabels) {
    const capText = formatMarketCap(massToMarketCap(coin.mass));
    const fontSize = Math.max(10, Math.min(18, Math.round(r * 0.28)));
    ctx.font = `700 ${fontSize}px "Outfit", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Ticker inside lower rim
    ctx.fillStyle = 'rgba(7, 10, 15, 0.78)';
    ctx.strokeStyle = 'rgba(7, 10, 15, 0.9)';
    ctx.lineWidth = 3;
    ctx.strokeText(coin.isPlayer ? `${tier.symbol} · YOU` : coin.name, 0, r * 0.56);
    ctx.fillStyle = '#F8FAFC';
    ctx.fillText(coin.isPlayer ? `${tier.symbol} · YOU` : coin.name, 0, r * 0.56);

    // Market cap above coin
    const capSize = Math.max(10, Math.min(14, Math.round(r * 0.22)));
    ctx.font = `700 ${capSize}px "JetBrains Mono", monospace`;
    ctx.strokeText(capText, 0, -r - 12);
    ctx.fillStyle = tier.textColor;
    ctx.fillText(capText, 0, -r - 12);
  }

  ctx.restore();
}
