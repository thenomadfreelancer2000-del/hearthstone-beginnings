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
  const sizeClass = isMobile ? "w-[52px] h-[52px]" : "w-[78px] h-[78px] sm:w-[96px] sm:h-[96px]";
  const btn =
    "flex-1 h-6 grid place-items-center text-amber ranch-label text-[11px] leading-none hover:bg-amber/15 disabled:opacity-40 disabled:hover:bg-transparent transition";

  return (
    <div className={`absolute ${positionClass} z-50 pointer-events-auto`}>
      <div className="parchment-panel corner-brackets p-1 bg-coal/85 backdrop-blur-sm border-amber/60 shadow-[0_4px_16px_rgba(0,0,0,0.6)]">
        <button
          type="button"
          onClick={() => selectSurvivor(leader.id)}
          className={`block ${sizeClass} overflow-hidden bg-coal hover:opacity-90 transition`}
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

        <div className="mt-1 flex items-stretch divide-x divide-amber/30 border-t border-amber/30">
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
            className="flex-[1.4] h-6 grid place-items-center text-amber ranch-data text-[10px] leading-none hover:bg-amber/15 transition"
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
          <button
            type="button"
            onClick={centerOnRanch}
            className={btn}
            title="Center on ranch (100%)"
            aria-label="Center on ranch"
          >
            ⌖
          </button>
        </div>
      </div>
    </div>
  );
}



