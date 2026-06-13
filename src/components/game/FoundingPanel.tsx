import { useMemo } from "react";
import { useGame, computeFoundingObjectives } from "@/game/store";

export function FoundingPanel() {
  const foundingPhase = useGame((s) => s.foundingPhase);
  const borderMode = useGame((s) => s.borderMode);
  const enterBorderMode = useGame((s) => s.enterBorderMode);
  const exitBorderMode = useGame((s) => s.exitBorderMode);
  const territory = useGame((s) => s.territory);
  const buildings = useGame((s) => s.buildings);
  const survivors = useGame((s) => s.survivors);
  const objectives = useMemo(
    () => computeFoundingObjectives({ buildings, survivors, territory, foundingPhase } as never),
    [buildings, survivors, territory, foundingPhase],
  );

  if (!foundingPhase) return null;

  const acres = territory && territory.radius > 0
    ? Math.max(1, Math.round(Math.PI * territory.radius * territory.radius * 0.1))
    : 0;

  return (
    <div className="absolute top-2 left-2 z-20 parchment-panel border border-amber/40 p-3 w-[260px] shadow-xl">
      <div className="ranch-label text-[10px] text-amber mb-1">Founding Phase</div>
      <div className="ranch-display text-base text-parchment mb-2 leading-tight">
        Found The Ranch
      </div>
      <p className="ranch-handwritten text-[12px] text-dust-light mb-2 leading-snug">
        Time slowed. No arrivals, no hunger yet. Complete the foundations.
      </p>
      <ul className="space-y-1 mb-3">
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
      <div className="border-t border-amber/15 pt-2">
        <div className="flex items-center justify-between mb-1">
          <span className="ranch-label text-[10px] text-amber">Territory</span>
          <span className="ranch-data text-[11px] text-dust-light">
            {acres > 0 ? `${acres} acres` : "unclaimed"}
          </span>
        </div>
        {borderMode ? (
          <div className="flex gap-2">
            <div className="ranch-handwritten text-[11px] text-amber flex-1">
              Click the map to set the ranch edge.
            </div>
            <button className="btn-ranch btn-ranch-ghost text-[10px]" onClick={exitBorderMode}>
              Cancel
            </button>
          </div>
        ) : (
          <button
            className="btn-ranch btn-ranch-primary w-full text-[11px]"
            onClick={enterBorderMode}
          >
            {(territory?.radius ?? 0) > 0 ? "Re-define Border" : "Define Border"}
          </button>
        )}
      </div>
    </div>
  );
}
