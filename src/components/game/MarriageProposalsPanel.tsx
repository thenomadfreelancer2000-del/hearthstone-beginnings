import { useGame } from "@/game/store";

export function MarriageProposalsPanel() {
  const proposals = useGame((s) => s.proposals);
  const survivors = useGame((s) => s.survivors);
  const families = useGame((s) => s.families);
  const decide = useGame((s) => s.decideProposal);

  const pending = proposals.filter((p) => p.requiresPlayer && p.status === "pending");
  if (pending.length === 0) return null;

  return (
    <div className="absolute top-2 right-2 z-40 w-[320px] max-w-[92vw] space-y-2 pointer-events-auto">
      {pending.map((p) => {
        const a = survivors.find((s) => s.id === p.aId);
        const b = survivors.find((s) => s.id === p.bId);
        const fa = families.find((f) => f.id === p.aFamilyId);
        const fb = families.find((f) => f.id === p.bFamilyId);
        if (!a || !b || !fa || !fb) return null;
        return (
          <div key={p.id} className="parchment-panel corner-brackets p-3 shadow-[0_8px_24px_rgba(0,0,0,0.5)]">
            <div className="ranch-label text-[10px] text-amber mb-1">Marriage Proposal</div>
            <div className="ranch-display text-sm text-parchment leading-tight">
              {a.name} {a.surname} <span className="text-dust">×</span> {b.name} {b.surname}
            </div>
            <div className="ranch-handwritten text-[11px] text-dust-light mt-1">
              House of <span className="text-amber">{fa.name}</span> ({Math.round(fa.prestige)})
              {" · "}
              House of <span className="text-amber">{fb.name}</span> ({Math.round(fb.prestige)})
            </div>
            <div className="grid grid-cols-3 gap-1 mt-2 ranch-data text-[9px]">
              <Stat label="Attraction" v={p.attraction} />
              <Stat label="Compatibility" v={p.compatibility} />
              <Stat label="Family" v={p.familyApproval} signed />
            </div>
            <div className="ranch-data text-[9px] text-dust mt-1.5">
              Expected: <span className="text-amber">+{p.expectedPrestigeDelta} prestige</span>
              {" · "}<span className="text-amber">+{p.expectedRelationDelta} relation</span>
            </div>
            <div className="flex gap-1 mt-2">
              <button onClick={() => decide(p.id, "approve")} className="btn-ranch btn-ranch-primary text-[10px] flex-1 py-1">Approve</button>
              <button onClick={() => decide(p.id, "postpone")} className="btn-ranch btn-ranch-ghost text-[10px] flex-1 py-1">Postpone</button>
              <button onClick={() => decide(p.id, "reject")} className="btn-ranch btn-ranch-ghost text-[10px] flex-1 py-1 text-danger">Reject</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Stat({ label, v, signed }: { label: string; v: number; signed?: boolean }) {
  const tone = v >= 50 ? "text-success" : v >= 20 ? "text-amber" : v >= 0 ? "text-dust" : "text-danger";
  return (
    <div className="border border-amber/20 p-1 text-center">
      <div className={`ranch-data text-xs ${tone}`}>{signed && v > 0 ? "+" : ""}{Math.round(v)}</div>
      <div className="ranch-label text-[8px] text-dust">{label}</div>
    </div>
  );
}
