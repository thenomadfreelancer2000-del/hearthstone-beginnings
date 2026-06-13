import { useGame } from "@/game/store";
import { BUILDINGS } from "@/game/data/content";
import { opinionLabel, opinionScore } from "@/game/sim/ai";
import {
  constructionEffortCompleted,
  constructionStatus,
  missingConstructionResources,
  requiredConstructionResources,
} from "@/game/sim/construction";
import { CROPS, expectedYield, growthRateMultiplier, skillTierLabel, type CropId } from "@/game/data/crops";
import { computeHousingSatisfaction, homeCapacity, homeQuality, isResidential } from "@/game/sim/housing";
import { BUILDINGS as BUILDINGS_DATA } from "@/game/data/content";
import type { Building, Occupation, Relationship, Survivor } from "@/game/types";

const OCCUPATIONS: Occupation[] = [
  "idle", "forager", "woodcutter", "miner", "farmer", "builder", "hauler",
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

        {/* Housing */}
        {!isDead && <SurvivorHousingPanel s={s} />}



        {!isDead && (
          <>
            <h4 className="ranch-label mt-5 mb-2">Needs</h4>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1">
              <NeedBar label="Food" v={s.needs.food} />
              <NeedBar label="Water" v={s.needs.water} />
              <NeedBar label="Rest" v={s.needs.rest} />
              <NeedBar label="Shelter" v={s.needs.shelter} />
              <NeedBar label="Belonging" v={s.needs.belonging} />
              <NeedBar label="Purpose" v={s.needs.purpose} />
              <NeedBar label="Health" v={s.health} warn />
            </div>
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

        <h4 className="ranch-label mt-5 mb-2">Skills</h4>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 ranch-data text-[10px]">
          <SkillRow label="Building" v={s.skills.build} />
          <SkillRow label="Farming" v={s.skills.farm} />
          <SkillRow label="Gathering" v={s.skills.forage} />
          <SkillRow label="Cutting" v={s.skills.cut} />
          <SkillRow label="Mining" v={s.skills.mine} />
          <SkillRow label="Medicine" v={s.skills.medic} />
          <SkillRow label="Leadership" v={s.skills.lead} />
          <SkillRow label="Social" v={s.skills.social ?? 1} />
        </div>

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
              {[...rels]
                .sort((a, b) => Math.abs(opinionScore(b)) - Math.abs(opinionScore(a)))
                .slice(0, 24)
                .map((r) => {
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
    const debugBuilding = { ...b, resourcesDelivered: { ...(b.resourcesDelivered ?? {}) } };
    const missing = missingConstructionResources(debugBuilding);
    const required = requiredConstructionResources(debugBuilding);
    const completedEffort = constructionEffortCompleted(debugBuilding);
    const status = constructionStatus(debugBuilding, survivors);
    const assignedTask = builder?.workTarget?.kind === "building" && builder.workTarget.id === b.id
      ? builder.action
      : builder?.action ?? "No active task";
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
            <div className="parchment-panel-warm corner-brackets p-3 mb-3">
              <div className="flex justify-between ranch-label text-[10px] mb-2">
                <span className="text-amber">Construction Status</span>
                <span className={status === "Completed" ? "text-success" : status === "Waiting For Resources" ? "text-warning" : "text-parchment"}>
                  {status}
                </span>
              </div>
              <DebugRow label="Assigned Builder" value={builder ? `${builder.name} ${builder.surname}` : "Anyone available"} />
              <DebugRow label="Current Task" value={assignedTask} />
              <DebugRow label="Progress" value={`${Math.round(b.builtProgress * 100)}%`} />
              <DebugRow label="Effort Completed" value={`${Math.floor(completedEffort)} / ${Math.max(1, b.buildEffortTotal)}`} />
              <DebugRow label="Effort Required" value={`${Math.max(1, b.buildEffortTotal)}`} />
              <DebugRow label="Resources Delivered" value={formatResourceList(debugBuilding.resourcesDelivered)} />
              <DebugRow label="Resources Missing" value={formatResourceList(missing)} warn={Object.keys(missing).length > 0} />
              <DebugRow label="Resources Required" value={formatResourceList(required)} />
            </div>
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
        {b.kind === "farm-plot" && b.builtProgress >= 1 && <FarmPanel b={b} />}
        {isResidential(b.kind) && b.builtProgress >= 1 && <ResidentialPanel b={b} />}
        {b.builtProgress >= 1 && !isResidential(b.kind) && b.kind !== "farm-plot" && b.kind !== "fence" && (
          <WorkerPanel b={b} />
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

  if (sel.kind === "tile") {
    return <TilePanel x={sel.x} y={sel.y} />;
  }

  return null;
}

function WorkerPanel({ b }: { b: Building }) {
  const survivors = useGame((g) => g.survivors);
  const assignWorker = useGame((g) => g.assignWorker);
  const selectSurvivor = useGame((g) => g.selectSurvivor);
  const worker = b.assignedWorkerId ? survivors.find(s => s.id === b.assignedWorkerId) : null;
  const eligible = survivors.filter(s =>
    s.health > 0 && (s.stage === "adult" || s.stage === "youth" || s.stage === "elder" || s.isFounder)
  );
  return (
    <div className="parchment-panel-warm corner-brackets p-3 mt-3">
      <div className="ranch-label text-[10px] text-amber mb-1">Assigned Worker</div>
      {worker ? (
        <button onClick={() => selectSurvivor(worker.id)} className="ranch-body text-sm text-parchment hover:text-amber">
          {worker.isFounder && "★ "}{worker.name} {worker.surname}
          <span className="ranch-data text-[10px] text-dust ml-2">{worker.occupation}</span>
        </button>
      ) : (
        <p className="ranch-handwritten text-xs text-dust-light">No one assigned — anyone idle may pitch in.</p>
      )}
      <select
        className="w-full bg-coal border border-amber/30 text-parchment text-xs px-2 py-1 mt-2"
        value={b.assignedWorkerId ?? ""}
        onChange={(e) => assignWorker(b.id, e.target.value || null)}
      >
        <option value="">— Unassigned —</option>
        {eligible.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name} {s.surname} ({s.occupation})
          </option>
        ))}
      </select>
    </div>
  );
}

function TilePanel({ x, y }: { x: number; y: number }) {
  const tiles = useGame((g) => g.tiles);
  const mapW = useGame((g) => g.mapW);
  const nodes = useGame((g) => g.nodes);
  const survivors = useGame((g) => g.survivors);
  const clearSelection = useGame((g) => g.clearSelection);
  const assignToNode = useGame((g) => g.assignToNode);
  const selectSurvivor = useGame((g) => g.selectSurvivor);
  const tile = tiles[y * mapW + x];
  const node = nodes.find(n => Math.floor(n.x) === x && Math.floor(n.y) === y);
  const eligible = survivors.filter(s =>
    s.health > 0 && (s.stage === "adult" || s.stage === "youth" || s.stage === "elder" || s.isFounder)
  );
  return (
    <aside className="parchment-panel w-full sm:w-[340px] p-4 border-l border-amber/20 overflow-auto scroll-amber">
      <button onClick={clearSelection} className="ranch-label hover:text-amber">← Deselect</button>
      <h3 className="ranch-display text-2xl mt-3">{tile ? cap(tile.kind.replace("-", " ")) : "Tile"}</h3>
      <p className="ranch-handwritten text-sm text-dust-light">Tile ({x}, {y})</p>
      <div className="divider-amber my-3" />
      {node ? (
        <div className="parchment-panel-warm corner-brackets p-3">
          <div className="ranch-label text-[10px] text-amber mb-1">{cap(node.kind)}</div>
          <div className="ranch-data text-[10px] text-dust mb-2">
            Yields <span className="text-parchment">{node.yields}</span> · {Math.floor(node.amount)} / {node.max} remaining
          </div>
          <div className="ranch-label text-[10px] text-amber mb-1">
            Assign {node.kind === "trees" ? "Cutter" : node.kind === "rocks" ? "Miner" : "Forager"}
          </div>
          <select
            className="w-full bg-coal border border-amber/30 text-parchment text-xs px-2 py-1"
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) {
                assignToNode(node.id, e.target.value);
                selectSurvivor(e.target.value);
              }
              e.currentTarget.value = "";
            }}
          >
            <option value="">— Pick a survivor —</option>
            {eligible.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} {s.surname} ({s.occupation})
              </option>
            ))}
          </select>
          <p className="ranch-handwritten text-[10px] text-dust mt-2">
            They'll change occupation and begin gathering from this kind of node.
          </p>
        </div>
      ) : (
        <p className="ranch-handwritten text-xs text-dust-light">Nothing to harvest here.</p>
      )}
    </aside>
  );
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
  const score = opinionScore(r);
  const label = opinionLabel(score, r.tag);
  const labelColor =
    label === "Spouse" ? "text-family" :
    label === "Kin" ? "text-amber-light" :
    label === "Best Friend" ? "text-success" :
    label === "Friend" ? "text-amber" :
    label === "Acquaintance" ? "text-dust-light" :
    label === "Neutral" ? "text-dust" :
    label === "Dislikes" ? "text-warning" :
    label === "Rival" ? "text-warning" :
    "text-danger";
  const scoreColor = score >= 40 ? "text-success" : score >= 10 ? "text-amber" : score > -10 ? "text-dust" : "text-danger";
  return (
    <button onClick={onClick} className="w-full text-left hover:bg-amber/5 px-1 py-0.5">
      <div className="flex justify-between items-baseline text-sm">
        <span className="ranch-body text-parchment">{other.name} {other.surname}</span>
        <span className={`ranch-label text-[10px] ${labelColor}`}>{label}</span>
      </div>
      <div className="flex justify-between gap-2 ranch-data text-[9px] text-dust mt-0.5">
        <span>
          <span className={scoreColor}>{score > 0 ? "+" : ""}{Math.round(score)}</span>
          <span className="ml-2">trust {Math.round(r.trust)}</span>
          <span className="ml-2">resp {Math.round(r.respect)}</span>
        </span>
        {r.attraction > 10 && <span className="text-rust-light">♥ {Math.round(r.attraction)}</span>}
      </div>
    </button>
  );
}

