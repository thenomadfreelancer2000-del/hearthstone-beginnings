import { useGame } from "@/game/store";
import { useIsMobile } from "@/hooks/use-mobile";
import { getPortraitUrl, defaultPortraitFor } from "@/game/data/portraits";

export function LeaderProfile() {
  const leader = useGame((s) => s.survivors.find((x) => x.id === s.currentLeaderId));
  const selectSurvivor = useGame((s) => s.selectSurvivor);
  const isMobile = useIsMobile();

  if (!leader) return null;
  const portraitUrl = getPortraitUrl(leader.portraitId) ?? getPortraitUrl(defaultPortraitFor(leader.gender));

  // Anchor to bottom-left; smaller on mobile so it doesn't crowd the screen.
  const positionClass = "left-2 bottom-2 sm:left-3 sm:bottom-3";
  const sizeClass = isMobile ? "w-12 h-12" : "w-16 h-16 sm:w-20 sm:h-20";

  return (
    <div className={`absolute ${positionClass} z-20 pointer-events-auto`}>
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

