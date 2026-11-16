import { useRef, useState } from 'react';
import { computeJoystickVector } from '../game/rules';

interface VirtualJoystickProps {
  onChange: (x: number, y: number) => void;
}

const PAD_RADIUS = 56;
const MAX_TRAVEL = 38;

export function VirtualJoystick({ onChange }: VirtualJoystickProps) {
  const padRef = useRef<HTMLDivElement | null>(null);
  const activePointerIdRef = useRef<number | null>(null);
  const [knobPos, setKnobPos] = useState({ x: 0, y: 0 });
  const [active, setActive] = useState(false);

  const updateFromClient = (clientX: number, clientY: number) => {
    const el = padRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = clientX - cx;
    const dy = clientY - cy;

    const dist = Math.hypot(dx, dy);
    const clampedDist = Math.min(MAX_TRAVEL, dist);
    const angle = Math.atan2(dy, dx);
    setKnobPos({
      x: dist > 0.5 ? Math.cos(angle) * clampedDist : 0,
      y: dist > 0.5 ? Math.sin(angle) * clampedDist : 0,
    });

    const vec = computeJoystickVector(dx, dy, MAX_TRAVEL);
    onChange(vec.x, vec.y);
  };

  const resetStick = () => {
    activePointerIdRef.current = null;
    setActive(false);
    setKnobPos({ x: 0, y: 0 });
    onChange(0, 0);
  };

  return (
    <div
      ref={padRef}
      data-testid="virtual-joystick"
      role="application"
      aria-label="Movement joystick"
      onPointerDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        activePointerIdRef.current = e.pointerId;
        e.currentTarget.setPointerCapture(e.pointerId);
        setActive(true);
        updateFromClient(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => {
        if (activePointerIdRef.current !== e.pointerId) return;
        e.preventDefault();
        updateFromClient(e.clientX, e.clientY);
      }}
      onPointerUp={(e) => {
        if (activePointerIdRef.current !== e.pointerId) return;
        e.preventDefault();
        resetStick();
      }}
      onPointerCancel={(e) => {
        if (activePointerIdRef.current !== e.pointerId) return;
        resetStick();
      }}
      className={`pointer-events-auto relative flex items-center justify-center rounded-full border transition-colors touch-none select-none ${
        active
          ? 'bg-cyan-500/15 border-cyan-400/80'
          : 'bg-[#0B101A]/85 border-slate-700/70'
      }`}
      style={{
        width: PAD_RADIUS * 2,
        height: PAD_RADIUS * 2,
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
      }}
    >
      {/* Crosshair guides */}
      <div className="absolute inset-4 rounded-full border border-slate-700/40 pointer-events-none" />
      <div className="absolute w-2 h-2 rounded-full bg-slate-600/70 pointer-events-none" />

      {/* Draggable thumb knob */}
      <div
        className={`w-11 h-11 rounded-full border pointer-events-none transition-colors ${
          active
            ? 'bg-cyan-400/90 border-cyan-200'
            : 'bg-slate-700/90 border-cyan-400/60'
        }`}
        style={{
          transform: `translate3d(${knobPos.x}px, ${knobPos.y}px, 0)`,
          boxShadow: active ? '0 0 18px rgba(34, 211, 238, 0.55)' : 'none',
        }}
      />
    </div>
  );
}
