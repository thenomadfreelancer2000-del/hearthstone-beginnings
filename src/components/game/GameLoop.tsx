import { useEffect, useRef } from "react";
import { useGame } from "@/game/store";
import { debugLog } from "@/game/debug";

/** Main RAF game loop wired to the store. Renders nothing. */
export function GameLoop() {
  const tickReal = useGame((s) => s.tickReal);
  const speed = useGame((s) => s.speed);
  const screen = useGame((s) => s.screen);
  const last = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (screen !== "game") return;
    debugLog("gameLoop:raf:start", { speed });
    const loop = (now: number) => {
      if (last.current == null) last.current = now;
      const dt = Math.min(120, now - last.current);
      last.current = now;
      if (speed > 0) tickReal(dt);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      debugLog("gameLoop:raf:stop");
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      last.current = null;
    };
  }, [screen, speed, tickReal]);

  // autosave every 30s
  const save = useGame((s) => s.save);
  useEffect(() => {
    if (screen !== "game") return;
    debugLog("gameLoop:autosave:start", { intervalMs: 30000 });
    const id = window.setInterval(() => {
      save();
    }, 30000);
    return () => {
      debugLog("gameLoop:autosave:stop");
      window.clearInterval(id);
    };
  }, [screen, save]);

  return null;
}
