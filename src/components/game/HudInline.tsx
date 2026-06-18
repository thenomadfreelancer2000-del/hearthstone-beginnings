import { useState } from "react";
import { useGame } from "@/game/store";
import { useView, MIN_ZOOM, MAX_ZOOM } from "@/game/viewStore";

/**
 * Compact speed + zoom HUD designed to live inside the TopBar.
 * Collapsed: shows current speed and zoom % with an expand arrow.
 * Expanded: full controls plus a collapse arrow.
 */
export function HudInline() {
  const [open, setOpen] = useState(false);
  const speed = useGame((s) => s.speed);
  const setSpeed = useGame((s) => s.setSpeed);
  const zoom = useView((s) => s.mapZoom);
  const zoomIn = useView((s) => s.zoomIn);
  const zoomOut = useView((s) => s.zoomOut);
  const resetZoom = useView((s) => s.resetZoom);
  const centerOnRanch = useView((s) => s.centerOnRanch);

  const speedLabel = speed === 0 ? "❚❚" : `${speed === 3 ? 4 : speed}×`;
  const cell =
    "h-5 min-w-[20px] px-1 grid place-items-center ranch-label text-[9px] leading-none transition-colors";

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 h-5 px-1.5 border border-amber/30 bg-coal/60 hover:bg-amber/10 text-amber/85 transition-colors"
        title="Show speed & zoom controls"
        aria-label="Expand HUD controls"
        aria-expanded={false}
      >
        <span className="ranch-label text-[9px] leading-none">{speedLabel}</span>
        <span className="text-amber/40">·</span>
        <span className="ranch-data text-[9px] leading-none normal-case tracking-normal text-parchment">
          {Math.round(zoom * 100)}%
        </span>
        <span className="ranch-label text-[9px] leading-none text-amber/70">▸</span>
      </button>
    );
  }

  return (
    <div className="flex items-stretch border border-amber/30 bg-coal/60 divide-x divide-amber/20">
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
        className={`${cell} ranch-data normal-case tracking-normal text-parchment hover:bg-amber/10`}
        title="Reset zoom"
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
      <button
        type="button"
        onClick={() => setOpen(false)}
        className={`${cell} text-amber/70 hover:bg-amber/10`}
        title="Collapse"
        aria-label="Collapse HUD controls"
        aria-expanded={true}
      >
        ◂
      </button>
    </div>
  );
}
