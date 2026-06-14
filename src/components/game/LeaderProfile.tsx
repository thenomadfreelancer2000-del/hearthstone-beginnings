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
  const portraitUrl = getPortraitUrl(leader.portraitId) ?? getPortraitUrl(defaultPortraitFor(leader.gender));

  // Anchor to bottom-left; minimal push when dock opens so the portrait stays grounded.
  const positionClass = isMobile && dockOpen ? "left-2 bottom-3" : "left-2 bottom-2 sm:left-3 sm:bottom-3";
  const sizeClass = isMobile ? "w-[48px] h-[48px]" : "w-[70px] h-[70px] sm:w-[88px] sm:h-[88px]";

  return (
    <div className={`absolute ${positionClass} z-50 pointer-events-auto`}>
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
    </div>
  );
}

