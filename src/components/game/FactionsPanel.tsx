import { useMemo } from "react";
import { useGame } from "@/game/store";
import { computeFactions, type FactionSnapshot, type FactionsView } from "@/game/sim/factions";
import type { Survivor } from "@/game/types";

export function FactionsPanel({ onClose }: { onClose: () => void }) {
  const survivors = useGame((s) => s.survivors);
  const families = useGame((s) => s.families);
  const laws = useGame((s) => s.laws);

  const view = useMemo(
    () => computeFactions(survivors, families, laws),
    [survivors, families, laws],
  );

  const active = view.factions.filter((f) => f.members + f.sympathizers > 0);

  return (
    <div className="absolute inset-0 z-50 bg-black/60 flex items-stretch justify-end">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative parchment-panel-warm corner-brackets w-[min(600px,96vw)] h-full overflow-y-auto p-4 shadow-2xl">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="ranch-display text-lg text-amber">Political Factions</div>
            <div className="ranch-handwritten text-[11px] text-dust-light italic">
              {active.length === 0
                ? "No faction has taken shape yet."
                : `${active.length} faction${active.length === 1 ? "" : "s"} have formed in the long room.`}
            </div>
          </div>
          <button className="btn-ranch btn-ranch-ghost text-xs" onClick={onClose}>Close</button>
        </div>

        {active.length === 0 ? (
          <div className="border border-amber/25 bg-coal/40 p-3 ranch-handwritten text-xs text-dust-light italic">
            None of your people yet share traits strong enough to band together.
            Factions will emerge as the ranch grows.
          </div>
        ) : (
          <div className="space-y-2">
            {active.map((f) => (
              <FactionCard key={f.id} f={f} view={view} survivors={survivors} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FactionCard({
  f,
  view,
  survivors,
}: {
  f: FactionSnapshot;
  view: FactionsView;
  survivors: Survivor[];
}) {
  const selectSurvivor = useGame((s) => s.selectSurvivor);
  const barColor =
    f.strength >= 60 ? "bg-amber" : f.strength >= 25 ? "bg-amber/70" : "bg-amber/30";

  const members = survivors.filter(
    (s) => s.health > 0 && view.affinity[s.id]?.primary === f.id,
  );
  const sympathizers = survivors.filter(
    (s) => s.health > 0 && view.affinity[s.id]?.secondary === f.id,
  );

  return (
    <div className="border border-amber/30 bg-coal/50 p-3">
      <div className="flex items-baseline justify-between gap-2">
        <div>
          <div className="ranch-display text-sm text-parchment">{f.def.name}</div>
          <div className="ranch-handwritten text-[10px] text-dust-light italic">"{f.def.motto}"</div>
        </div>
        <div className="text-right shrink-0">
          <div className="ranch-data text-base text-amber">{f.strength}</div>
          <div className="ranch-label text-[8px] text-dust">strength</div>
        </div>
      </div>

      <div className="h-1.5 bg-coal border border-amber/15 mt-1">
        <div className={`h-full ${barColor}`} style={{ width: `${f.strength}%` }} />
      </div>

      <div className="mt-2 border-t border-amber/15 pt-2">
        <div className="ranch-label text-[9px] text-amber mb-1">Their ask</div>
        <div className="ranch-body text-[11px] text-parchment">{f.def.agenda}</div>
      </div>

      {f.leaderName && (
        <div className="ranch-body text-[11px] text-dust-light mt-2">
          Spoken for by <span className="text-parchment">{f.leaderName}</span>
          {f.leadingHouseNames[0] && <> of House {f.leadingHouseNames[0]}</>}
        </div>
      )}

      <div className="mt-2 border-t border-amber/15 pt-2">
        <div className="ranch-label text-[9px] text-amber mb-1">
          Members ({members.length}){sympathizers.length > 0 && <span className="text-dust"> · {sympathizers.length} sympathizer{sympathizers.length === 1 ? "" : "s"}</span>}
        </div>
        {members.length === 0 && sympathizers.length === 0 ? (
          <div className="ranch-handwritten text-[10px] text-dust italic">— no one yet —</div>
        ) : (
          <ul className="flex flex-wrap gap-1">
            {members.map((s) => (
              <li key={s.id}>
                <button
                  onClick={() => selectSurvivor(s.id)}
                  className="ranch-body text-[10px] text-parchment border border-amber/40 px-1.5 py-0.5 hover:text-amber hover:border-amber"
                >
                  {s.name} {s.surname}
                </button>
              </li>
            ))}
            {sympathizers.map((s) => (
              <li key={s.id}>
                <button
                  onClick={() => selectSurvivor(s.id)}
                  className="ranch-body text-[10px] text-dust border border-amber/15 px-1.5 py-0.5 hover:text-amber hover:border-amber/50"
                  title="Sympathizer"
                >
                  {s.name} {s.surname}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
