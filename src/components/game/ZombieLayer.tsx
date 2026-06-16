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
        // Subtle shamble: tiny vertical bob driven by position so it looks alive.
        const bob = Math.sin((z.x + z.y) * 1.7 + z.seed) * 0.6;
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
      <ellipse cx={0} cy={2} rx={2.4} ry={0.8} fill="rgba(0,0,0,0.4)" />
      <circle cx={0} cy={0} r={1.6} fill="#3a4a32" stroke="#1a1208" strokeWidth={0.4} />
    </>
  );
}

function ZombieDetailed() {
  // Hand-drawn matching the map's painted style.
  return (
    <g>
      {/* shadow */}
      <ellipse cx={0} cy={4.2} rx={3.2} ry={1} fill="rgba(0,0,0,0.45)" />
      {/* tattered body */}
      <path d="M-2.2,4 L-2.6,-2 L-1,-3 L1,-3 L2.6,-2 L2.2,4 Z"
        fill="#4a5a3e" stroke="#1a1208" strokeWidth={0.4} />
      {/* arms hanging forward */}
      <line x1={-2.4} y1={-1} x2={-3.2} y2={2.6} stroke="#1a1208" strokeWidth={0.5} />
      <line x1={2.4} y1={-1} x2={3.2} y2={2.6} stroke="#1a1208" strokeWidth={0.5} />
      <circle cx={-3.2} cy={2.6} r={0.55} fill="#7a8a6a" stroke="#1a1208" strokeWidth={0.3} />
      <circle cx={3.2} cy={2.6} r={0.55} fill="#7a8a6a" stroke="#1a1208" strokeWidth={0.3} />
      {/* head — slack jaw, pale */}
      <circle cx={0} cy={-3.8} r={1.5} fill="#8a9078" stroke="#1a1208" strokeWidth={0.4} />
      {/* eye sockets */}
      <circle cx={-0.55} cy={-3.9} r={0.28} fill="#1a1208" />
      <circle cx={0.55} cy={-3.9} r={0.28} fill="#1a1208" />
      {/* mouth */}
      <line x1={-0.5} y1={-3.1} x2={0.5} y2={-3.1} stroke="#1a1208" strokeWidth={0.35} />
    </g>
  );
}
