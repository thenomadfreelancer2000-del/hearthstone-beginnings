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
  const sizeClass = isMobile ? "w-[48px] h-[48px]" : "w-[70px] h-[70px] sm:w-[88px] sm:h-[88px]";
  const btn =
    "w-5 h-5 grid place-items-center border border-amber/50 bg-coal/80 backdrop-blur-sm text-amber ranch-label text-[10px] leading-none hover:bg-amber/20 disabled:opacity-40 disabled:hover:bg-coal/80";

  return (
    <div className={`absolute ${positionClass} z-50 pointer-events-auto flex flex-col items-start gap-1.5`}>
      <button
        type="button"
        onClick={() => selectSurvivor(leader.id)}
        className={`block ${sizeClass} border-2 border-amber/70 shadow-[0_4px_16px_rgba(0,0,0,0.6)] overflow-hidden bg-coal hover:border-amber transition`}
        title={`${leader.name} ${leader.surname} — view`}
      >
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
      </button>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={zoomOut}
          disabled={zoom <= MIN_ZOOM + 0.001}
          className={btn}
          title="Zoom out"
          aria-label="Zoom out"
        >
          −
        </button>
        <button
          type="button"
          onClick={resetZoom}
          className="h-5 px-1 grid place-items-center border border-amber/50 bg-coal/80 backdrop-blur-sm text-amber ranch-data text-[9px] leading-none hover:bg-amber/20 min-w-[28px]"
          title="Reset zoom"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          type="button"
          onClick={zoomIn}
          disabled={zoom >= MAX_ZOOM - 0.001}
          className={btn}
          title="Zoom in"
          aria-label="Zoom in"
        >
          +
        </button>
      </div>
    </div>
  );
}


