import { useGame } from "@/game/store";
import { BUILDINGS } from "@/game/data/content";

export function AssignBuilderModal() {
  const buildingId = useGame((s) => s.pendingBuildAssignment);
  const buildings = useGame((s) => s.buildings);
  const survivors = useGame((s) => s.survivors);
  const founderId = useGame((s) => s.founderId);
  const assignBuilder = useGame((s) => s.assignBuilder);
  const autoAssignBuilder = useGame((s) => s.autoAssignBuilder);
  const close = useGame((s) => s.closeBuildAssignment);

  if (!buildingId) return null;
  const b = buildings.find((x) => x.id === buildingId);
  if (!b) return null;
  const def = BUILDINGS[b.kind];

  const eligible = survivors
    .filter((s) => s.health > 0 && (s.stage === "adult" || s.stage === "youth" || s.stage === "elder" || s.isFounder))
    .sort((a, c) => (c.skills.build ?? 1) - (a.skills.build ?? 1));

  function skillTier(v: number) {
    if (v >= 20) return { label: "Expert", color: "text-success" };
    if (v >= 10) return { label: "Average", color: "text-amber" };
    return { label: "Slow", color: "text-dust" };
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="parchment-panel corner-brackets max-w-md w-full p-5 max-h-[85vh] overflow-auto scroll-amber">
        <p className="ranch-label text-amber text-[10px]">Assign Builder</p>
        <h2 className="ranch-display text-2xl mt-1">{def.name}</h2>
        <p className="ranch-handwritten text-sm text-dust-light mt-1">{def.blurb}</p>

        <div className="divider-amber my-3" />

        <div className="ranch-data text-[10px] text-dust grid grid-cols-2 gap-2 mb-3">
          <div>
            <div className="ranch-label text-amber">Effort</div>
            <div className="text-parchment">{Math.ceil(b.effortRemaining)} units</div>
          </div>
          <div>
            <div className="ranch-label text-amber">Cost paid</div>
            <div className="text-parchment">
              {Object.entries(def.cost).map(([r, a]) => `${a} ${r}`).join(" · ") || "free"}
            </div>
          </div>
        </div>

        <button
          onClick={() => autoAssignBuilder(buildingId)}
          className="btn-ranch btn-ranch-primary w-full mb-3"
        >
          Auto-assign best available
        </button>

        <p className="ranch-label text-[10px] text-dust mb-2">Or choose by hand</p>
        <div className="space-y-1.5 mb-3">
          {eligible.length === 0 && (
            <p className="ranch-handwritten text-sm text-dust">No one able to build yet.</p>
          )}
          {eligible.map((s) => {
            const sk = Math.round(s.skills.build ?? 1);
            const tier = skillTier(sk);
            return (
              <button
                key={s.id}
                onClick={() => assignBuilder(buildingId, s.id)}
                className="w-full flex justify-between items-center px-2 py-1.5 border border-amber/20 hover:bg-amber/10 text-left"
              >
                <span className="ranch-body text-parchment text-sm">
                  {s.isFounder && "★ "}{s.id === founderId ? <strong>{s.name}</strong> : s.name} {s.surname}
                </span>
                <span className="ranch-data text-[10px] text-dust">
                  Build <span className="text-amber">{sk}</span>{" "}
                  <span className={tier.color}>· {tier.label}</span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex gap-2">
          <button onClick={() => assignBuilder(buildingId, null)} className="btn-ranch btn-ranch-ghost flex-1">
            Anyone (no assignment)
          </button>
          <button onClick={close} className="btn-ranch flex-1">Skip</button>
        </div>
      </div>
    </div>
  );
}
