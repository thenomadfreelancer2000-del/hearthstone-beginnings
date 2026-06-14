import { useState } from "react";
import { useGame } from "@/game/store";
import { ROLE_LABEL, ROLE_OCCUPATION } from "@/game/sim/ministers";
import type { MinisterRequest, Survivor } from "@/game/types";

export function MinisterRequestsPanel() {
  // Managers now staff their own departments automatically (see
  // autoAssignWorkers). The Founder no longer approves worker requests, so
  // this HUD is hidden. Kept as a no-op so existing imports/wiring still work.
  const requests = useGame((s) => s.ministerRequests);
  const ministers = useGame((s) => s.ministers);
  const survivors = useGame((s) => s.survivors);
  const families = useGame((s) => s.families);
  const decide = useGame((s) => s.decideMinisterRequest);

  const [picking, setPicking] = useState<{ req: MinisterRequest; mode: "approve" | "partial" } | null>(null);
  const pending: typeof requests = [];
  void requests; void ministers; void survivors; void families; void decide; void setPicking; void picking;


  return (
    <>
      {pending.length > 0 && (
        <div className="absolute bottom-12 left-2 z-40 w-[320px] max-w-[88vw] space-y-2 pointer-events-auto">
          {pending.slice(0, 3).map((r) => {
            const m = ministers.find((x) => x.id === r.ministerId);
            const s = m ? survivors.find((x) => x.id === m.survivorId) : null;
            if (!m || !s) return null;
            const fam = families.find((f) => f.id === s.familyId);
            return (
              <div key={r.id} className="parchment-panel corner-brackets p-3 shadow-[0_8px_24px_rgba(0,0,0,0.5)]">
                <div className="ranch-label text-[10px] text-amber mb-1">
                  {ROLE_LABEL[r.role]} Request
                </div>
                <div className="ranch-display text-sm text-parchment leading-tight">
                  {s.name} {s.surname}
                  {fam ? <span className="text-[10px] text-dust"> · House {fam.name}</span> : null}
                </div>
                <div className="ranch-handwritten text-[11px] text-dust-light mt-1">
                  "{r.reason}" — asks for {r.requestedWorkers} worker{r.requestedWorkers === 1 ? "" : "s"}.
                </div>
                <div className="flex gap-1 mt-2 flex-wrap">
                  <button
                    onClick={() => setPicking({ req: r, mode: "approve" })}
                    className="btn-ranch btn-ranch-primary text-[10px] flex-1 py-1"
                  >
                    Approve
                  </button>
                  {r.requestedWorkers > 1 && (
                    <button
                      onClick={() => setPicking({ req: r, mode: "partial" })}
                      className="btn-ranch btn-ranch-ghost text-[10px] flex-1 py-1"
                    >
                      Partial
                    </button>
                  )}
                  <button
                    onClick={() => decide(r.id, "postpone")}
                    className="btn-ranch btn-ranch-ghost text-[10px] py-1 px-2"
                  >
                    Later
                  </button>
                  <button
                    onClick={() => decide(r.id, "reject")}
                    className="btn-ranch btn-ranch-ghost text-[10px] py-1 px-2 text-danger"
                  >
                    Reject
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {picking && (
        <WorkerSelectionModal
          request={picking.req}
          mode={picking.mode}
          onCancel={() => setPicking(null)}
          onConfirm={(ids) => {
            decide(picking.req.id, ids.length >= picking.req.requestedWorkers ? "approve" : "partial", ids);
            setPicking(null);
          }}
        />
      )}
    </>
  );
}

function WorkerSelectionModal({
  request, mode, onCancel, onConfirm,
}: {
  request: MinisterRequest;
  mode: "approve" | "partial";
  onCancel: () => void;
  onConfirm: (ids: string[]) => void;
}) {
  const survivors = useGame((s) => s.survivors);
  const families = useGame((s) => s.families);
  const relationships = useGame((s) => s.relationships);
  const ministers = useGame((s) => s.ministers);
  const founderId = useGame((s) => s.founderId);
  const targetOcc = ROLE_OCCUPATION[request.role];
  const max = mode === "approve" ? request.requestedWorkers : request.requestedWorkers;
  const min = mode === "approve" ? request.requestedWorkers : 1;
  const [picked, setPicked] = useState<string[]>([]);

  const taken = new Set(ministers.map((m) => m.survivorId));
  // eligible: alive adult-ish, not the requester, not already in this dept, not a minister.
  const eligible = survivors.filter((s) =>
    s.health > 0 &&
    (s.stage === "adult" || s.stage === "youth" || s.stage === "elder") &&
    s.occupation !== targetOcc &&
    s.occupation !== "leader" &&
    !taken.has(s.id) &&
    s.id !== request.survivorId,
  ).sort((a, b) => {
    // prioritize idle, then by skill match
    const aIdle = a.occupation === "idle" ? 1 : 0;
    const bIdle = b.occupation === "idle" ? 1 : 0;
    if (aIdle !== bIdle) return bIdle - aIdle;
    const skillKey = targetOcc === "farmer" ? "farm"
      : targetOcc === "builder" ? "build"
      : targetOcc === "rancher" ? "ranch"
      : "social";
    return (((b.skills as any)[skillKey]) ?? 1) - (((a.skills as any)[skillKey]) ?? 1);
  });

  function toggle(id: string) {
    setPicked((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= max) return prev;
      return [...prev, id];
    });
  }

  function opinionOf(s: Survivor): number {
    // approximation: founder loyalty
    return Math.round(s.loyaltyToFounder);
  }

  const canConfirm = picked.length >= min && picked.length <= max;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4" onClick={onCancel}>
      <div
        className="parchment-panel corner-brackets max-w-lg w-full p-5 max-h-[85vh] overflow-auto scroll-amber"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="ranch-label text-amber text-[10px]">
          {mode === "approve" ? "Approve" : "Partial Approval"} — {ROLE_LABEL[request.role]}
        </p>
        <h2 className="ranch-display text-xl mt-1">
          Choose {mode === "approve" ? request.requestedWorkers : `up to ${request.requestedWorkers}`} worker{request.requestedWorkers === 1 ? "" : "s"}
        </h2>
        <p className="ranch-handwritten text-[12px] text-dust-light mt-1 italic">
          They will be reassigned to <span className="text-amber">{targetOcc}</span> duties.
        </p>
        <div className="divider-amber my-3" />

        {eligible.length === 0 && (
          <p className="ranch-handwritten text-sm text-dust">No eligible workers to transfer.</p>
        )}
        <div className="space-y-1">
          {eligible.slice(0, 20).map((s) => {
            const fam = families.find((f) => f.id === s.familyId);
            const isPicked = picked.includes(s.id);
            return (
              <button
                key={s.id}
                onClick={() => toggle(s.id)}
                className={`w-full px-2 py-1.5 border text-left transition-colors ${
                  isPicked ? "border-amber bg-amber/10" : "border-amber/20 hover:bg-amber/5"
                }`}
              >
                <div className="flex justify-between items-baseline">
                  <span className="ranch-body text-parchment text-sm">
                    {isPicked ? "✓ " : ""}{s.name} {s.surname}
                    <span className="text-[10px] text-dust"> · age {Math.floor(s.age)}</span>
                  </span>
                  <span className="ranch-data text-[10px] text-amber">{s.occupation}</span>
                </div>
                <div className="ranch-data text-[10px] text-dust mt-0.5 flex gap-3">
                  {fam && <span>House {fam.name}</span>}
                  <span>opinion {opinionOf(s) >= 0 ? "+" : ""}{opinionOf(s)}</span>
                  <span>build {Math.round(s.skills.build ?? 1)}</span>
                  <span>farm {Math.round(s.skills.farm ?? 1)}</span>
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex gap-2 mt-4">
          <button onClick={onCancel} className="btn-ranch btn-ranch-ghost flex-1">Cancel</button>
          <button
            onClick={() => onConfirm(picked)}
            disabled={!canConfirm}
            className={`btn-ranch btn-ranch-primary flex-1 ${canConfirm ? "" : "opacity-50 cursor-not-allowed"}`}
          >
            Confirm ({picked.length}/{max})
          </button>
        </div>
      </div>
    </div>
  );
}
