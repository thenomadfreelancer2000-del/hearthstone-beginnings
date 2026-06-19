import { useState } from "react";
import { useGame } from "@/game/store";
import { ArrangeMarriageModal } from "./ArrangeMarriageModal";
import { BUILDINGS } from "@/game/data/content";
import { getPortraitUrl } from "@/game/data/portraits";
import { opinionLabel, opinionScore, opinionCategory } from "@/game/sim/ai";

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
import { AuthorityPanel } from "./AuthorityPanel";
import { FamilyPanel } from "./FamilyPanel";
import { rankHeirs, heirRating, EDUCATION_LABEL, type EducationFocus } from "@/game/sim/heirs";
import { lifeStageLabel } from "@/game/sim/legacy";

const OCCUPATIONS: Occupation[] = [
  "idle", "forager", "woodcutter", "miner", "farmer", "builder", "hauler",
];

type SurvivorTab = "overview" | "skills" | "relationships" | "family" | "housing" | "history";
const SURVIVOR_TABS: { id: SurvivorTab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "skills", label: "Skills" },
  { id: "relationships", label: "Bonds" },
  { id: "family", label: "Family" },
  { id: "housing", label: "Home" },
  { id: "history", label: "History" },
];

function cap(s: string) { return s[0].toUpperCase() + s.slice(1); }