function SkillRow({ label, v }: { label: string; v: number }) {
  const rounded = Math.round(v ?? 1);
  const tier = rounded >= 20 ? "text-success" : rounded >= 10 ? "text-amber" : "text-dust-light";
  return (
    <div className="flex justify-between">
      <span className="ranch-label text-dust">{label}</span>
      <span className={tier}>{rounded}</span>
    </div>
  );
}

function formatResourceList(resources?: Partial<Record<string, number>>) {
  const entries = Object.entries(resources ?? {}).filter(([, amount]) => (amount ?? 0) > 0);
  if (entries.length === 0) return "None";
  return entries.map(([resource, amount]) => `${Math.ceil(amount ?? 0)} ${resource}`).join(" · ");
}

function DebugRow({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="flex justify-between gap-3 ranch-data text-[9px] py-0.5 border-b border-amber/10 last:border-b-0">
      <span className="text-dust shrink-0">{label}</span>
      <span className={`text-right ${warn ? "text-warning" : "text-parchment"}`}>{value}</span>
    </div>
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




function FarmPanel({ b }: { b: Building }) {
  const survivors = useGame((s) => s.survivors);
  const unlockedCrops = useGame((s) => s.unlockedCrops);
  const setFarmCrop = useGame((s) => s.setFarmCrop);
  const assignFarmer = useGame((s) => s.assignFarmer);
  const selectSurvivor = useGame((s) => s.selectSurvivor);
  const farm = b.farm;
  if (!farm) return null;
  const crop = CROPS[farm.cropId as CropId] ?? CROPS.corn;
  const farmer = farm.assignedFarmerId
    ? survivors.find(s => s.id === farm.assignedFarmerId)
    : null;
  const skill = Math.round(farmer?.skills.farm ?? 0);
  const yieldEst = expectedYield(crop, skill);
  const rate = growthRateMultiplier(skill);
  const daysLeft = farm.stage === "growing"
    ? Math.max(0, Math.ceil((1 - farm.growth) * crop.growthDays / Math.max(0.1, rate)))
    : farm.stage === "mature" ? 0 : crop.growthDays;
  const stageLabel = farm.stage === "empty" ? "Empty Field"
    : farm.stage === "growing" ? `${crop.name} – ${Math.round(farm.growth * 100)}% Grown`
    : farm.stage === "mature" ? "Ready to Harvest"
    : farm.stage;
  const eligible = survivors.filter(s =>
    s.health > 0 && (s.stage === "adult" || s.stage === "youth" || s.stage === "elder" || s.isFounder)
  ).sort((a, c) => (c.skills.farm ?? 1) - (a.skills.farm ?? 1));

  return (
    <div className="parchment-panel-warm corner-brackets p-3 mt-3">
      <div className="ranch-label text-[10px] text-amber mb-1">Farm Plot</div>
      <div className="ranch-display text-lg text-parchment">{crop.name}</div>
      <div className="ranch-handwritten text-xs text-dust-light mb-2">{stageLabel}</div>
      {farm.stage === "growing" && (
        <div className="h-1.5 bg-coal border border-amber/20 mb-2">
          <div className="h-full" style={{ width: `${Math.round(farm.growth * 100)}%`, background: crop.color }} />
        </div>
      )}
      <div className="ranch-data text-[10px] text-dust space-y-0.5 mb-2">
        <div>Farmer: <span className="text-parchment">{farmer ? `${farmer.name} ${farmer.surname}` : "Unassigned"}</span></div>
        <div>Farmer skill: <span className="text-amber">{skill}</span> · {skillTierLabel(skill)}</div>
        <div>Expected yield: <span className="text-parchment">{yieldEst} food</span></div>
        <div>Days until harvest: <span className="text-parchment">{daysLeft}</span></div>
        {farm.lastYield != null && (
          <div>Last harvest: <span className="text-success">{farm.lastYield} food</span>
            {farm.lastHarvestYear ? <span> · Y{farm.lastHarvestYear} D{farm.lastHarvestDay}</span> : null}
          </div>
        )}
        <div>Total harvests: {farm.totalHarvests ?? 0}</div>
      </div>

      <div className="ranch-label text-[10px] text-amber mb-1 mt-2">Crop</div>
      <select
        className="w-full bg-coal border border-amber/30 text-parchment text-xs px-2 py-1 mb-2"
        value={farm.cropId}
        onChange={(e) => setFarmCrop(b.id, e.target.value)}
      >
        {unlockedCrops.map((cid) => {
          const c = CROPS[cid as CropId];
          if (!c) return null;
          return <option key={cid} value={cid}>{c.name} ({c.growthDays}d · {c.baseYield} food)</option>;
        })}
      </select>

      <div className="ranch-label text-[10px] text-amber mb-1">Farmer</div>
      <select
        className="w-full bg-coal border border-amber/30 text-parchment text-xs px-2 py-1 mb-2"
        value={farm.assignedFarmerId ?? ""}
        onChange={(e) => assignFarmer(b.id, e.target.value || null)}
      >
        <option value="">— Unassigned —</option>
        {eligible.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name} {s.surname} (farm {Math.round(s.skills.farm ?? 1)})
          </option>
        ))}
      </select>
      {farmer && (
        <button onClick={() => selectSurvivor(farmer.id)} className="btn-ranch btn-ranch-ghost w-full text-[10px]">
          Inspect farmer
        </button>
      )}
    </div>
  );
}

