import { useMemo, useState } from "react";
import { useGame } from "@/game/store";
import { LAW_CATALOG, DOMAIN_LABEL, type LawDef, type LawDomain } from "@/game/sim/laws";
import { FACTION_DEFS } from "@/game/sim/factions";

const DOMAINS: LawDomain[] = ["property", "justice", "marriage", "hospitality", "labor", "faith"];

export function FoundingCharterModal() {
  const open = useGame((s) => s.pendingFoundingCharter);
  const enact = useGame((s) => s.enactFoundingCharter);
  const survivors = useGame((s) => s.survivors);
  const families = useGame((s) => s.families);
  const [picked, setPicked] = useState<Record<LawDomain, string | null>>({
    property: null, justice: null, marriage: null,
    hospitality: null, labor: null, faith: null,
  });

  if (!open) return null;

  const adults = useMemo(
    () => survivors.filter((s) => s.health > 0 && (s.stage === "adult" || s.stage === "elder" || s.stage === "youth")),
    [survivors],
  );

  const previewReaction = (law: LawDef) => {
    let love = 0, hate = 0, neutral = 0;
    for (const s of adults) {
      let m = 0;
      for (const t of s.traits ?? []) m += law.traitMood[t] ?? 0;
      if (m >= 6) love++;
      else if (m <= -6) hate++;
      else neutral++;
    }
    return { love, hate, neutral };
  };

  const pickedCount = Object.values(picked).filter(Boolean).length;
  const canSign = pickedCount >= 3; // require at least 3 domains chosen

  const sign = () => {
    const ids = Object.values(picked).filter((x): x is string => !!x);
    enact(ids);
  };

  return (
    <div className="absolute inset-0 z-[60] bg-black/80 flex items-center justify-center p-4">
      <div className="parchment-panel-warm corner-brackets w-[min(820px,96vw)] max-h-[94vh] overflow-y-auto p-4 shadow-2xl">
        <div className="ranch-label text-[10px] text-amber">The Founding Charter · Council of Ten</div>
        <div className="ranch-display text-xl text-parchment mt-0.5">
          Set the Laws of the Ranch
        </div>
        <div className="ranch-handwritten text-xs text-dust-light italic mt-1">
          Ten houses sit in the long room. They will not depose the founder today —
          but the laws written now will shape every council that follows.
          Pick one law in at least three domains.
        </div>

        <div className="grid sm:grid-cols-2 gap-3 mt-4">
          {DOMAINS.map((domain) => {
            const laws = LAW_CATALOG.filter((l) => l.domain === domain);
            const chosen = picked[domain];
            return (
              <div key={domain} className="border border-amber/30 bg-coal/40 p-2">
                <div className="ranch-label text-[10px] text-amber mb-1.5">
                  {DOMAIN_LABEL[domain]}
                </div>
                <div className="space-y-1.5">
                  {laws.map((law) => {
                    const isPicked = chosen === law.id;
                    const r = previewReaction(law);
                    return (
                      <button
                        key={law.id}
                        onClick={() =>
                          setPicked((p) => ({ ...p, [domain]: isPicked ? null : law.id }))
                        }
                        className={`w-full text-left border px-2 py-1.5 transition ${
                          isPicked
                            ? "border-amber bg-amber/15"
                            : "border-amber/15 hover:border-amber/40 hover:bg-amber/5"
                        }`}
                      >
                        <div className="flex items-baseline justify-between gap-2">
                          <div className="ranch-display text-sm text-parchment">{law.title}</div>
                          {isPicked && <span className="ranch-label text-[9px] text-amber">★ chosen</span>}
                        </div>
                        <div className="ranch-handwritten text-[10px] text-dust-light italic mt-0.5">
                          {law.blurb}
                        </div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {law.factionLikes.map((f) => (
                            <span key={f} className="ranch-label text-[8px] text-amber border border-amber/40 px-1">
                              + {FACTION_DEFS[f].name}
                            </span>
                          ))}
                          {law.factionHates.map((f) => (
                            <span key={f} className="ranch-label text-[8px] text-danger border border-danger/40 px-1">
                              − {FACTION_DEFS[f].name}
                            </span>
                          ))}
                        </div>
                        <div className="ranch-body text-[10px] text-dust mt-1">
                          <span className="text-amber">{r.love} love</span> · {r.neutral} indifferent · <span className="text-danger">{r.hate} hate</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between mt-4 pt-3 border-t border-amber/20">
          <div className="ranch-handwritten text-xs text-dust-light italic">
            {pickedCount} of 6 domains chosen
            {canSign ? "." : " — pick at least three to sign."}
          </div>
          <button
            disabled={!canSign}
            onClick={sign}
            className={`btn-ranch btn-ranch-primary ${canSign ? "" : "opacity-40 cursor-not-allowed"}`}
          >
            Sign the Charter
          </button>
        </div>
      </div>
    </div>
  );
}