export function Inspector({ onHide }: { onHide?: () => void } = {}) {
  const sel = useGame((s) => s.selection);
  const survivors = useGame((s) => s.survivors);
  const [arrangeFor, setArrangeFor] = useState<string | null>(null);
  const [tab, setTab] = useState<SurvivorTab>("overview");

  const buildings = useGame((s) => s.buildings);
  const relationships = useGame((s) => s.relationships);
  const families = useGame((s) => s.families);
  const currentLeaderId = useGame((s) => s.currentLeaderId);
  const founderId = useGame((s) => s.founderId);
  const setOccupation = useGame((s) => s.setOccupation);
  const clearSelection = useGame((s) => s.clearSelection);
  const selectSurvivor = useGame((s) => s.selectSurvivor);
  const setOverlay = useGame((s) => s.setOverlay);
  const selectFamily = useGame((s) => s.selectFamily);

  if (sel.kind === "none") {
    return (
      <aside className="parchment-panel w-full sm:w-[340px] p-4 ranch-handwritten text-sm text-dust border-l border-amber/20">
        <div className="flex justify-between items-center mb-2">
          <p className="ranch-label">The Ranch</p>
          {onHide && <button onClick={onHide} className="ranch-label text-[10px] hover:text-amber">Hide panel →</button>}
        </div>
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

    const portraitUrl = getPortraitUrl(s.portraitId);
    const homeBuilding = s.homeId ? buildings.find(b => b.id === s.homeId) : null;
    const homeDef = homeBuilding ? BUILDINGS[homeBuilding.kind] : null;
    return (
      <aside className="parchment-panel w-full sm:w-[340px] p-3 sm:p-4 border-l-2 border-amber/40 overflow-auto scroll-amber flex flex-col">
        {/* Top header — compact character card */}
        <div className="flex justify-between items-center mb-2">
          <button onClick={clearSelection} className="ranch-label hover:text-amber">← Close</button>
          {onHide && <button onClick={onHide} className="ranch-label text-[10px] hover:text-amber">Hide →</button>}
        </div>
        <div className="flex gap-3 items-start">
          {portraitUrl && (
            <img
              src={portraitUrl}
              alt={`${s.name} ${s.surname}`}
              className="w-14 h-14 sm:w-16 sm:h-16 object-cover border border-amber/40 shrink-0 grayscale-[20%] sepia-[15%]"
            />
          )}
          <div className="min-w-0 flex-1">
            <h3 className="ranch-display text-lg sm:text-xl leading-tight truncate">
              {s.name} <span className="text-amber">{s.surname}</span>
            </h3>
            {s.epithet && (
              <p className="ranch-display text-[11px] text-amber italic leading-tight truncate">— {s.epithet} —</p>
            )}
            <p className="ranch-handwritten text-[11px] mt-0.5 text-dust-light leading-snug">
              {s.isFounder ? "★ " : isLeader ? "◆ " : ""}
              {lifeStageLabel(s)} · {s.gender === "m" ? "♂" : "♀"} · age {Math.floor(s.age)}
              {isDead && <span className="text-danger"> · †Y{s.deathYear}</span>}
            </p>
          </div>
        </div>

        {/* Quick stats strip */}
        <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-0.5 ranch-data text-[10px]">
          {fam && (
            <button onClick={() => selectFamily(fam.id)} className="text-left truncate hover:text-amber">
              <span className="text-dust">House:</span> <span className="text-amber">{fam.name}</span>
            </button>
          )}
          <div className="truncate"><span className="text-dust">Job:</span> <span className="text-parchment">{cap(s.occupation)}</span></div>
          {homeDef && (
            <div className="truncate"><span className="text-dust">Home:</span> <span className="text-parchment">{homeDef.name}</span></div>
          )}
          {fam && (
            <div className="truncate"><span className="text-dust">Prestige:</span> <span className="text-parchment">{Math.round(fam.prestige)}</span> · Gen {s.generation + 1}</div>
          )}
        </div>

        {!isDead && (
          <p className="ranch-body italic text-dust-light text-xs mt-2 leading-snug">{s.action}</p>
        )}

        {!isDead && !isLeader && (s.stage === "adult" || s.stage === "youth" || s.stage === "elder") && (
          <TalkToBar targetId={s.id} targetName={s.name} />
        )}


        {/* Tab nav */}
        <div className="mt-3 flex gap-0.5 overflow-x-auto scroll-amber border-b border-amber/30 shrink-0">
          {SURVIVOR_TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`ranch-label text-[10px] px-2 py-1 whitespace-nowrap border-b-2 transition ${
                tab === t.id
                  ? "text-amber border-amber"
                  : "text-dust border-transparent hover:text-amber-light"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="mt-3 flex-1">
          {tab === "overview" && (
            <>
              {!isDead && (
                <p className="ranch-data text-[10px]">
                  State: <span className="text-amber">{s.state}</span>
                  {s.carrying && <> · Carrying {s.carrying.amount} {s.carrying.resource}</>}
                </p>
              )}
              {!isDead && (
                <>
                  <h4 className="ranch-label mt-3 mb-1.5">Needs</h4>
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
              <h4 className="ranch-label mt-3 mb-1.5">Traits</h4>
              <div className="flex flex-wrap gap-1">
                {s.traits.map((t) => (
                  <span key={t} className="ranch-label text-[10px] border border-amber/40 px-2 py-0.5 text-parchment">
                    {t}
                  </span>
                ))}
              </div>
              <h4 className="ranch-label mt-3 mb-1.5">Values</h4>
              <p className="ranch-body text-xs">{s.values.join(" · ")}</p>

              {!isDead && s.stage !== "child" && s.stage !== "teen" && (
                <>
                  <h4 className="ranch-label mt-3 mb-1.5">Occupation</h4>
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

              {s.id === currentLeaderId && !isDead && (
                <>
                  <LeaderHelpToggles />
                  <AuthorityPanel />
                  <HeirPanel leader={s} />
                </>
              )}
            </>
          )}

          {tab === "skills" && (
            <>
              <h4 className="ranch-label mb-1.5">Skills</h4>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 ranch-data text-[10px]">
                <SkillRow label="Leadership"   v={s.skills.leadership   ?? s.skills.lead}  />
                <SkillRow label="Building"     v={s.skills.building     ?? s.skills.build} />
                <SkillRow label="Farming"      v={s.skills.farming      ?? s.skills.farm}  />
                <SkillRow label="Healing"      v={s.skills.healing      ?? s.skills.medic} />
                <SkillRow label="Strength"     v={s.skills.strength     ?? Math.max(s.skills.cut, s.skills.mine, s.skills.forage)} />
                <SkillRow label="Intelligence" v={s.skills.intelligence ?? 1} />
                <SkillRow label="Finance"      v={s.skills.finance      ?? 1} />
                <SkillRow label="Social"       v={s.skills.social       ?? 1} />
              </div>
              {s.achievements && s.achievements.length > 0 && (
                <>
                  <h4 className="ranch-label mt-4 mb-1.5">Legacy</h4>
                  <ul className="ranch-handwritten text-xs space-y-0.5 text-parchment">
                    {s.achievements.map((a, i) => <li key={i}>· {a}</li>)}
                  </ul>
                </>
              )}
            </>
          )}

          {tab === "relationships" && (<>
            {!isDead && !s.spouseId && !s.fianceId && s.familyId === survivors.find(x => x.id === founderId)?.familyId && (s.stage === "adult" || s.stage === "youth" || s.stage === "elder") && s.age >= 18 && (
              <button
                onClick={() => setArrangeFor(s.id)}
                className="btn-ranch btn-ranch-ghost text-[9px] px-2 py-0.5 mb-2"
              >
                ♥ Arrange marriage
              </button>
            )}
            {
            rels.length > 0 ? (() => {
              const groups: Record<string, { r: Relationship; other: Survivor; score: number }[]> = {
                "best-friend": [], "friend": [], "rival": [], "enemy": [],
                "dislike": [], "acquaintance": [], "neutral": [],
              };
              for (const r of rels) {
                const otherId = r.a === s.id ? r.b : r.a;
                const other = survivors.find(o => o.id === otherId);
                if (!other) continue;
                const score = opinionScore(r);
                const cat = opinionCategory(score, r.tag);
                if (cat === "spouse" || cat === "kin") continue;
                (groups[cat] ?? groups.neutral).push({ r, other, score });
              }
              for (const k of Object.keys(groups)) {
                groups[k].sort((a, b) => Math.abs(b.score) - Math.abs(a.score));
              }
              const section = (title: string, key: string, tone: string) => {
                const list = groups[key];
                if (!list || list.length === 0) return null;
                return (
                  <div key={key} className="mt-2">
                    <div className={`ranch-label text-[10px] ${tone} mb-1`}>{title} · {list.length}</div>
                    <div className="space-y-1">
                      {list.map(({ r, other }) => (
                        <RelRow key={other.id} r={r} other={other} onClick={() => selectSurvivor(other.id)} />
                      ))}
                    </div>
                  </div>
                );
              };
              return (
                <>
                  {section("Best Friends", "best-friend", "text-success")}
                  {section("Friends", "friend", "text-success")}
                  {section("Acquaintances", "acquaintance", "text-amber")}
                  {section("Dislikes", "dislike", "text-warning")}
                  {section("Rivals", "rival", "text-warning")}
                  {section("Enemies", "enemy", "text-danger")}
                </>
              );
            })() : (
              <p className="ranch-handwritten text-xs text-dust-light italic">No bonds beyond kin yet.</p>
            )}
            {arrangeFor && <ArrangeMarriageModal initiatorId={arrangeFor} onClose={() => setArrangeFor(null)} />}
          </>)}

          {tab === "family" && (
            <>
              {(spouse || parents.length > 0 || children.length > 0) ? (
                <div className="space-y-1 text-sm">
                  {spouse && <KinRow label="Spouse" who={spouse} onClick={() => selectSurvivor(spouse.id)} />}
                  {parents.map(p => <KinRow key={p.id} label="Parent" who={p} onClick={() => selectSurvivor(p.id)} />)}
                  {children.map(c => <KinRow key={c.id} label="Child" who={c} onClick={() => selectSurvivor(c.id)} />)}
                </div>
              ) : (
                <p className="ranch-handwritten text-xs text-dust-light italic">No close kin recorded.</p>
              )}
              {arrangeFor && <ArrangeMarriageModal initiatorId={arrangeFor} onClose={() => setArrangeFor(null)} />}
            </>
          )}

          {tab === "housing" && (
            <>
              {!isDead && <SurvivorHousingPanel s={s} />}
              {!isDead && (s.stage === "child" || s.stage === "teen") && <EducationPanel s={s} />}
              {isDead && <p className="ranch-handwritten text-xs text-dust-light italic">Their hearth grew cold.</p>}
            </>
          )}

          {tab === "history" && (
            <>
              {s.memories.length > 0 ? (
                <ul className="space-y-1.5 pr-1">
                  {s.memories.slice(0, 48).map((m) => {
                    const pos = ["joy", "love", "pride", "trust"].includes(m.emotion);
                    const dateStamp = m.year != null
                      ? `Y${m.year} ${m.season ? m.season[0].toUpperCase() + m.season.slice(1) : ""}${m.day ? ` d${m.day}` : ""}`
                      : "—";
                    const signed = (pos ? "+" : "−") + Math.round(m.weight);
                    const barColor = pos ? "bg-success/70" : "bg-danger/70";
                    return (
                      <li key={m.id} className="border-l-2 border-amber/30 pl-2">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="ranch-handwritten text-xs text-dust-light leading-tight">{m.text}</span>
                          <span className={`ranch-data text-[10px] shrink-0 ${pos ? "text-success" : "text-danger"}`}>{signed}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="ranch-data text-[9px] text-dust">{dateStamp}</span>
                          <div className="flex-1 h-[3px] bg-dust/20 overflow-hidden">
                            <div className={`h-full ${barColor}`} style={{ width: `${Math.min(100, m.weight)}%` }} />
                          </div>
                          <span className="ranch-data text-[9px] text-dust capitalize">{m.emotion}</span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="ranch-handwritten text-xs text-dust-light italic">No memories worth telling yet.</p>
              )}
              {s.id === founderId && (
                <p className="ranch-handwritten text-[11px] text-dust mt-5 italic">
                  The first name in the Chronicle. Their legacy continues whether they live or not.
                </p>
              )}
            </>
          )}
        </div>

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
        <div className="flex justify-between items-center">
          <button onClick={clearSelection} className="ranch-label hover:text-amber">← Deselect</button>
          {onHide && <button onClick={onHide} className="ranch-label text-[10px] hover:text-amber">Hide panel →</button>}
        </div>
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
        {b.kind !== "homestead" && (
          <button
            onClick={() => {
              if (typeof window === "undefined" || window.confirm(`Demolish ${def.name}? Half the materials will be returned.`)) {
                useGame.getState().demolishBuilding(b.id);
              }
            }}
            className="btn-ranch btn-ranch-ghost w-full text-[10px] mt-3 text-danger border-danger/40 hover:bg-danger/10"
          >
            Demolish
          </button>
        )}
      </aside>
    );
  }

  if (sel.kind === "tile") {
    return <TilePanel x={sel.x} y={sel.y} />;
  }

  if (sel.kind === "family") {
    return <FamilyPanel familyId={sel.id} />;
  }

  return null;
}

function WorkerPanel({ b }: { b: Building }) {
  const survivors = useGame((g) => g.survivors);
  const families = useGame((g) => g.families);
  const founderId = useGame((g) => g.founderId);
  const assignWorker = useGame((g) => g.assignWorker);
  const selectSurvivor = useGame((g) => g.selectSurvivor);
  const worker = b.assignedWorkerId ? survivors.find(s => s.id === b.assignedWorkerId) : null;
  const founder = survivors.find((s) => s.id === founderId);
  const founderFamilyId = founder?.familyId;
  // Livestock pens owned by another family — the player can't assign workers there;
  // only that house may put their own idle members to tend the herd.
  const ownerFamilyId = b.livestockOwnerFamilyId;
  const isOtherHouseLivestock =
    !!ownerFamilyId && ownerFamilyId !== founderFamilyId;
  const ownerFam = isOtherHouseLivestock ? families.find((f) => f.id === ownerFamilyId) : null;
  const eligible = survivors.filter(s =>
    s.health > 0 && (s.stage === "adult" || s.stage === "youth" || s.stage === "elder" || s.isFounder) &&
    (!isOtherHouseLivestock || s.familyId === ownerFamilyId)
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
      {isOtherHouseLivestock ? (
        <p className="ranch-handwritten text-[11px] text-dust-light mt-2 italic">
          This herd belongs to House of <span className="text-amber">{ownerFam?.name ?? "?"}</span>.
          Only their kin may tend it — you cannot assign outsiders here.
        </p>
      ) : (
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
      )}
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
            Assign {node.kind === "trees" ? "Cutter" : node.kind === "rocks" ? "Miner" : node.kind === "fiber-grass" ? "Forager (fiber)" : "Forager"}
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
  const relationships = useGame((s) => s.relationships);
  const families = useGame((s) => s.families);
  const founderId = useGame((s) => s.founderId);
  const preferredHeirId = useGame((s) => s.preferredHeirId);
  const setPreferredHeir = useGame((s) => s.setPreferredHeir);
  const selectSurvivor = useGame((s) => s.selectSurvivor);



  const ranked = rankHeirs({
    leader,
    founderId,
    survivors,
    relationships,
    families,
  }).slice(0, 6);

  const preferred = preferredHeirId ? survivors.find((s) => s.id === preferredHeirId) : null;

  return (
    <div className="parchment-panel-warm corner-brackets p-3 mt-5">
      <div className="flex items-baseline justify-between mb-2">
        <h4 className="ranch-label">Heirs</h4>
        {preferred && preferred.health > 0 && (
          <span className="ranch-data text-[10px] text-amber">
            ★ Named: {preferred.name}
          </span>
        )}
      </div>
      {ranked.length === 0 ? (
        <p className="ranch-handwritten text-xs text-dust-light">
          No heir yet. If the leader falls now, the dynasty falls quiet.
        </p>
      ) : (
        <ul className="space-y-2">
          {ranked.map((c) => {
            const rating = heirRating(c.score);
            const isPref = c.survivor.id === preferredHeirId;
            return (
              <li key={c.survivor.id} className="border-l-2 border-amber/30 pl-2">
                <div className="flex justify-between items-baseline">
                  <button
                    onClick={() => selectSurvivor(c.survivor.id)}
                    className="ranch-body text-sm text-parchment hover:text-amber text-left"
                  >
                    {isPref && "★ "}{c.survivor.name} {c.survivor.surname}
                  </button>
                  <span className={`ranch-data text-[10px] ${rating.tone}`}>
                    {rating.rating} · {c.score}
                  </span>
                </div>
                <div className="ranch-data text-[9px] text-dust mt-0.5">
                  age {Math.floor(c.survivor.age)} · cap {c.capability} · rep {Math.round(c.reputation)} · kin {Math.round(c.familySupport)}
                </div>
                {c.notes.length > 0 && (
                  <div className="ranch-handwritten text-[10px] text-dust-light mt-0.5">
                    {c.notes.slice(0, 3).join(" · ")}
                  </div>
                )}
                <button
                  onClick={() => setPreferredHeir(isPref ? null : c.survivor.id)}
                  className={`btn-ranch text-[9px] py-0.5 mt-1 ${isPref ? "btn-ranch-primary" : "btn-ranch-ghost"}`}
                >
                  {isPref ? "Unname" : "Name as heir"}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <p className="ranch-handwritten text-[10px] text-dust mt-2 italic">
        On succession, a named heir takes the porch if alive and of age.
      </p>
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
  const assignSurvivorToHome = useGame((g) => g.assignSurvivorToHome);
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
  // Residential buildings with free capacity (excluding current home)
  const availableHomes = buildings.filter(b => {
    if (!isResidential(b.kind)) return false;
    if (b.builtProgress < 1) return false;
    if (b.id === s.homeId) return false;
    const occCount = survivors.filter(o => o.homeId === b.id && o.health > 0).length;
    return occCount < homeCapacity(b);
  });
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
        {availableHomes.length > 0 && (
          <div className="mt-3">
            <div className="ranch-label text-[10px] text-amber mb-1">
              {home ? "Move to another home" : "Assign a home"}
            </div>
            <ul className="space-y-1 max-h-48 overflow-auto scroll-amber pr-1">
              {availableHomes.map(b => {
                const occCount = survivors.filter(o => o.homeId === b.id && o.health > 0).length;
                return (
                  <li key={b.id}>
                    <button
                      type="button"
                      onClick={() => assignSurvivorToHome(s.id, b.id)}
                      className="w-full text-left border border-amber/30 hover:border-amber bg-coal/40 hover:bg-amber/10 px-2 py-1.5 transition"
                    >
                      <div className="flex justify-between items-baseline">
                        <span className="ranch-body text-xs text-parchment">{BUILDINGS_DATA[b.kind].name}</span>
                        <span className="ranch-data text-[10px] text-dust">{occCount}/{homeCapacity(b)} · Q{homeQuality(b)}</span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        {home && (
          <button
            onClick={() => assignSurvivorToHome(s.id, null)}
            className="btn-ranch btn-ranch-ghost w-full text-[10px] mt-2 text-danger border-danger/40 hover:bg-danger/10"
          >
            Remove from home
          </button>
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
  const candidates = survivors.filter(s => s.health > 0 && s.homeId !== b.id);
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
                {o.name} {o.surname} <span className="text-dust text-[10px]">({o.gender === "m" ? "M" : "F"})</span>
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
      {candidates.length > 0 && occupants.length < cap && (
        <div className="mt-3">
          <div className="ranch-label text-[10px] text-amber mb-1">Move someone in</div>
          {(() => {
            const homeless = candidates.filter(c => !c.homeId);
            const housed = candidates.filter(c => !!c.homeId);
            const Row = ({ c, note }: { c: Survivor; note?: string }) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => assignSurvivorToHome(c.id, b.id)}
                  className="w-full text-left border border-amber/30 hover:border-amber bg-coal/40 hover:bg-amber/10 px-2 py-1.5 transition"
                >
                  <div className="flex justify-between items-baseline">
                    <span className="ranch-body text-xs text-parchment">
                      {c.name} {c.surname} <span className="text-dust text-[10px]">({c.gender === "m" ? "M" : "F"}, {c.stage})</span>
                    </span>
                    {note && <span className="ranch-data text-[10px] text-dust">{note}</span>}
                  </div>
                </button>
              </li>
            );
            return (
              <ul className="space-y-1 max-h-56 overflow-auto scroll-amber pr-1">
                {homeless.length > 0 && (
                  <li className="ranch-label text-[9px] text-dust mt-1">Homeless</li>
                )}
                {homeless.map(c => <Row key={c.id} c={c} note="homeless" />)}
                {housed.length > 0 && (
                  <li className="ranch-label text-[9px] text-dust mt-2">Relocate (already housed)</li>
                )}
                {housed.map(c => <Row key={c.id} c={c} note="relocate" />)}
              </ul>
            );
          })()}
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

function EducationPanel({ s }: { s: Survivor }) {
  const setEducationFocus = useGame((g) => g.setEducationFocus);
  const focus = (s.educationFocus ?? null) as EducationFocus | null;
  const FOCI: EducationFocus[] = ["build", "farm", "lead", "social", "medic"];
  return (
    <>
      <h4 className="ranch-label mt-5 mb-2">Education</h4>
      <div className="parchment-panel-warm corner-brackets p-3">
        <p className="ranch-handwritten text-xs text-dust-light mb-2">
          Parents can shape what the child practices each day.
        </p>
        <div className="grid grid-cols-3 gap-1">
          <button
            onClick={() => setEducationFocus(s.id, null)}
            className={`btn-ranch text-[9px] py-1 ${!focus ? "btn-ranch-primary" : "btn-ranch-ghost"}`}
          >
            None
          </button>
          {FOCI.map((f) => (
            <button
              key={f}
              onClick={() => setEducationFocus(s.id, f)}
              className={`btn-ranch text-[9px] py-1 ${focus === f ? "btn-ranch-primary" : "btn-ranch-ghost"}`}
            >
              {EDUCATION_LABEL[f]}
            </button>
          ))}
        </div>
        {focus && (
          <p className="ranch-data text-[10px] text-amber mt-2">
            Practicing {EDUCATION_LABEL[focus]} · current skill {Math.round(s.skills[focus] ?? 1)}
          </p>
        )}
      </div>
    </>
  );
}



function LeaderHelpToggles() {
  const leaderHelp = useGame((s) => s.leaderHelp);
  const setLeaderHelp = useGame((s) => s.setLeaderHelp);
  const Row = ({ id, label, hint }: { id: "build" | "farm"; label: string; hint: string }) => {
    const on = leaderHelp[id];
    return (
      <button
        type="button"
        onClick={() => setLeaderHelp(id, !on)}
        className={`w-full text-left border px-3 py-2 transition ${
          on ? "border-amber bg-amber/15" : "border-amber/30 bg-coal/40 hover:border-amber/60"
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="ranch-label text-xs text-amber">{label}</span>
          <span className={`ranch-data text-[10px] ${on ? "text-success" : "text-dust"}`}>
            {on ? "ON" : "OFF"}
          </span>
        </div>
        <p className="ranch-handwritten text-[11px] text-dust-light mt-0.5">{hint}</p>
      </button>
    );
  };
  return (
    <>
      <h4 className="ranch-label mt-5 mb-2">Leader's Hands</h4>
      <div className="space-y-2">
        <Row id="build" label="Help Builders" hint="Pitches in at unfinished sites. Lifts opinion of those who see you work." />
        <Row id="farm" label="Help Farmers" hint="Gathers food alongside the workers. Lifts opinion of those nearby." />
      </div>
    </>
  );
}
