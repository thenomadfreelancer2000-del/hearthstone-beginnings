import { useMemo } from "react";
import { useGame } from "@/game/store";
import { computeFamilyStanding } from "@/game/sim/families";
import type { Survivor } from "@/game/types";
import { MoodFace, MoodFaceAvg } from "./MoodFace";

export function FamilyPanel({ familyId }: { familyId: string }) {
  const families = useGame((s) => s.families);
  const survivors = useGame((s) => s.survivors);
  const buildings = useGame((s) => s.buildings);
  const currentLeaderId = useGame((s) => s.currentLeaderId);
  const founderId = useGame((s) => s.founderId);
  const time = useGame((s) => s.time);
  const clearSelection = useGame((s) => s.clearSelection);
  const selectSurvivor = useGame((s) => s.selectSurvivor);

  const fam = families.find((f) => f.id === familyId);
  const standing = useMemo(() => {
    if (!fam) return null;
    return computeFamilyStanding(fam, {
      survivors, buildings, currentLeaderId, founderId, currentYear: time.year,
    });
  }, [fam, survivors, buildings, currentLeaderId, founderId, time.year]);

  if (!fam || !standing) return null;

  const head = standing.headId ? survivors.find((s) => s.id === standing.headId) : null;
  const members = fam.memberIds
    .map((id) => survivors.find((s) => s.id === id))
    .filter((s): s is Survivor => !!s);
  const alive = members.filter((m) => m.health > 0);
  const dead = members.filter((m) => m.health <= 0);

  const loyaltyColor =
    standing.avgLoyalty >= 25 ? "text-success"
    : standing.avgLoyalty <= -25 ? "text-danger"
    : "text-dust-light";
  const moodColor =
    standing.avgMood >= 15 ? "text-success"
    : standing.avgMood <= -15 ? "text-danger"
    : "text-dust-light";

  return (
    <aside className="parchment-panel w-full sm:w-[340px] p-4 border-l border-amber/20 overflow-auto scroll-amber">
      <button onClick={clearSelection} className="ranch-label hover:text-amber">← Deselect</button>
      <p className="ranch-label mt-3 text-amber">House of</p>
      <h3 className="ranch-display text-3xl leading-none text-amber">{fam.name}</h3>
      <p className="ranch-handwritten text-sm text-dust-light mt-1">
        {standing.isFounderFamily && "★ Founder line · "}
        {standing.hasLeader && "◆ Holds the porch · "}
        Founded Y{fam.foundedYear}
        {fam.extinctYear ? ` · extinct Y${fam.extinctYear}` : ""}
      </p>

      <div className="divider-amber my-3" />

      <div className="parchment-panel-warm corner-brackets p-3">
        <div className="flex items-baseline justify-between mb-1">
          <span className="ranch-label text-[10px] text-amber">Family Prestige</span>
          <span className="ranch-data text-[11px] text-parchment">{standing.prestige}/100</span>
        </div>
        <div className="h-1.5 bg-coal border border-amber/15">
          <div className="h-full bg-amber" style={{ width: `${standing.prestige}%` }} />
        </div>

        <div className="grid grid-cols-3 gap-2 mt-3 text-center">
          <Stat label="Living" v={String(standing.living)} tone="text-amber" />
          <Stat label="Loyalty" v={String(Math.round(standing.avgLoyalty))} tone={loyaltyColor} />
          <div className="border border-amber/20 p-1 flex flex-col items-center justify-center">
            <MoodFaceAvg avg={standing.avgMood} size="sm" showLabel={false} />
            <div className="ranch-label text-[8px] text-dust mt-0.5">Mood</div>
          </div>
        </div>

        <ul className="ranch-data text-[10px] text-dust mt-3 space-y-0.5">
          {standing.reasons.map((r, i) => (
            <li key={i} className="flex justify-between">
              <span>· {r.label}</span>
              <span className={r.weight >= 0 ? "text-amber" : "text-danger"}>
                {r.weight > 0 ? "+" : ""}{r.weight}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {head && (
        <>
          <h4 className="ranch-label mt-5 mb-2">Head of Family</h4>
          <button
            onClick={() => selectSurvivor(head.id)}
            className="parchment-panel-warm corner-brackets p-3 w-full text-left hover:border-amber transition"
          >
            <div className="ranch-display text-lg text-parchment">
              {head.name} <span className="text-amber">{head.surname}</span>
            </div>
            <p className="ranch-handwritten text-xs text-dust-light mt-0.5">
              {head.isFounder ? "★ Founder · " : standing.hasLeader && head.id === currentLeaderId ? "◆ Leader · " : ""}
              {cap(head.stage)} · age {Math.floor(head.age)} · lead {Math.round(head.skills.lead ?? 1)}
            </p>
            <p className="ranch-data text-[10px] text-dust mt-1 italic">
              {standing.living > 1
                ? "The family looks to them when things go quiet."
                : "Stands alone for now."}
            </p>
          </button>
        </>
      )}

      {standing.expectationGap > 20 && (
        <div className="parchment-panel-warm corner-brackets p-3 mt-3 border-l-2 border-danger">
          <div className="ranch-label text-[10px] text-danger mb-1">Family Expectations</div>
          <p className="ranch-handwritten text-xs text-parchment">
            {standing.homelessCount > 0
              ? `${standing.homelessCount} of the ${fam.name} kin sleep without a roof.`
              : `A family of ${standing.living} deserves a larger home than this.`}
          </p>
          <div className="flex justify-between ranch-label text-[9px] mt-2">
            <span>Pressure</span>
            <span className="text-danger">{standing.expectationGap}/100</span>
          </div>
          <div className="h-1 bg-coal border border-amber/15 mt-0.5">
            <div className="h-full bg-danger" style={{ width: `${standing.expectationGap}%` }} />
          </div>
        </div>
      )}

      <h4 className="ranch-label mt-5 mb-2">Members · {alive.length} living</h4>
      <ul className="space-y-1">
        {alive.map((m) => (
          <MemberRow key={m.id} s={m} isHead={m.id === standing.headId} isLeader={m.id === currentLeaderId} onClick={() => selectSurvivor(m.id)} />
        ))}
      </ul>

      {dead.length > 0 && (
        <>
          <h4 className="ranch-label mt-5 mb-2 text-dust">In Memoriam · {dead.length}</h4>
          <ul className="space-y-0.5">
            {dead.map((m) => (
              <li key={m.id}>
                <button
                  onClick={() => selectSurvivor(m.id)}
                  className="ranch-handwritten text-xs text-dust w-full text-left hover:text-amber"
                >
                  · {m.name} {m.surname} <span className="text-dust">†Y{m.deathYear ?? "?"}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {Object.keys(fam.relations).length > 0 && (
        <>
          <h4 className="ranch-label mt-5 mb-2">Bonds with other Houses</h4>
          <ul className="space-y-0.5">
            {Object.entries(fam.relations)
              .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
              .slice(0, 5)
              .map(([fid, v]) => {
                const other = families.find((f) => f.id === fid);
                if (!other) return null;
                const tone = v >= 25 ? "text-success" : v <= -25 ? "text-danger" : "text-dust-light";
                return (
                  <li key={fid} className="flex justify-between ranch-body text-xs">
                    <span className="text-parchment">· House of {other.name}</span>
                    <span className={tone}>{v > 0 ? "+" : ""}{Math.round(v)}</span>
                  </li>
                );
              })}
          </ul>
        </>
      )}
    </aside>
  );
}

function MemberRow({ s, isHead, isLeader, onClick }: { s: Survivor; isHead: boolean; isLeader: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full text-left hover:bg-amber/5 px-1 py-0.5">
      <div className="flex justify-between items-baseline gap-2">
        <span className="ranch-body text-parchment text-sm">
          {s.isFounder && "★ "}{isLeader && !s.isFounder && "◆ "}{s.name} {s.surname}
        </span>
        <span className="ranch-data text-[10px] text-dust">{cap(s.stage)} · {Math.floor(s.age)}</span>
      </div>
      <div className="flex justify-between items-center ranch-data text-[9px] mt-0.5">
        <span className="text-amber">{isHead ? "head" : s.spouseId ? "wed" : "—"}</span>
        <span className="flex items-center gap-2">
          <MoodFace survivor={s} size="xs" showLabel={false} />
          <span className="text-dust">loyalty {Math.round(s.loyaltyToFounder)}</span>
        </span>
      </div>
    </button>
  );
}

function Stat({ label, v, tone }: { label: string; v: string | number; tone: string }) {
  return (
    <div className="border border-amber/20 p-1">
      <div className={`ranch-data text-base ${tone}`}>{v}</div>
      <div className="ranch-label text-[8px] text-dust">{label}</div>
    </div>
  );
}

function cap(s: string) { return s[0].toUpperCase() + s.slice(1); }
