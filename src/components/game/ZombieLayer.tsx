import { useEffect } from "react";
import { useGame } from "@/game/store";
import { useView } from "@/game/viewStore";
import { useZombies } from "@/game/zombies";

const TILE = 28;

/** Drives the zombie simulation each frame. Renders nothing. */
export function ZombieLoop() {
  const screen = useGame((s) => s.screen);
  const tick = useZombies((s) => s.tick);
  const reset = useZombies((s) => s.reset);

  useEffect(() => {
    if (screen !== "game") { reset(); return; }
    let last = performance.now();
    let raf = 0;
    const loop = (now: number) => {
      const dt = Math.min(120, now - last);
      last = now;
      const st = useGame.getState();
      tick(dt, {
        mapW: st.mapW,
        mapH: st.mapH,
        territory: st.territory,
        speed: st.speed,
        screen: st.screen,
      });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [screen, tick, reset]);

  return null;
}

/** SVG layer rendered inside MapView (after survivors). */
export function ZombieLayer() {
  const zombies = useZombies((s) => s.zombies);
  const zoom = useView((s) => s.mapZoom);
  // At low zoom they are tiny dots; at high zoom you can recognize them.
  const detail = zoom > 0.85;
  // Fade slightly when very zoomed out so they read as distant motion.
  const opacity = Math.min(1, 0.55 + zoom * 0.45);

  return (
    <g pointerEvents="none" opacity={opacity}>
      {zombies.map((z) => {
        const cx = z.x * TILE + TILE / 2;
        const cy = z.y * TILE + TILE / 2;
        const bob = Math.sin((z.x + z.y) * 1.7 + z.seed) * 1.2;
        return (
          <g key={z.id} transform={`translate(${cx}, ${cy + bob})`}>
            {detail ? <ZombieDetailed /> : <ZombieDot />}
          </g>
        );
      })}
    </g>
  );
}

function ZombieDot() {
  return (
    <>
      <ellipse cx={0} cy={6} rx={6} ry={2} fill="rgba(0,0,0,0.5)" />
      <circle cx={0} cy={0} r={4.5} fill="#3a4a32" stroke="#1a1208" strokeWidth={1} />
      <circle cx={0} cy={-1.5} r={2.2} fill="#8a9078" stroke="#1a1208" strokeWidth={0.8} />
    </>
  );
}

function ZombieDetailed() {
  // Hand-drawn, sized to roughly match a survivor figure.
  return (
    <g>
      {/* shadow */}
      <ellipse cx={0} cy={10} rx={7} ry={2.2} fill="rgba(0,0,0,0.5)" />
      {/* tattered body */}
      <path d="M-5,9 L-6,-4 L-2.5,-6 L2.5,-6 L6,-4 L5,9 Z"
        fill="#4a5a3e" stroke="#1a1208" strokeWidth={0.9} />
      {/* torn shirt lines */}
      <line x1={-3} y1={0} x2={3} y2={2} stroke="#1a1208" strokeWidth={0.5} opacity={0.6} />
      <line x1={-2} y1={4} x2={3.5} y2={5} stroke="#1a1208" strokeWidth={0.5} opacity={0.6} />
      {/* arms hanging forward */}
      <line x1={-5.5} y1={-2} x2={-7.5} y2={6} stroke="#1a1208" strokeWidth={1.1} strokeLinecap="round" />
      <line x1={5.5} y1={-2} x2={7.5} y2={6} stroke="#1a1208" strokeWidth={1.1} strokeLinecap="round" />
      <circle cx={-7.5} cy={6.2} r={1.3} fill="#7a8a6a" stroke="#1a1208" strokeWidth={0.6} />
      <circle cx={7.5} cy={6.2} r={1.3} fill="#7a8a6a" stroke="#1a1208" strokeWidth={0.6} />
      {/* head — slack jaw, pale */}
      <circle cx={0} cy={-9} r={3.6} fill="#8a9078" stroke="#1a1208" strokeWidth={0.9} />
      {/* eye sockets */}
      <circle cx={-1.3} cy={-9.2} r={0.7} fill="#1a1208" />
      <circle cx={1.3} cy={-9.2} r={0.7} fill="#1a1208" />
      {/* slack mouth */}
      <rect x={-1.2} y={-7.4} width={2.4} height={0.9} fill="#1a1208" />
      {/* blood drip */}
      <line x1={0.6} y1={-6.4} x2={0.9} y2={-5} stroke="#7a1a14" strokeWidth={0.6} strokeLinecap="round" />
    </g>
  );
}
