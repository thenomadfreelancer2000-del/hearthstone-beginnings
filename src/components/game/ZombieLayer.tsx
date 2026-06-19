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
          <g key={z.id} transform={`matrix(0.5, -0.5, 1, 1, ${cx}, ${cy + bob}) scale(1.5)`}>
            {detail ? <ZombieDetailed /> : <ZombieDot />}
          </g>
        );
      })}
    </g>
  );
}

function ZombieDot() {
  // Zoomed-out marker — punchy enough to spot at low zoom.
  return (
    <>
      <ellipse cx={0} cy={3} rx={3.2} ry={1} fill="rgba(0,0,0,0.55)" />
      <circle cx={0} cy={0} r={2.6} fill="#3a4a32" stroke="#0a0604" strokeWidth={0.6} />
      <circle cx={0} cy={-1.8} r={1.4} fill="#8a9078" stroke="#0a0604" strokeWidth={0.5} />
    </>
  );
}

function ZombieDetailed() {
  // Sized to match SurvivorArt (body ~5 wide, head at y≈-5.6).
  return (
    <g>
      {/* shadow */}
      <ellipse cx={0} cy={5} rx={3.4} ry={1.1} fill="rgba(0,0,0,0.45)" />
      {/* legs (dragging) */}
      <rect x={-1.8} y={2.4} width={1.4} height={3} fill="#2a1d10" stroke="#1a1208" strokeWidth={0.35} />
      <rect x={0.4} y={2.4} width={1.4} height={3} fill="#2a1d10" stroke="#1a1208" strokeWidth={0.35} />
      {/* tattered torso */}
      <path d="M-2.6,2.6 L-3,-2.4 L-1.2,-3.4 L1.2,-3.4 L3,-2.4 L2.6,2.6 Z"
        fill="#4a5a3e" stroke="#1a1208" strokeWidth={0.5} />
      {/* torn shirt rip */}
      <path d="M-1.2,-1 L0.2,1 L-0.4,2" stroke="#1a1208" strokeWidth={0.35} fill="none" opacity={0.7} />
      {/* arms reaching forward */}
      <line x1={-2.6} y1={-1.6} x2={-3.6} y2={1.8} stroke="#1a1208" strokeWidth={0.7} strokeLinecap="round" />
      <line x1={2.6} y1={-1.6} x2={3.6} y2={1.8} stroke="#1a1208" strokeWidth={0.7} strokeLinecap="round" />
      <circle cx={-3.6} cy={1.9} r={0.7} fill="#7a8a6a" stroke="#1a1208" strokeWidth={0.35} />
      <circle cx={3.6} cy={1.9} r={0.7} fill="#7a8a6a" stroke="#1a1208" strokeWidth={0.35} />
      {/* neck */}
      <rect x={-0.5} y={-3.8} width={1} height={0.8} fill="#8a9078" stroke="#1a1208" strokeWidth={0.25} />
      {/* pale head, slightly tilted */}
      <ellipse cx={-0.2} cy={-5.6} rx={2.2} ry={2.5} fill="#8a9078" stroke="#1a1208" strokeWidth={0.5} />
      {/* dark eye sockets */}
      <circle cx={-1} cy={-5.6} r={0.42} fill="#1a1208" />
      <circle cx={0.55} cy={-5.6} r={0.42} fill="#1a1208" />
      {/* slack jaw */}
      <rect x={-0.7} y={-4.4} width={1.5} height={0.7} fill="#1a1208" />
      {/* blood drip */}
      <line x1={0.4} y1={-3.8} x2={0.6} y2={-2.8} stroke="#7a1a14" strokeWidth={0.4} strokeLinecap="round" />
    </g>
  );
}