function SurvivorHousingPanel({ s }: { s: Survivor }) {
  const buildings = useGame((g) => g.buildings);
  const survivors = useGame((g) => g.survivors);
  const selectBuilding = useGame((g) => g.selectBuilding);
  const home = s.homeId ? buildings.find(b => b.id === s.homeId) ?? null : null;
  const occupants = home
    ? survivors.filter(o => o.homeId === home.id && o.health > 0)
    : [];
  const report = computeHousingSatisfaction(s, home, occupants);
  const labelColor =
    report.label === "Comfortable" ? "text-success" :
    report.label === "Adequate" ? "text-amber" :
    report.label === "Acceptable" ? "text-dust-light" :
    report.label === "Crowded" ? "text-warning" : "text-danger";
  return (
    <>
      <h4 className="ranch-label mt-5 mb-2">Housing</h4>
      <div className="parchment-panel-warm corner-brackets p-3">
        {home ? (
          <>
            <button
              onClick={() => selectBuilding(home.id)}
              className="ranch-body text-sm text-parchment hover:text-amber w-full text-left"
            >
              {BUILDINGS_DATA[home.kind].name}
              <span className="ranch-data text-[10px] text-dust ml-2">
                Q{homeQuality(home)} · {occupants.length}/{homeCapacity(home)}
              </span>
            </button>
            <div className="mt-2">
              <div className="flex justify-between ranch-label text-[9px]">
                <span>Satisfaction</span>
                <span className={labelColor}>{report.label} · {Math.round(report.satisfaction)}</span>
              </div>
              <div className="h-1 bg-coal border border-amber/15 mt-0.5">
                <div className="h-full bg-amber" style={{ width: `${report.satisfaction}%` }} />
              </div>
            </div>
            <ul className="ranch-data text-[10px] text-dust mt-2 space-y-0.5">
              {report.reasons.map((r, i) => <li key={i}>· {r}</li>)}
            </ul>
            {occupants.length > 1 && (
              <div className="mt-2">
                <div className="ranch-label text-[9px] text-amber mb-1">Household</div>
                <ul className="ranch-handwritten text-xs text-dust-light">
                  {occupants.filter(o => o.id !== s.id).map(o => (
                    <li key={o.id}>· {o.name} {o.surname}</li>
                  ))}
                </ul>
              </div>
            )}
          </>
        ) : (
          <p className="ranch-handwritten text-xs text-danger">Homeless — needs a place to sleep.</p>
        )}
      </div>
    </>
  );
}

