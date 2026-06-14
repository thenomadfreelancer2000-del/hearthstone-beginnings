import { useMemo, useState } from "react";
import { useGame } from "@/game/store";
import { forecastExpedition, TICKS_PER_DAY } from "@/game/sim/expeditions";
import type { Survivor } from "@/game/types";

export function ExpeditionPanel({ onClose }: { onClose: () => void }) {
  const survivors = useGame((s) => s.survivors);
  const expeditions = useGame((s) => s.expeditions);
  const resources = useGame((s) => s.resources);
  const tick = useGame((s) => s.time.tick);
  const createExpedition = useGame((s) => s.createExpedition);

  const [tab, setTab] = useState<"plan" | "active" | "history">("plan");
  const [leaderId, setLeaderId] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [supplies, setSupplies] = useState(20);
  const [days, setDays] = useState(6);

  const busy = useMemo(() => {
    const set = new Set<string>();
    for (const ex of expeditions) if (ex.status === "active") for (const id of ex.memberIds) set.add(id);
    return set;
  }, [expeditions]);

  const eligible = useMemo(() =>
    survivors.filter(
      (s) =>
        s.health > 0 &&
        !busy.has(s.id) &&
        (s.stage === "adult" || s.stage === "youth" || s.stage === "elder"),
    ).sort((a, b) => (b.skills.forage + b.skills.lead) - (a.skills.forage + a.skills.lead)),
    [survivors, busy],
  );

  const partyIds = useMemo(() => {
    const ids = new Set(picked);
    if (leaderId) ids.add(leaderId);
    return ids;
  }, [picked, leaderId]);

  const party: Survivor[] = useMemo(
    () => Array.from(partyIds).map(id => survivors.find(s => s.id === id)).filter((s): s is Survivor => !!s),
    [partyIds, survivors],
  );
  const leader = leaderId ? survivors.find(s => s.id === leaderId) : undefined;
  const forecast = useMemo(
    () => forecastExpedition(party, leader, supplies, days),
    [party, leader, supplies, days],
  );

  const launch = () => {
    if (!leaderId || party.length === 0) return;
    const id = createExpedition({
      leaderId,
      memberIds: party.map(p => p.id),
      supplies,
      durationDays: days,
    });
    if (id) {
      setPicked(new Set());
      setLeaderId(null);
      setTab("active");
    }
  };

  const active = expeditions.filter(e => e.status === "active");
  const completed = expeditions.filter(e => e.status === "complete").reverse();

  return (
    <div className="absolute inset-0 z-50 bg-black/60 flex items-stretch justify-end">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative parchment-panel-warm corner-brackets w-[min(720px,96vw)] h-full overflow-y-auto p-4 shadow-2xl">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="ranch-display text-lg text-amber">Expeditions</div>
            <div className="ranch-handwritten text-[11px] text-dust-light italic">
              Send a party beyond the fence. The road gives and the road takes.
            </div>
          </div>
          <button className="btn-ranch btn-ranch-ghost text-xs" onClick={onClose}>Close ✕</button>
        </div>

        <div className="flex gap-1 mb-3">
          {(["plan", "active", "history"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`btn-ranch text-xs px-2 py-1 ${tab === t ? "btn-ranch-primary" : "btn-ranch-ghost"}`}
            >
              {t === "plan" ? "Plan" : t === "active" ? `Active (${active.length})` : `History (${completed.length})`}
            </button>
          ))}
        </div>

        {tab === "plan" && (
          <div className="space-y-3">
            <div className="border border-amber/30 bg-coal/40 p-2">
              <div className="ranch-label text-[10px] text-amber mb-1">Choose a Leader</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 max-h-40 overflow-y-auto">
                {eligible.map(s => {
                  const isLeader = leaderId === s.id;
                  return (
                    <button
                      key={s.id}
                      onClick={() => setLeaderId(isLeader ? null : s.id)}
                      className={`text-left px-2 py-1 border ${isLeader ? "border-amber bg-amber/15" : "border-amber/15 hover:border-amber/40"}`}
                    >
                      <div className="ranch-display text-[12px] text-parchment">
                        {s.name} {s.surname} {isLeader && <span className="text-amber">★</span>}
                      </div>
                      <div className="ranch-body text-[10px] text-dust">
                        lead {s.skills.lead.toFixed(0)} · survival {s.skills.forage.toFixed(0)} · medic {s.skills.medic.toFixed(0)}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="border border-amber/30 bg-coal/40 p-2">
              <div className="ranch-label text-[10px] text-amber mb-1">
                Pick Companions ({picked.size + (leaderId ? 1 : 0)} chosen)
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 max-h-48 overflow-y-auto">
                {eligible.filter(s => s.id !== leaderId).map(s => {
                  const on = picked.has(s.id);
                  return (
                    <button
                      key={s.id}
                      onClick={() => {
                        const next = new Set(picked);
                        if (on) next.delete(s.id); else next.add(s.id);
                        setPicked(next);
                      }}
                      className={`text-left px-2 py-1 border ${on ? "border-amber bg-amber/10" : "border-amber/15 hover:border-amber/40"}`}
                    >
                      <div className="ranch-display text-[12px] text-parchment">
                        {s.name} {s.surname} {on && <span className="text-amber">✓</span>}
                      </div>
                      <div className="ranch-body text-[10px] text-dust">
                        surv {s.skills.forage.toFixed(0)} · build {s.skills.build.toFixed(0)} · farm {s.skills.farm.toFixed(0)} · soc {s.skills.social.toFixed(0)}
                      </div>
                    </button>
                  );
                })}
                {eligible.length === 0 && (
                  <div className="ranch-body text-xs text-dust italic">No able-bodied kin available.</div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="border border-amber/30 bg-coal/40 p-2">
                <div className="ranch-label text-[10px] text-amber mb-1">Supplies (food)</div>
                <input
                  type="range" min={0} max={Math.min(200, Math.floor(resources.food))} value={supplies}
                  onChange={(e) => setSupplies(Number(e.target.value))}
                  className="w-full"
                />
                <div className="ranch-data text-sm text-parchment">{supplies} / {Math.floor(resources.food)} in stores</div>
              </div>
              <div className="border border-amber/30 bg-coal/40 p-2">
                <div className="ranch-label text-[10px] text-amber mb-1">Duration (days)</div>
                <input
                  type="range" min={2} max={30} value={days}
                  onChange={(e) => setDays(Number(e.target.value))}
                  className="w-full"
                />
                <div className="ranch-data text-sm text-parchment">{days} days</div>
              </div>
            </div>

            <div className="border border-amber/30 bg-coal/40 p-2">
              <div className="ranch-label text-[10px] text-amber mb-1">Forecast</div>
              <div className="grid grid-cols-4 gap-1 text-center">
                <Stat label="Success" value={`${forecast.successChance}%`} tone={forecast.successChance >= 60 ? "good" : forecast.successChance >= 35 ? "warn" : "bad"} />
                <Stat label="Danger"  value={`${forecast.dangerLevel}%`} tone={forecast.dangerLevel <= 30 ? "good" : forecast.dangerLevel <= 60 ? "warn" : "bad"} />
                <Stat label="Food needed" value={`${forecast.supplyConsumption}`} tone={supplies >= forecast.supplyConsumption ? "good" : "bad"} />
                <Stat label="Strength" value={`${forecast.teamStrength}`} tone="neutral" />
              </div>
              {supplies < forecast.supplyConsumption && (
                <div className="ranch-handwritten text-[10px] text-danger italic mt-1">
                  Short of supplies — danger rises sharply.
                </div>
              )}
            </div>

            <button
              disabled={!leaderId || party.length === 0}
              onClick={launch}
              className={`btn-ranch btn-ranch-primary w-full ${(!leaderId || party.length === 0) ? "opacity-40 cursor-not-allowed" : ""}`}
            >
              Send the Expedition
            </button>
          </div>
        )}

        {tab === "active" && (
          <div className="space-y-2">
            {active.length === 0 && (
              <div className="ranch-body text-sm text-dust italic">No parties beyond the fence.</div>
            )}
            {active.map(ex => {
              const remainingTicks = Math.max(0, ex.returnTick - tick);
              const remainingDays = Math.ceil(remainingTicks / TICKS_PER_DAY);
              const progress = Math.min(1, (tick - ex.startTick) / Math.max(1, ex.returnTick - ex.startTick));
              return (
                <div key={ex.id} className="border border-amber/30 bg-coal/40 p-2">
                  <div className="ranch-display text-sm text-parchment">{ex.leaderName}'s expedition</div>
                  <div className="ranch-body text-[11px] text-dust">
                    {ex.memberIds.length} sent · {ex.supplies} food · {ex.durationDays}-day journey
                  </div>
                  <div className="h-1.5 bg-coal border border-amber/15 mt-1.5">
                    <div className="h-full bg-amber" style={{ width: `${Math.round(progress * 100)}%` }} />
                  </div>
                  <div className="ranch-body text-[10px] text-dust mt-1">
                    Returns in ~{remainingDays} day{remainingDays === 1 ? "" : "s"}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {tab === "history" && (
          <div className="space-y-2">
            {completed.length === 0 && (
              <div className="ranch-body text-sm text-dust italic">No expeditions have returned yet.</div>
            )}
            {completed.map(ex => {
              const tone = ex.story?.tone ?? "quiet";
              const tint =
                tone === "triumph" ? "border-amber" :
                tone === "loss" ? "border-danger" :
                tone === "mixed" ? "border-warning" : "border-amber/30";
              return (
                <div key={ex.id} className={`border ${tint} bg-coal/40 p-2`}>
                  <div className="ranch-display text-sm text-parchment">{ex.story?.title ?? "Expedition returned"}</div>
                  <div className="ranch-handwritten text-[11px] text-dust-light italic mt-0.5">{ex.story?.body}</div>
                  {ex.story && ex.story.highlights.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {ex.story.highlights.map((h, i) => (
                        <span key={i} className="ranch-label text-[9px] text-amber border border-amber/40 px-1">{h}</span>
                      ))}
                    </div>
                  )}
                  {ex.fates && ex.fates.length > 0 && (
                    <div className="mt-2 border-t border-amber/15 pt-1">
                      {ex.fates.map(f => (
                        <div key={f.survivorId} className="ranch-body text-[10px]">
                          <span className={
                            f.fate === "dead" ? "text-danger" :
                            f.fate === "disabled" || f.fate === "major-injury" ? "text-warning" :
                            f.fate === "ok" ? "text-amber" : "text-dust-light"
                          }>{f.name}</span>
                          <span className="text-dust"> — {f.story}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="ranch-label text-[9px] text-dust mt-1">Year {ex.resolvedYear}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: "good" | "warn" | "bad" | "neutral" }) {
  const color = tone === "good" ? "text-amber" : tone === "bad" ? "text-danger" : tone === "warn" ? "text-warning" : "text-parchment";
  return (
    <div className="border border-amber/15 p-1">
      <div className={`ranch-data text-sm ${color}`}>{value}</div>
      <div className="ranch-label text-[8px] text-dust">{label}</div>
    </div>
  );
}
