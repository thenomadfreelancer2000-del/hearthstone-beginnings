import { useMemo } from "react";
import { useGame } from "@/game/store";
import { computeFactions, type FactionSnapshot } from "@/game/sim/factions";
import { LAW_BY_ID } from "@/game/sim/laws";

export function FactionsPanel({ onClose }: { onClose: () => void }) {
  const survivors = useGame((s) => s.survivors);
  const families = useGame((s) => s.families);
  const laws = useGame((s) => s.laws);

  const view = useMemo(
    () => computeFactions(survivors, families, laws),
    [survivors, families, laws],
  );

  return (
    <div className="absolute inset-0 z-50 bg-black/60 flex items-stretch justify-end">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative parchment-panel-warm corner-brackets w-[min(600px,96vw)] h-full overflow-y-auto p-4 shadow-2xl">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="ranch-display text-lg text-amber">Political Factions</div>
            <div className="ranch-handwritten text-[11px] text-dust-light italic">
              Who pulls which way in the long room.
            </div>
          </div>
          <button className="btn-ranch btn-ranch-ghost text-xs" onClick={onClose}>Close ✕</button>
        </div>

        {laws.length === 0 && (
          <div className="border border-amber/25 bg-coal/40 p-2 mb-3 ranch-handwritten text-xs text-dust-light italic">
            No laws have been written yet. Factions form around traits even without law —
            once the Founding Charter is signed, their stances will sharpen.
          </div>
        )}

        <div className="mb-3 border border-amber/20 bg-coal/40 p-2">
          <div className="ranch-label text-[10px] text-amber mb-1">Active Laws ({laws.length})</div>
          {laws.length === 0 ? (
            <div className="ranch-body text-xs text-dust">— none enacted —</div>
          ) : (
            <ul className="space-y-0.5">
              {laws.map((l) => {
                const def = LAW_BY_ID[l.lawId];
                return (
                  <li key={l.id} className="ranch-body text-[11px] text-parchment">
                    · {def?.title ?? l.lawId}
                    <span className="text-dust ml-1 text-[10px]">— since Y{l.yearEnacted}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="space-y-2">
          {view.factions.map((f) => <FactionCard key={f.id} f={f} />)}
        </div>
      </div>
    </div>
  );
}

function FactionCard({ f }: { f: FactionSnapshot }) {
  const tone =
    f.netLawSentiment >= 10 ? "text-amber" :
    f.netLawSentiment <= -10 ? "text-danger" : "text-dust-light";
  const barColor =
    f.strength >= 60 ? "bg-amber" : f.strength >= 25 ? "bg-amber/70" : "bg-amber/30";

  return (
    <div className="border border-amber/30 bg-coal/50 p-2">
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

      <div className="grid grid-cols-3 gap-1 mt-2 text-center">
        <Cell label="Members" value={f.members} />
        <Cell label="Sympathizers" value={f.sympathizers} />
        <Cell label="Houses" value={f.leadingHouseNames.length} />
      </div>

      <div className="ranch-body text-[11px] text-dust-light mt-2">
        Agenda: <span className="text-parchment">{f.def.agenda}</span>
      </div>
      {f.leaderName && (
        <div className="ranch-body text-[11px] text-dust-light">
          Led by: <span className="text-parchment">{f.leaderName}</span>
          {f.leadingHouseNames[0] && <> of House {f.leadingHouseNames[0]}</>}
        </div>
      )}
      {f.leadingHouseNames.length > 0 && (
        <div className="ranch-body text-[10px] text-dust mt-0.5">
          Backed by: {f.leadingHouseNames.map((n) => `House ${n}`).join(", ")}
        </div>
      )}

      {(f.lovedLaws.length > 0 || f.hatedLaws.length > 0) && (
        <div className="mt-2 border-t border-amber/15 pt-1.5">
          <div className={`ranch-label text-[9px] ${tone} mb-1`}>
            Law sentiment: {f.netLawSentiment >= 0 ? "+" : ""}{f.netLawSentiment}
          </div>
          {f.lovedLaws.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-1">
              {f.lovedLaws.map((l) => (
                <span key={l.lawId} className="ranch-label text-[9px] text-amber border border-amber/40 px-1">
                  ♥ {l.title}
                </span>
              ))}
            </div>
          )}
          {f.hatedLaws.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {f.hatedLaws.map((l) => (
                <span key={l.lawId} className="ranch-label text-[9px] text-danger border border-danger/40 px-1">
                  ✘ {l.title}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Cell({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-amber/15 p-1">
      <div className="ranch-data text-sm text-parchment">{value}</div>
      <div className="ranch-label text-[8px] text-dust">{label}</div>
    </div>
  );
}
