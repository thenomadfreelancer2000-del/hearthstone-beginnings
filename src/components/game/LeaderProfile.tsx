import { useGame } from "@/game/store";
import { useIsMobile } from "@/hooks/use-mobile";
import { getPortraitUrl, defaultPortraitFor } from "@/game/data/portraits";
import { useView, MIN_ZOOM, MAX_ZOOM } from "@/game/viewStore";

interface LeaderProfileProps {
  dockOpen?: boolean;
}

export function LeaderProfile({ dockOpen = false }: LeaderProfileProps) {
  const leader = useGame((s) => s.survivors.find((x) => x.id === s.currentLeaderId));
  const selectSurvivor = useGame((s) => s.selectSurvivor);
  const isMobile = useIsMobile();
  const zoom = useView((s) => s.mapZoom);
  const zoomIn = useView((s) => s.zoomIn);
  const zoomOut = useView((s) => s.zoomOut);
  const resetZoom = useView((s) => s.resetZoom);
  const centerOnRanch = useView((s) => s.centerOnRanch);

  if (!leader) return null;
  const portraitUrl = getPortraitUrl(leader.portraitId) ?? getPortraitUrl(defaultPortraitFor(leader.gender));

  // Anchor to bottom-left; minimal push when dock opens so the portrait stays grounded.
  const positionClass = isMobile && dockOpen ? "left-2 bottom-3" : "left-2 bottom-2 sm:left-3 sm:bottom-3";
  const portraitSize = isMobile ? "w-[64px] h-[64px]" : "w-[92px] h-[92px] sm:w-[108px] sm:h-[108px]";
  const widthClass = isMobile ? "w-[68px]" : "w-[96px] sm:w-[112px]";
  const iconBtn =
    "flex-1 h-full grid place-items-center text-amber/80 hover:bg-amber/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors";

  return (
    <div className={`absolute ${positionClass} z-50 pointer-events-auto flex flex-col gap-1.5 ${widthClass}`}>
      {/* Portrait frame */}
      <button
        type="button"
        onClick={() => selectSurvivor(leader.id)}
        className="relative group p-[3px] bg-coal border border-amber/40 shadow-[0_4px_16px_rgba(0,0,0,0.6)] hover:border-amber/70 transition-colors"
        title={`${leader.name} ${leader.surname} — view`}
      >
        <div className={`relative ${portraitSize} bg-coal-dark overflow-hidden`}>
          {portraitUrl ? (
            <img
              src={portraitUrl}
              alt={`${leader.name} ${leader.surname}`}
              width={128}
              height={128}
              className="w-full h-full object-cover pointer-events-none"
            />
          ) : (
            <div className="w-full h-full grid place-items-center text-amber text-xs">No face</div>
          )}
          {/* Decorative L-brackets */}
          <div className="absolute top-1 left-1 w-2.5 h-2.5 border-t border-l border-amber/60 pointer-events-none" />
          <div className="absolute bottom-1 right-1 w-2.5 h-2.5 border-b border-r border-amber/60 pointer-events-none" />
          {/* Soft bottom vignette */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
        </div>
      </button>

      {/* Inline zoom HUD */}
      <div className="flex items-center h-7 bg-coal/90 backdrop-blur-sm border border-amber/40 shadow-lg">
        <button
          type="button"
          onClick={zoomOut}
          disabled={zoom <= MIN_ZOOM + 0.001}
          className={`${iconBtn} border-r border-amber/20`}
          title="Zoom out"
          aria-label="Zoom out"
        >
          <span className="ranch-label text-[12px] leading-none">−</span>
        </button>
        <button
          type="button"
          onClick={resetZoom}
          className="flex-[1.4] h-full grid place-items-center ranch-data text-[10px] leading-none text-parchment hover:bg-amber/10 transition-colors"
          title="Reset zoom"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          type="button"
          onClick={zoomIn}
          disabled={zoom >= MAX_ZOOM - 0.001}
          className={`${iconBtn} border-l border-amber/20`}
          title="Zoom in"
          aria-label="Zoom in"
        >
          <span className="ranch-label text-[12px] leading-none">+</span>
        </button>
        <button
          type="button"
          onClick={centerOnRanch}
          className={`${iconBtn} border-l border-amber/30 bg-black/20`}
          title="Center on ranch (100%)"
          aria-label="Center on ranch"
        >
          <span className="ranch-label text-[11px] leading-none">⌖</span>
        </button>
      </div>
    </div>
  );
}




