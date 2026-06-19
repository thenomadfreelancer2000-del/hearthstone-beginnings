import { useGame } from "@/game/store";
import { useIsMobile } from "@/hooks/use-mobile";
import { getPortraitUrl, defaultPortraitFor } from "@/game/data/portraits";

interface LeaderProfileProps {
  dockOpen?: boolean;
}

export function LeaderProfile({ dockOpen = false }: LeaderProfileProps) {
  const leader = useGame((s) => s.survivors.find((x) => x.id === s.currentLeaderId));
  const selectSurvivor = useGame((s) => s.selectSurvivor);
  const isMobile = useIsMobile();

  if (!leader) return null;
  const portraitUrl =
    getPortraitUrl(leader.portraitId) ?? getPortraitUrl(defaultPortraitFor(leader.gender));

  const positionClass =
    isMobile && dockOpen ? "left-2 bottom-3" : "left-2 bottom-2 sm:left-3 sm:bottom-3";
  const portraitSize = isMobile
    ? "w-[59px] h-[59px]"
    : "w-[77px] h-[77px] sm:w-[90px] sm:h-[90px]";
  const widthClass = isMobile ? "w-[63px]" : "w-[80px] sm:w-[93px]";

  return (
    <div
      className={`absolute ${positionClass} z-50 pointer-events-auto flex flex-col gap-1.5 ${widthClass}`}
    >
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
              width={160}
              height={160}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover pointer-events-none"
            />
          ) : (
            <div className="w-full h-full grid place-items-center text-amber text-xs">No face</div>
          )}
          <div className="absolute top-1 left-1 w-3 h-3 border-t border-l border-amber/60 pointer-events-none" />
          <div className="absolute bottom-1 right-1 w-3 h-3 border-b border-r border-amber/60 pointer-events-none" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
        </div>
      </button>
    </div>
  );
}
