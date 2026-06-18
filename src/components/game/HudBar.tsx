import { useGame } from "@/game/store";
import { useView, MIN_ZOOM, MAX_ZOOM } from "@/game/viewStore";
import { useIsMobile } from "@/hooks/use-mobile";

interface HudBarProps {
  dockOpen?: boolean;
  inspectorOpen?: boolean;
}

/**
 * Unified bottom-center HUD combining speed + zoom controls.
 * Replaces the two separate floating panels so the map corners stay clear.
 */
export function HudBar({ dockOpen = false, inspectorOpen = false }: HudBarProps) {
  const speed = useGame((s) => s.speed);
  const setSpeed = useGame((s) => s.setSpeed);
  const zoom = useView((s) => s.mapZoom);
  const zoomIn = useView((s) => s.zoomIn);
  const zoomOut = useView((s) => s.zoomOut);
  const resetZoom = useView((s) => s.resetZoom);
  const centerOnRanch = useView((s) => s.centerOnRanch);
  const isMobile = useIsMobile();

  const bottomOffset = isMobile && dockOpen ? "bottom-3" : "bottom-2 sm:bottom-3";
  // Nudge left to clear the inspector rail on desktop, stay centered on mobile.
  const centerStyle = !isMobile && inspectorOpen
    ? { left: "calc(50% - 178px)" }
    : { left: "50%" };

  const cell =
    "h-7 min-w-[28px] px-2 grid place-items-center ranch-label text-[10px] leading-none transition-colors";

  return (
    <div
      className={`absolute ${bottomOffset} z-50 pointer-events-auto -translate-x-1/2`}
      style={centerStyle}
    >
      <div className="flex items-stretch bg-coal/90 backdrop-blur-sm border border-amber/40 shadow-lg divide-x divide-amber/25">
        {/* Speed cluster */}
        {([0, 1, 2, 3] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSpeed(s)}
            className={`${cell} ${speed === s ? "bg-amber text-ink" : "text-amber/85 hover:bg-amber/10"}`}
            title={s === 0 ? "Pause" : `${s === 3 ? 4 : s}× speed`}
            aria-label={s === 0 ? "Pause" : `${s === 3 ? 4 : s}x speed`}
          >
            {s === 0 ? "❚❚" : `${s === 3 ? 4 : s}×`}
          </button>
        ))}

        {/* Divider gap (visual) */}
        <div className="w-1 bg-coal/0" />

        {/* Zoom cluster */}
        <button
          type="button"
          onClick={zoomOut}
          disabled={zoom <= MIN_ZOOM + 0.001}
          className={`${cell} text-amber/85 hover:bg-amber/10 disabled:opacity-30 disabled:hover:bg-transparent`}
          title="Zoom out"
          aria-label="Zoom out"
        >
          −
        </button>
        <button
          type="button"
          onClick={resetZoom}
          className={`${cell} ranch-data text-parchment hover:bg-amber/10 normal-case tracking-normal`}
          title="Reset zoom to 100%"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          type="button"
          onClick={zoomIn}
          disabled={zoom >= MAX_ZOOM - 0.001}
          className={`${cell} text-amber/85 hover:bg-amber/10 disabled:opacity-30 disabled:hover:bg-transparent`}
          title="Zoom in"
          aria-label="Zoom in"
        >
          +
        </button>
        <button
          type="button"
          onClick={centerOnRanch}
          className={`${cell} text-amber/85 hover:bg-amber/10`}
          title="Center on ranch"
          aria-label="Center on ranch"
        >
          ⌖
        </button>
      </div>
    </div>
  );
}