function ResidentialPanel({ b }: { b: Building }) {
  const survivors = useGame((g) => g.survivors);
  const assignSurvivorToHome = useGame((g) => g.assignSurvivorToHome);
  const setHomeReserved = useGame((g) => g.setHomeReserved);
  const selectSurvivor = useGame((g) => g.selectSurvivor);
  const occupants = survivors.filter(s => s.homeId === b.id && s.health > 0);
  const cap = homeCapacity(b);
  const q = homeQuality(b);
  const homeless = survivors.filter(s => !s.homeId && s.health > 0);
  return (
    <div className="parchment-panel-warm corner-brackets p-3 mt-3">
      <div className="flex justify-between items-baseline mb-1">
        <span className="ranch-label text-[10px] text-amber">Housing</span>
        <span className="ranch-data text-[10px] text-dust">Quality {q}/5</span>
      </div>
      <div className="flex justify-between ranch-label text-[9px]">
        <span>Occupants</span>
        <span className={occupants.length > cap ? "text-danger" : "text-amber"}>
          {occupants.length} / {cap}
        </span>
      </div>
      <div className="h-1 bg-coal border border-amber/15 my-1">
        <div
          className={`h-full ${occupants.length > cap ? "bg-danger" : "bg-amber"}`}
          style={{ width: `${Math.min(100, (occupants.length / Math.max(1, cap)) * 100)}%` }}
        />
      </div>
      {occupants.length > 0 ? (
        <ul className="text-sm mt-2 space-y-0.5">
          {occupants.map(o => (
            <li key={o.id} className="flex justify-between items-baseline hover:bg-amber/5 px-1">
              <button onClick={() => selectSurvivor(o.id)} className="ranch-body text-parchment hover:text-amber">
                {o.name} {o.surname}
              </button>
              <button
                onClick={() => assignSurvivorToHome(o.id, null)}
                className="ranch-label text-[9px] text-dust hover:text-danger"
                title="Remove from this home"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="ranch-handwritten text-xs text-dust mt-1">Empty.</p>
      )}
      {homeless.length > 0 && occupants.length < cap && (
        <div className="mt-3">
          <div className="ranch-label text-[10px] text-amber mb-1">Assign homeless</div>
          <select
            className="w-full bg-coal border border-amber/30 text-parchment text-xs px-2 py-1"
            defaultValue=""
            onChange={(e) => { if (e.target.value) assignSurvivorToHome(e.target.value, b.id); e.currentTarget.value = ""; }}
          >
            <option value="">— Pick someone —</option>
            {homeless.map(s => (
              <option key={s.id} value={s.id}>{s.name} {s.surname} ({s.stage})</option>
            ))}
          </select>
        </div>
      )}
      <button
        onClick={() => setHomeReserved(b.id, !b.reserved)}
        className={`btn-ranch w-full text-[10px] mt-2 ${b.reserved ? "btn-ranch-primary" : "btn-ranch-ghost"}`}
      >
        {b.reserved ? "Reserved · click to release" : "Reserve for future use"}
      </button>
    </div>
  );
}

