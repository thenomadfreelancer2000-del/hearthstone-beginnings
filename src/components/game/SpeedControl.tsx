import { useState } from "react";
import { useGame } from "@/game/store";
import { useIsMobile } from "@/hooks/use-mobile";

interface SpeedControlProps {
  dockOpen?: boolean;
  inspectorOpen?: boolean;
}

export function SpeedControl({ dockOpen = false, inspectorOpen = false }: SpeedControlProps) {
  const speed = useGame((s) => s.speed);
  const setSpeed = useGame((s) => s.setSpeed);
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(true);

  // Slide left when desktop inspector is docked; raise on mobile when dock is open.
  const rightOffset = !isMobile && inspectorOpen ? "right-[356px]" : "right-2 sm:right-3";
  const bottomOffset = isMobile && dockOpen ? "bottom-3" : "bottom-2 sm:bottom-3";
  const widthClass = isMobile ? "w-[120px]" : "w-[140px]";

  return (
    <div
      className={`absolute ${bottomOffset} ${rightOffset} z-50 pointer-events-auto ${widthClass}`}
    >
      <div className="bg-coal/90 backdrop-blur-sm border border-amber/40 shadow-lg">
        <div className="flex items-stretch h-5 border-b border-amber/25">
          <div className="flex-1 grid place-items-center ranch-label text-[9px] leading-none text-amber/80 tracking-wider">
            SPEED
          </div>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="w-5 grid place-items-center text-amber/70 hover:bg-amber/10 border-l border-amber/25 transition-colors"
            title={open ? "Hide speed controls" : "Show speed controls"}
            aria-label={open ? "Hide speed controls" : "Show speed controls"}
            aria-expanded={open}
          >
            <span className="ranch-label text-[10px] leading-none">{open ? "▾" : "▸"}</span>
          </button>
        </div>
        {open && (
          <div className="flex items-stretch h-7 divide-x divide-amber/25">
            {[0, 1, 2, 3].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSpeed(s as 0 | 1 | 2 | 3)}
                className={`flex-1 min-w-0 grid place-items-center ranch-label text-[10px] leading-none transition-colors ${
                  speed === s ? "bg-amber text-ink" : "text-amber/80 hover:bg-amber/10"
                }`}
                title={s === 0 ? "Pause" : `${s === 3 ? 4 : s}× speed`}
              >
                {s === 0 ? "❚❚" : `${s === 3 ? 4 : s}×`}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
