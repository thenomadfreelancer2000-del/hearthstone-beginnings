import { useGame } from "@/game/store";
import { BUILDINGS } from "@/game/data/content";
import { opinionLabel, opinionScore } from "@/game/sim/ai";
import type { Occupation, Relationship, Survivor } from "@/game/types";

const OCCUPATIONS: Occupation[] = [
  "idle", "leader", "forager", "woodcutter", "miner", "farmer", "builder", "hauler",
];

function cap(s: string) { return s[0].toUpperCase() + s.slice(1); }

export function Inspector() {
  const sel = useGame((s) => s.selection);
  const survivors = useGame((s) => s.survivors);
  const buildings = useGame((s) => s.buildings);
  const relationships = useGame((s) => s.relationships);
  const families = useGame((s) => s.families);
  const currentLeaderId = useGame((s) => s.currentLeaderId);
  const founderId = useGame((s) => s.founderId);
  const setOccupation = useGame((s) => s.setOccupation);
  const clearSelection = useGame((s) => s.clearSelection);
  const selectSurvivor = useGame((s) => s.selectSurvivor);
  const setOverlay = useGame((s) => s.setOverlay);

  if (sel.kind === "none") {
    return (
      <aside className="parchment-panel w-full sm:w-[340px] p-4 ranch-handwritten text-sm text-dust border-l border-amber/20">
        <p className="ranch-label mb-2">The Ranch</p>
        <p>Click any soul, structure, or tile to read its story.</p>
        <div className="divider-amber my-4" />
        <button onClick={() => setOverlay("tree")} className="btn-ranch btn-ranch-ghost w-full">
          Open the Dynasty
        </button>
      </aside>
    );
  }

  if (sel.kind === "survivor") {
    const s = survivors.find((x) => x.id === sel.id);
    if (!s) return null;
    const rels = relationships.filter((r) => r.a === s.id || r.b === s.id);
    const fam = families.find(f => f.id === s.familyId);
    const spouse = s.spouseId ? survivors.find(x => x.id === s.spouseId) : null;
    const parents = s.parentIds.map(id => survivors.find(x => x.id === id)).filter(Boolean) as Survivor[];
    const children = s.childrenIds.map(id => survivors.find(x => x.id === id)).filter(Boolean) as Survivor[];
    const isLeader = s.id === currentLeaderId;
    const isDead = s.health <= 0;

    return (
      <aside className="parchment-panel w-full sm:w-[340px] p-4 border-l border-amber/20 overflow-auto scroll-amber">
        <button onClick={clearSelection} className="ranch-label hover:text-amber">← Deselect</button>
        <h3 className="ranch-display text-2xl mt-3 leading-tight">
          {s.name} <span className="text-amber">{s.surname}</span>
        </h3>
        <p className="ranch-handwritten text-sm mt-1">
          {s.isFounder ? "★ Founder · " : isLeader ? "◆ Leader · " : ""}
          {cap(s.stage)} · {cap(s.background)} · age {Math.floor(s.age)}
          {isDead && <span className="text-danger"> · Deceased Y{s.deathYear}</span>}
        </p>
        {fam && (
          <p className="ranch-data text-[10px] mt-1">
            House of <button onClick={() => setOverlay("tree")} className="text-amber hover:underline">{fam.name}</button>
            <span className="text-dust"> · Prestige {Math.round(fam.prestige)}</span>
            <span className="text-dust"> · Gen {s.generation + 1}</span>
          </p>
        )}
        <div className="divider-amber my-3" />
        {!isDead && (
          <>
            <p className="ranch-body italic text-dust-light">{s.action}</p>
            <p className="ranch-data mt-2 text-xs">
              State: <span className="text-amber">{s.state}</span>
              {s.carrying && <> · Carrying {s.carrying.amount} {s.carrying.resource}</>}
            </p>
          </>
        )}

        {/* Kin */}
        {(spouse || parents.length > 0 || children.length > 0) && (
          <>
            <h4 className="ranch-label mt-5 mb-2">Kin</h4>
            <div className="space-y-1 text-sm">
              {spouse && (
                <KinRow label="Spouse" who={spouse} onClick={() => selectSurvivor(spouse.id)} />
              )}
              {parents.map(p => (
                <KinRow key={p.id} label="Parent" who={p} onClick={() => selectSurvivor(p.id)} />
              ))}
              {children.map(c => (
                <KinRow key={c.id} label="Child" who={c} onClick={() => selectSurvivor(c.id)} />
              ))}
            </div>
          </>
        )}

        {!isDead && (
          <>
            <h4 className="ranch-label mt-5 mb-2">Needs</h4>
            <NeedBar label="Food" v={s.needs.food} />
            <NeedBar label="Water" v={s.needs.water} />
            <NeedBar label="Rest" v={s.needs.rest} />
            <NeedBar label="Shelter" v={s.needs.shelter} />
            <NeedBar label="Belonging" v={s.needs.belonging} />
            <NeedBar label="Purpose" v={s.needs.purpose} />
            <NeedBar label="Health" v={s.health} warn />
          </>
        )}

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

        {s.achievements && s.achievements.length > 0 && (
          <>
            <h4 className="ranch-label mt-5 mb-2">Legacy</h4>
            <ul className="ranch-handwritten text-sm space-y-0.5 text-parchment">
              {s.achievements.map((a, i) => <li key={i}>· {a}</li>)}
            </ul>
          </>
        )}

        {!isDead && s.stage !== "child" && s.stage !== "teen" && (
          <>
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
          </>
        )}

        {rels.length > 0 && (
          <>
            <h4 className="ranch-label mt-5 mb-2">Relationships</h4>
            <div className="space-y-1.5">
              {rels.slice(0, 10).map((r) => {
                const otherId = r.a === s.id ? r.b : r.a;
                const other = survivors.find(o => o.id === otherId);
                if (!other) return null;
                return <RelRow key={otherId} r={r} other={other} onClick={() => selectSurvivor(other.id)} />;
              })}
            </div>
          </>
        )}

        {s.id === currentLeaderId && !isDead && (
          <HeirPanel leader={s} />
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

        {s.id === founderId && (
          <p className="ranch-handwritten text-[11px] text-dust mt-5 italic">
            The first name in the Chronicle. Their legacy continues whether they live or not.
          </p>
        )}
      </aside>
    );
  }

  if (sel.kind === "building") {
    const b = buildings.find((x) => x.id === sel.id);
    if (!b) return null;
    const def = BUILDINGS[b.kind];
    const builder = b.assignedBuilderId ? survivors.find(s => s.id === b.assignedBuilderId) : null;
    const openAssign = () => useGame.setState({ pendingBuildAssignment: b.id });
    return (
      <aside className="parchment-panel w-full sm:w-[340px] p-4 border-l border-amber/20 overflow-auto scroll-amber">
        <button onClick={clearSelection} className="ranch-label hover:text-amber">← Deselect</button>
        <h3 className="ranch-display text-2xl mt-3">{def.name}</h3>
        <p className="ranch-handwritten text-sm">{def.blurb}</p>
        <div className="divider-amber my-3" />
        {b.builtProgress < 1 ? (
          <>
            <div className="flex justify-between ranch-label text-[10px] text-amber mb-1">
              <span>Construction</span>
              <span>{Math.round(b.builtProgress * 100)}%</span>
            </div>
            <div className="h-1.5 bg-coal border border-amber/20 mb-2">
              <div className="h-full bg-amber" style={{ width: `${Math.round(b.builtProgress * 100)}%` }} />
            </div>
            <p className="ranch-data text-[10px] text-dust mb-3">
              {Math.ceil(b.effortRemaining)} / {Math.max(1, b.buildEffortTotal)} effort remaining
            </p>
            <div className="ranch-label text-[10px] text-amber mb-1">Assigned builder</div>
            {builder ? (
              <button
                onClick={() => selectSurvivor(builder.id)}
                className="w-full text-left ranch-body text-parchment text-sm hover:text-amber mb-2"
              >
                {builder.isFounder && "★ "}{builder.name} {builder.surname}
                <span className="ranch-data text-[10px] text-dust ml-2">
                  Build {Math.round(builder.skills.build ?? 1)}
                </span>
              </button>
            ) : (
              <p className="ranch-handwritten text-xs text-dust-light mb-2">
                No one assigned — anyone idle will pitch in.
              </p>
            )}
            <button onClick={openAssign} className="btn-ranch btn-ranch-ghost w-full text-[10px]">
              {builder ? "Reassign builder" : "Assign builder"}
            </button>
          </>
        ) : (
          <p className="ranch-data text-xs text-success">Complete · year {b.completedYear ?? "—"}</p>
        )}
        <div className="divider-amber my-3" />
        <div className="ranch-data text-[10px] text-dust space-y-0.5">
          <div>
            <span className="ranch-label text-amber mr-1">Built from:</span>
            {Object.entries(def.cost).map(([r, a]) => `${a} ${r}`).join(" · ") || "free"}
          </div>
          {def.housingCapacity > 0 && <div>Houses up to {def.housingCapacity}</div>}
          {def.storageCapacity > 0 && <div>Storage capacity {def.storageCapacity}</div>}
          {def.produces && <div>Produces {def.produces.perDay} {def.produces.resource}/day</div>}
        </div>
      </aside>
    );
  }

  return null;
}

function KinRow({ label, who, onClick }: { label: string; who: Survivor; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full flex justify-between hover:bg-amber/5 px-1 py-0.5 text-left">
      <span className="ranch-label text-[9px] text-amber w-16">{label}</span>
      <span className="ranch-body flex-1 text-parchment">{who.name} {who.surname}</span>
      <span className="ranch-data text-[10px] text-dust">
        {who.health <= 0 ? "†" : Math.floor(who.age)}
      </span>
    </button>
  );
}

function RelRow({ r, other, onClick }: { r: Relationship; other: Survivor; onClick: () => void }) {
  const tagColor = r.tag === "spouse" ? "text-family"
    : r.tag === "kin" ? "text-amber-light"
    : r.tag === "close-friend" ? "text-success"
    : r.tag === "friend" ? "text-amber"
    : r.tag === "rival" ? "text-warning"
    : r.tag === "enemy" ? "text-danger"
    : "text-dust";
  return (
    <button onClick={onClick} className="w-full text-left hover:bg-amber/5 px-1 py-0.5">
      <div className="flex justify-between text-sm">
        <span className="ranch-body text-parchment">{other.name} {other.surname}</span>
        <span className={`ranch-label text-[10px] ${tagColor}`}>{r.tag}</span>
      </div>
      <div className="flex gap-2 ranch-data text-[9px] text-dust mt-0.5">
        <span>aff {Math.round(r.affection)}</span>
        <span>trust {Math.round(r.trust)}</span>
        <span>resp {Math.round(r.respect)}</span>
        {r.attraction > 10 && <span className="text-rust-light">♥ {Math.round(r.attraction)}</span>}
      </div>
    </button>
  );
}

function HeirPanel({ leader }: { leader: Survivor }) {
  const survivors = useGame((s) => s.survivors);
  const founderId = useGame((s) => s.founderId);
  const selectSurvivor = useGame((s) => s.selectSurvivor);

  const isDescendantOfFounder = (s: Survivor): boolean => {
    if (s.id === founderId) return true;
    if (!s.parentIds.length) return false;
    return s.parentIds.some(pid => {
      const p = survivors.find(x => x.id === pid);
      return p ? isDescendantOfFounder(p) : false;
    });
  };

  const candidates = survivors
    .filter(s => s.health > 0 && s.id !== leader.id && (s.stage === "adult" || s.stage === "elder"))
    .sort((a, b) => {
      const da = isDescendantOfFounder(a) ? 0 : 1;
      const db = isDescendantOfFounder(b) ? 0 : 1;
      if (da !== db) return da - db;
      return b.age - a.age;
    })
    .slice(0, 3);

  return (
    <div className="parchment-panel-warm corner-brackets p-3 mt-5">
      <h4 className="ranch-label mb-2">Line of Succession</h4>
      {candidates.length === 0 ? (
        <p className="ranch-handwritten text-xs text-dust-light">
          No heir of age yet. If the leader falls now, the dynasty falls quiet.
        </p>
      ) : (
        <ol className="space-y-1">
          {candidates.map((c, i) => (
            <li key={c.id}>
              <button onClick={() => selectSurvivor(c.id)} className="w-full text-left hover:bg-amber/5 px-1 py-0.5">
                <span className="ranch-data text-[10px] text-amber mr-2">{i + 1}.</span>
                <span className="ranch-body text-sm text-parchment">{c.name} {c.surname}</span>
                <span className="ranch-data text-[10px] text-dust ml-2">
                  {isDescendantOfFounder(c) ? "of the line" : "by oath"} · age {Math.floor(c.age)}
                </span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
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
