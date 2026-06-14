import { useMemo, useState } from "react";
import { useGame } from "@/game/store";
import { compatibilityScore, familyApproval, expectedPrestigeDelta, expectedRelationDelta } from "@/game/sim/marriage";
import { findRelationship } from "@/game/sim/ai";
import type { Engine } from "@/game/sim/engine";
import type { Survivor } from "@/game/types";

interface Props {
  initiatorId: string;
  onClose: () => void;
}

export function ArrangeMarriageModal({ initiatorId, onClose }: Props) {
  const survivors = useGame((s) => s.survivors);
  const relationships = useGame((s) => s.relationships);
  const families = useGame((s) => s.families);
  const founderId = useGame((s) => s.founderId);
  const arrange = useGame((s) => s.arrangeMarriage);
  const time = useGame((s) => s.time);
  const [picked, setPicked] = useState<string | null>(null);

  const initiator = survivors.find((s) => s.id === initiatorId);

  const candidates = useMemo(() => {
    if (!initiator) return [] as { c: Survivor; attraction: number; compat: number; approval: number; prestige: number; expP: number; expR: number }[];
    const fakeEng = {
      survivors, relationships, families, founderId, time,
    } as unknown as Engine;
    return survivors
      .filter((s) => s.id !== initiator.id && s.health > 0 && !s.spouseId && !s.fianceId
        && s.gender !== initiator.gender && s.age >= 18
        && !s.parentIds.includes(initiator.id) && !initiator.parentIds.includes(s.id)
        && !s.parentIds.some((p) => initiator.parentIds.includes(p)))
      .map((c) => {
        const fa = families.find((f) => f.id === initiator.familyId);
        const fb = families.find((f) => f.id === c.familyId);
        const rel = findRelationship(relationships, initiator.id, c.id);
        return {
          c,
          attraction: rel ? Math.max(0, Math.round(rel.attraction)) : 0,
          compat: compatibilityScore(initiator, c),
          approval: fa && fb ? familyApproval(fakeEng, initiator, c) : 0,
          prestige: fb ? Math.round(fb.prestige) : 0,
          expP: fa && fb ? expectedPrestigeDelta(fa, fb) : 0,
          expR: fa && fb ? expectedRelationDelta(fa, fb) : 0,
        };
      })
      .sort((a, b) => (b.compat + b.approval) - (a.compat + a.approval))
      .slice(0, 12);
  }, [initiator, survivors, relationships, families, founderId, time]);

  if (!initiator) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-3" onClick={onClose}>
      <div className="parchment-panel corner-brackets w-[560px] max-w-full max-h-[88vh] overflow-auto scroll-amber p-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-baseline justify-between">
          <h3 className="ranch-display text-lg text-amber">Arrange a match for {initiator.name} {initiator.surname}</h3>
          <button onClick={onClose} className="ranch-label text-dust hover:text-amber">close</button>
        </div>
        <p className="ranch-handwritten text-xs text-dust-light mt-1">Choose carefully — Houses remember.</p>
        <div className="divider-amber my-3" />
        {candidates.length === 0 && <p className="ranch-body text-dust text-sm">No eligible candidates on the ranch.</p>}
        <ul className="space-y-1.5">
          {candidates.map(({ c, attraction, compat, approval, prestige, expP, expR }) => {
            const fam = families.find((f) => f.id === c.familyId);
            const sel = picked === c.id;
            return (
              <li key={c.id}>
                <button
                  onClick={() => setPicked(c.id)}
                  className={`w-full text-left parchment-panel-warm p-2 border ${sel ? "border-amber" : "border-amber/20"} hover:border-amber/60`}
                >
                  <div className="flex justify-between items-baseline">
                    <span className="ranch-body text-parchment text-sm">{c.name} <span className="text-amber">{c.surname}</span></span>
                    <span className="ranch-data text-[10px] text-dust">age {Math.floor(c.age)}</span>
                  </div>
                  <div className="ranch-handwritten text-[10px] text-dust mt-0.5">
                    House of <span className="text-amber">{fam?.name ?? "—"}</span> · Prestige {prestige}
                  </div>
                  <div className="grid grid-cols-5 gap-1 mt-1.5 ranch-data text-[9px]">
                    <Cell label="Attr" v={attraction} />
                    <Cell label="Compat" v={compat} />
                    <Cell label="Family" v={approval} signed />
                    <Cell label="+Prest" v={expP} signed />
                    <Cell label="+Relat" v={expR} signed />
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="flex gap-2 mt-3">
          <button
            disabled={!picked}
            onClick={() => {
              if (!picked) return;
              if (arrange(initiator.id, picked)) onClose();
            }}
            className="btn-ranch btn-ranch-primary flex-1 text-xs py-1.5 disabled:opacity-40"
          >
            Arrange this match
          </button>
          <button onClick={onClose} className="btn-ranch btn-ranch-ghost text-xs py-1.5">Cancel</button>
        </div>
      </div>
    </div>
  );
}

function Cell({ label, v, signed }: { label: string; v: number; signed?: boolean }) {
  const tone = v >= 50 ? "text-success" : v >= 20 ? "text-amber" : v >= 0 ? "text-dust" : "text-danger";
  return (
    <div className="border border-amber/15 p-0.5 text-center">
      <div className={`ranch-data ${tone}`}>{signed && v > 0 ? "+" : ""}{Math.round(v)}</div>
      <div className="ranch-label text-[7px] text-dust">{label}</div>
    </div>
  );
}
