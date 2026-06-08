import { useGame } from "@/game/store";
import { BUILDINGS } from "@/game/data/content";
import type { Occupation } from "@/game/types";

const OCCUPATIONS: Occupation[] = [
  "idle", "leader", "forager", "woodcutter", "miner", "farmer", "builder", "hauler",
];

export function Inspector() {
  const sel = useGame((s) => s.selection);
  const survivors = useGame((s) => s.survivors);
  const buildings = useGame((s) => s.buildings);
  const relationships = useGame((s) => s.relationships);
  const setOccupation = useGame((s) => s.setOccupation);
  const clearSelection = useGame((s) => s.clearSelection);

  if (sel.kind === "none") {
    return (
      <aside className="parchment-panel w-[320px] p-4 ranch-handwritten text-sm text-dust border-l border-amber/20">
        <p className="ranch-label mb-2">The Ranch</p>
        <p>Click any soul, structure, or tile to read its story.</p>
      </aside>
    );
  }

  if (sel.kind === "survivor") {
    const s = survivors.find((x) => x.id === sel.id);
    if (!s) return null;
    const rels = relationships.filter((r) => r.a === s.id || r.b === s.id);
    return (
      <aside className="parchment-panel w-[320px] p-4 border-l border-amber/20 overflow-auto scroll-amber">
        <button onClick={clearSelection} className="ranch-label hover:text-amber">← Deselect</button>
        <h3 className="ranch-display text-2xl mt-3 leading-tight">
          {s.name} <span className="text-amber">{s.surname}</span>
        </h3>
        <p className="ranch-handwritten text-sm mt-1">
          {s.isFounder ? "Founder · " : ""}{cap(s.stage)} · {cap(s.background)} · age {s.age}
        </p>
        <div className="divider-amber my-3" />
        <p className="ranch-body italic text-dust-light">{s.action}</p>
        <p className="ranch-data mt-2 text-xs">
          State: <span className="text-amber">{s.state}</span>
          {s.carrying && <> · Carrying {s.carrying.amount} {s.carrying.resource}</>}
        </p>

        <h4 className="ranch-label mt-5 mb-2">Needs</h4>
        <NeedBar label="Food" v={s.needs.food} />
        <NeedBar label="Water" v={s.needs.water} />
        <NeedBar label="Rest" v={s.needs.rest} />
        <NeedBar label="Shelter" v={s.needs.shelter} />
        <NeedBar label="Belonging" v={s.needs.belonging} />
        <NeedBar label="Purpose" v={s.needs.purpose} />
        <NeedBar label="Health" v={s.health} warn />

        <h4 className="ranch-label mt-5 mb-2">Traits</h4>
        <div className="flex flex-wrap gap-1">
          {s.traits.map((t) => (
            <span key={t} className="ranch-label text-[10px] border border-amber/40 px-2 py-0.5 text-parchment">
              {t}
            </span>
          ))}
        </div>

        <h4 className="ranch-label mt-5 mb-2">Values</h4>
        <p className="ranch-body text-sm">{s.values.join(" · ")}</p>

        <h4 className="ranch-label mt-5 mb-2">Occupation</h4>
        <div className="grid grid-cols-2 gap-1">
          {OCCUPATIONS.map((o) => (
            <button
              key={o}
              onClick={() => setOccupation(s.id, o)}
              className={`btn-ranch text-[10px] py-1 ${s.occupation === o ? "btn-ranch-primary" : ""}`}
            >
              {o}
            </button>
          ))}
        </div>

        {rels.length > 0 && (
          <>
            <h4 className="ranch-label mt-5 mb-2">Relationships</h4>
            <div className="space-y-1">
              {rels.slice(0, 8).map((r) => {
                const otherId = r.a === s.id ? r.b : r.a;
                const other = survivors.find(o => o.id === otherId);
                if (!other) return null;
                return (
                  <div key={otherId} className="flex justify-between text-sm">
                    <span className="ranch-body">{other.name} {other.surname}</span>
                    <span className="ranch-label text-[10px] text-amber">{r.tag} · {Math.round(r.affection)}</span>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {s.memories.length > 0 && (
          <>
            <h4 className="ranch-label mt-5 mb-2">Memories</h4>
            <ul className="space-y-1">
              {s.memories.slice(0, 6).map((m) => (
                <li key={m.id} className="ranch-handwritten text-xs text-dust-light">
                  · {m.text}
                </li>
              ))}
            </ul>
          </>
        )}
      </aside>
    );
  }

  if (sel.kind === "building") {
    const b = buildings.find((x) => x.id === sel.id);
    if (!b) return null;
    const def = BUILDINGS[b.kind];
    return (
      <aside className="parchment-panel w-[320px] p-4 border-l border-amber/20">
        <button onClick={clearSelection} className="ranch-label hover:text-amber">← Deselect</button>
        <h3 className="ranch-display text-2xl mt-3">{def.name}</h3>
        <p className="ranch-handwritten text-sm">{def.blurb}</p>
        <div className="divider-amber my-3" />
        <p className="ranch-data text-xs">
          {b.builtProgress < 1 ? (
            <>Under construction · {Math.round(b.builtProgress * 100)}% · Effort left {Math.ceil(b.effortRemaining)}</>
          ) : (
            <>Complete</>
          )}
        </p>
        {def.housingCapacity > 0 && (
          <p className="ranch-data text-xs mt-1">Houses up to {def.housingCapacity}</p>
        )}
        {def.storageCapacity > 0 && (
          <p className="ranch-data text-xs mt-1">Storage capacity {def.storageCapacity}</p>
        )}
        {def.produces && (
          <p className="ranch-data text-xs mt-1">Produces {def.produces.perDay} {def.produces.resource}/day</p>
        )}
      </aside>
    );
  }

  return null;
}

function NeedBar({ label, v, warn }: { label: string; v: number; warn?: boolean }) {
  const crit = v < 25;
  return (
    <div className="mb-1.5">
      <div className="flex justify-between ranch-label text-[9px]">
        <span>{label}</span>
        <span className={crit && warn ? "text-danger" : "text-amber"}>{Math.round(v)}</span>
      </div>
      <div className="h-1 bg-coal border border-amber/15">
        <div
          className={`h-full ${crit ? "bg-danger" : "bg-amber"}`}
          style={{ width: `${Math.max(0, Math.min(100, v))}%` }}
        />
      </div>
    </div>
  );
}

function cap(s: string) {
  return s[0].toUpperCase() + s.slice(1);
}
