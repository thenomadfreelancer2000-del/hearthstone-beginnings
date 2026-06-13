import { useState } from "react";
import { Camera, X } from "lucide-react";
import { useGame } from "@/game/store";
import { PORTRAITS, getPortraitUrl, defaultPortraitFor } from "@/game/data/portraits";

export function LeaderProfile() {
  const leader = useGame((s) => s.survivors.find((x) => x.id === s.currentLeaderId));
  const selectSurvivor = useGame((s) => s.selectSurvivor);
  const setSurvivorPortrait = useGame((s) => s.setSurvivorPortrait);
  const [picking, setPicking] = useState(false);

  if (!leader) return null;
  const portraitUrl = getPortraitUrl(leader.portraitId) ?? getPortraitUrl(defaultPortraitFor(leader.gender));
  const available = PORTRAITS.filter((p) => p.gender === leader.gender);

  return (
    <>
      <div className="absolute left-3 bottom-3 z-20 pointer-events-auto">
        <div className="relative group">
          <button
            onClick={() => selectSurvivor(leader.id)}
            className="block w-16 h-16 sm:w-20 sm:h-20 border-2 border-amber/70 shadow-[0_4px_16px_rgba(0,0,0,0.6)] overflow-hidden bg-coal hover:border-amber transition"
            title={`${leader.name} ${leader.surname} — view`}
          >
            {portraitUrl ? (
              <img
                src={portraitUrl}
                alt={`${leader.name} ${leader.surname}`}
                width={128}
                height={128}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full grid place-items-center text-amber text-xs">No face</div>
            )}
          </button>
          <button
            onClick={() => setPicking(true)}
            className="absolute -top-1 -right-1 w-6 h-6 grid place-items-center bg-coal border border-amber/70 text-amber hover:bg-amber hover:text-ink transition"
            title="Change face"
            aria-label="Change face"
          >
            <Camera className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {picking && (
        <div
          className="fixed inset-0 z-50 bg-black/70 grid place-items-center p-4"
          onClick={() => setPicking(false)}
        >
          <div
            className="parchment-panel corner-brackets p-5 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <p className="ranch-label text-amber">Choose a face</p>
              <button
                onClick={() => setPicking(false)}
                className="text-dust-light hover:text-amber"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {available.map((p) => {
                const active = p.id === leader.portraitId;
                return (
                  <button
                    key={p.id}
                    onClick={() => {
                      setSurvivorPortrait(leader.id, p.id);
                      setPicking(false);
                    }}
                    className={`aspect-square overflow-hidden border-2 transition ${
                      active ? "border-amber" : "border-amber/20 hover:border-amber/60"
                    }`}
                  >
                    <img
                      src={p.url}
                      alt="Portrait option"
                      loading="lazy"
                      width={128}
                      height={128}
                      className="w-full h-full object-cover"
                    />
                  </button>
                );
              })}
            </div>
            <p className="ranch-handwritten text-xs text-dust-light mt-3">
              The face by which {leader.name} will be remembered.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
