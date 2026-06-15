import { useGame } from "@/game/store";
import { SPECIES_LABEL } from "@/game/sim/livestock";

export function LivestockRequestsPanel() {
  const requests = useGame((s) => s.livestockRequests);
  const families = useGame((s) => s.families);
  const survivors = useGame((s) => s.survivors);
  const decide = useGame((s) => s.decideLivestockRequest);

  const pending = requests.filter((r) => r.status === "pending");
  if (pending.length === 0) return null;

  return (
    <div className="absolute top-2 left-2 z-40 w-[300px] max-w-[88vw] space-y-2 pointer-events-auto">
      {pending.slice(0, 3).map((r) => {
        const fam = families.find((f) => f.id === r.familyId);
        const requester = survivors.find((s) => s.id === r.requesterId);
        if (!fam || !requester) return null;
        const verb =
          r.kind === "start-raising" ? "wishes to start raising"
            : r.kind === "build-pen" ? "requests permission to build a"
              : "wishes to expand their";
        const target = r.kind === "build-pen" ? `${SPECIES_LABEL[r.species]} pen` : `${SPECIES_LABEL[r.species].toLowerCase()}`;
        return (
          <div key={r.id} className="parchment-panel corner-brackets p-3 shadow-[0_8px_24px_rgba(0,0,0,0.5)]">
            <div className="ranch-label text-[10px] text-amber mb-1">Livestock Request</div>
            <div className="ranch-display text-sm text-parchment leading-tight">
              {requester.name} {requester.surname}
            </div>
            <div className="ranch-handwritten text-[11px] text-dust-light mt-1">
              House of <span className="text-amber">{fam.name}</span> {verb} {target}.
            </div>
            {r.tributeOffer && (
              <div className="ranch-handwritten text-[11px] text-amber italic mt-1">
                "In return, we'll send <span className="text-parchment">{r.tributeOffer.perMonth} {r.tributeOffer.resource}</span> to the ranch each month."
              </div>
            )}
            <div className="flex gap-1 mt-2">
              <button onClick={() => decide(r.id, "approve")} className="btn-ranch btn-ranch-primary text-[10px] flex-1 py-1">Approve</button>
              <button onClick={() => decide(r.id, "postpone")} className="btn-ranch btn-ranch-ghost text-[10px] flex-1 py-1">Postpone</button>
              <button onClick={() => decide(r.id, "reject")} className="btn-ranch btn-ranch-ghost text-[10px] flex-1 py-1 text-danger">Reject</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
