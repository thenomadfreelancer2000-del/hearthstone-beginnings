import { useState } from "react";
import { useGame } from "@/game/store";
import {
  ALL_ROLES, ROLE_LABEL, ROLE_BLURB, ROLE_OCCUPATION,
  computeDepartments, suggestMinisterCandidates,
} from "@/game/sim/ministers";
import type { MinisterRole } from "@/game/types";

export function AdministrationPanel({ onClose }: { onClose: () => void }) {
  const survivors = useGame((s) => s.survivors);
  const buildings = useGame((s) => s.buildings);
  const animals = useGame((s) => s.animals);
  const ministers = useGame((s) => s.ministers);
  const reports = useGame((s) => s.ministerReports);
  const founderId = useGame((s) => s.founderId);
  const appointMinister = useGame((s) => s.appointMinister);
  const dismissMinister = useGame((s) => s.dismissMinister);

  const [pickingRole, setPickingRole] = useState<MinisterRole | null>(null);

  const departments = computeDepartments({ survivors, buildings, animals });
  const ministerByRole = new Map(ministers.map((m) => [m.role, m] as const));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="parchment-panel corner-brackets max-w-2xl w-full p-5 max-h-[88vh] overflow-auto scroll-amber"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-baseline justify-between">
          <div>
            <p className="ranch-label text-amber text-[10px]">Administration</p>
            <h2 className="ranch-display text-2xl mt-1">Ministers & Departments</h2>
          </div>
          <button onClick={onClose} className="btn-ranch btn-ranch-ghost text-[10px]">Close</button>
        </div>
        <div className="divider-amber my-3" />

        <div className="space-y-3">
          {ALL_ROLES.map((role) => {
            const dept = departments.find((d) => d.role === role)!;
            const minister = ministerByRole.get(role);
            const survivor = minister ? survivors.find((s) => s.id === minister.survivorId) : null;
            const statusColor =
              dept.status === "understaffed" ? "text-danger"
                : dept.status === "well-staffed" ? "text-success" : "text-amber";

            return (
              <div key={role} className="border border-amber/20 p-3">
                <div className="flex items-baseline justify-between gap-3">
                  <div>
                    <div className="ranch-display text-base text-parchment">{ROLE_LABEL[role]}</div>
                    <div className="ranch-handwritten text-[11px] text-dust-light">{ROLE_BLURB[role]}</div>
                  </div>
                  <div className="ranch-data text-[11px] text-right shrink-0">
                    <div className={statusColor}>
                      {dept.assigned}/{dept.needed} workers
                    </div>
                    <div className="ranch-label text-[9px] text-dust">
                      {dept.status.replace("-", " ")}
                    </div>
                  </div>
                </div>

                {minister && survivor ? (
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <div>
                      <div className="ranch-body text-sm text-parchment">
                        ★ {survivor.name} {survivor.surname}
                      </div>
                      <div className="ranch-data text-[10px] text-dust">
                        Satisfaction <span className="text-amber">{Math.round(minister.satisfaction)}/100</span>
                        {" · "}Approved {minister.requestsApproved} · Rejected {minister.requestsRejected}
                      </div>
                    </div>
                    <button
                      onClick={() => dismissMinister(minister.id)}
                      className="btn-ranch btn-ranch-ghost text-[10px] text-danger"
                    >
                      Dismiss
                    </button>
                  </div>
                ) : (
                  <div className="mt-2">
                    {pickingRole === role ? (
                      <CandidatePicker
                        role={role}
                        onPick={(id) => { appointMinister(role, id); setPickingRole(null); }}
                        onCancel={() => setPickingRole(null)}
                      />
                    ) : (
                      <button
                        onClick={() => setPickingRole(role)}
                        className="btn-ranch btn-ranch-primary text-[10px]"
                      >
                        Appoint Minister
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {reports.length > 0 && (
          <>
            <div className="divider-amber my-4" />
            <p className="ranch-label text-amber text-[10px]">Recent Reports</p>
            <ul className="mt-2 space-y-2">
              {reports.slice(0, 8).map((r) => {
                const m = ministers.find((x) => x.id === r.ministerId);
                const s = m ? survivors.find((x) => x.id === m.survivorId) : null;
                const toneColor = r.tone === "negative" ? "text-danger" : r.tone === "positive" ? "text-success" : "text-amber";
                return (
                  <li key={r.id} className="border border-amber/15 p-2">
                    <div className={`ranch-label text-[9px] ${toneColor}`}>
                      {ROLE_LABEL[r.role]} · Y{r.year} {r.season}
                    </div>
                    <div className="ranch-body text-[12px] text-parchment">
                      {s ? `${s.name} ${s.surname}: ` : ""}{r.text}
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </div>
  );

  function CandidatePicker({
    role, onPick, onCancel,
  }: { role: MinisterRole; onPick: (id: string) => void; onCancel: () => void }) {
    const candidates = suggestMinisterCandidates(role, survivors, ministers, founderId).slice(0, 8);
    if (candidates.length === 0) {
      return (
        <div className="ranch-handwritten text-[11px] text-dust">
          No eligible candidates.{" "}
          <button onClick={onCancel} className="text-amber underline">cancel</button>
        </div>
      );
    }
    const skillKey = role === "head-farmer" ? "farm"
      : role === "head-builder" ? "build"
      : role === "head-rancher" ? "ranch"
      : "lead";
    return (
      <div className="space-y-1">
        <div className="ranch-label text-[9px] text-amber">Choose a Minister</div>
        {candidates.map((c) => {
          const sk = Math.round(((c.skills as any)[skillKey]) ?? 1);
          return (
            <button
              key={c.id}
              onClick={() => onPick(c.id)}
              className="w-full flex justify-between items-center px-2 py-1.5 border border-amber/20 hover:bg-amber/10 text-left"
            >
              <span className="ranch-body text-parchment text-sm">
                {c.name} {c.surname} <span className="text-[10px] text-dust">· age {Math.floor(c.age)}</span>
              </span>
              <span className="ranch-data text-[10px] text-amber">{skillKey} {sk}</span>
            </button>
          );
        })}
        <button onClick={onCancel} className="btn-ranch btn-ranch-ghost text-[10px] mt-1">Cancel</button>
      </div>
    );
  }
}
