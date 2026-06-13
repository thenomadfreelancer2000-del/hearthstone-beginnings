import { useMemo, useState } from "react";
import { useGame, computeFoundingObjectives } from "@/game/store";

export function FoundingPanel() {
  const foundingPhase = useGame((s) => s.foundingPhase);
  const territory = useGame((s) => s.territory);
  const buildings = useGame((s) => s.buildings);
  const survivors = useGame((s) => s.survivors);
  const [collapsed, setCollapsed] = useState(false);

  const objectives = useMemo(
    () => computeFoundingObjectives({ buildings, survivors, territory, foundingPhase } as never),
    [buildings, survivors, territory, foundingPhase],
  );

  if (!foundingPhase) return null;

  const doneCount = objectives.filter((o) => o.done).length;

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="absolute top-2 left-2 z-20 parchment-panel border border-amber/40 px-3 py-2 shadow-xl flex items-center gap-2 hover:border-amber/70"
      >
        <span className="ranch-label text-[10px] text-amber">Founding</span>
        <span className="ranch-data text-[11px] text-parchment">
          {doneCount}/{objectives.length}
        </span>
        <span className="text-amber text-[10px]">▸</span>
      </button>
    );
  }

  return (
    <div className="absolute top-2 left-2 z-20 parchment-panel border border-amber/40 p-3 w-[260px] shadow-xl">
      <div className="flex items-start justify-between mb-1">
        <div className="ranch-label text-[10px] text-amber">Founding Phase</div>
        <button
          onClick={() => setCollapsed(true)}
          className="ranch-label text-[10px] text-amber hover:text-parchment leading-none"
          aria-label="Collapse"
        >
          ▾
        </button>
      </div>
      <div className="ranch-display text-base text-parchment mb-2 leading-tight">
        Found The Ranch
      </div>
      <p className="ranch-handwritten text-[12px] text-dust-light mb-2 leading-snug">
        Time slowed. No arrivals, no hunger yet. Complete the foundations.
      </p>
      <ul className="space-y-1">
        {objectives.map((o) => (
          <li key={o.id} className="flex items-start gap-2 ranch-data text-[11px]">
            <span className={o.done ? "text-success" : "text-dust"}>
              {o.done ? "●" : "○"}
            </span>
            <span className={o.done ? "text-parchment line-through opacity-70" : "text-parchment"}>
              {o.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
