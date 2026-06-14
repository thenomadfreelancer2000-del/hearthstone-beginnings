import { useMemo, useState } from "react";
import { useGame } from "@/game/store";
import { computePolitics, type HousePolitics } from "@/game/sim/politics";
import type { CouncilReactionLogEntry, CouncilReactionEntry } from "@/game/sim/councilVote";

type Tab = "council" | "houses" | "stability" | "reactions";

export function PoliticsPanel({ onClose }: { onClose: () => void }) {
  const survivors = useGame((s) => s.survivors);
  const families = useGame((s) => s.families);
  const buildings = useGame((s) => s.buildings);
  const animals = useGame((s) => s.animals);
  const ministers = useGame((s) => s.ministers);
  const resources = useGame((s) => s.resources);
  const currentLeaderId = useGame((s) => s.currentLeaderId);
  const founderId = useGame((s) => s.founderId);
  const time = useGame((s) => s.time);
  const reactionLog = useGame((s) => s.councilReactionLog);

  const snap = useMemo(
    () =>
      computePolitics({
        survivors,
        families,
        buildings,
        animals,
        ministers,
        resources,
        currentLeaderId,
        founderId,
        currentYear: time.year,
      }),
    [survivors, families, buildings, animals, ministers, resources, currentLeaderId, founderId, time.year]
  );

  const [tab, setTab] = useState<Tab>("council");

  return (
    <div className="absolute inset-0 z-50 bg-black/60 flex items-stretch justify-end">
      <div
        className="absolute inset-0"
        onClick={onClose}
      />
      <div className="relative parchment-panel-warm corner-brackets w-[min(560px,96vw)] h-full overflow-y-auto p-4 shadow-2xl">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="ranch-display text-lg text-amber">The Family Council</div>
            <div className="ranch-handwritten text-[11px] text-dust-light italic">
              Year {time.year} · {snap.houses.length} houses · {snap.totalCouncilSeats} seats
            </div>
          </div>
          <button className="btn-ranch btn-ranch-ghost text-xs" onClick={onClose}>Close ✕</button>
        </div>

        <div className="flex gap-1 mb-3 border-b border-amber/20">
          <TabBtn active={tab === "council"} onClick={() => setTab("council")}>Council</TabBtn>
          <TabBtn active={tab === "houses"} onClick={() => setTab("houses")}>All Houses</TabBtn>
          <TabBtn active={tab === "stability"} onClick={() => setTab("stability")}>Stability</TabBtn>
        </div>

        {tab === "council" && <CouncilView seats={snap.council} totalSeats={snap.totalCouncilSeats} />}
        {tab === "houses" && <HousesView houses={snap.houses} />}
        {tab === "stability" && <StabilityView score={snap.stability.score} label={snap.stability.label} factors={snap.stability.factors} />}
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 ranch-label text-[10px] border-b-2 ${
        active ? "text-amber border-amber" : "text-dust border-transparent hover:text-parchment"
      }`}
    >
      {children}
    </button>
  );
}

function CouncilView({ seats, totalSeats }: { seats: HousePolitics[]; totalSeats: number }) {
  return (
    <div className="space-y-2">
      <div className="ranch-handwritten text-xs text-dust-light italic mb-1">
        The {totalSeats} most powerful houses sit on the council. Seats shift as power changes.
      </div>
      {seats.length === 0 && <div className="ranch-body text-sm text-dust">No families yet.</div>}
      {seats.map((h, i) => (
        <div key={h.familyId} className="border border-amber/30 bg-coal/50 p-2">
          <div className="flex items-baseline justify-between">
            <div>
              <span className="ranch-label text-[9px] text-amber mr-1">Seat {i + 1}</span>
              <span className="ranch-display text-sm text-parchment">House {h.name}</span>
            </div>
            <PowerBadge value={h.politicalPower} />
          </div>
          <div className="ranch-body text-[11px] text-dust-light mt-1">
            Head: <span className="text-parchment">{h.headName ?? "—"}</span>
            {h.officesHeld.length > 0 && (
              <> · {h.officesHeld.map((o) => formatRole(o.role)).join(", ")}</>
            )}
          </div>
          <div className="grid grid-cols-4 gap-1 mt-2">
            <Stat label="Prestige" value={h.prestige} />
            <Stat label="Influence" value={h.influence} />
            <Stat label="Wealth" value={h.wealth} />
            <Stat label="Pop" value={h.population} />
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {h.reputationTags.map((t) => (
              <span key={t} className="ranch-label text-[8px] text-amber border border-amber/40 px-1 py-0.5">{t}</span>
            ))}
          </div>
          <div className="ranch-handwritten text-[10px] text-dust mt-1 italic">Agenda: {h.agenda}</div>
        </div>
      ))}
    </div>
  );
}

function HousesView({ houses }: { houses: HousePolitics[] }) {
  return (
    <div className="space-y-1.5">
      {houses.map((h) => (
        <div key={h.familyId} className={`border ${h.councilSeat ? "border-amber/50" : "border-amber/15"} bg-coal/40 px-2 py-1.5`}>
          <div className="flex items-center justify-between">
            <div className="ranch-body text-sm text-parchment">
              {h.councilSeat && <span className="text-amber mr-1">★</span>}
              House {h.name}
            </div>
            <PowerBadge value={h.politicalPower} />
          </div>
          <div className="ranch-body text-[10px] text-dust-light">
            P {h.prestige} · I {h.influence} · W {h.wealth} · Pop {h.population}
            {h.marriageAllianceCount > 0 && <> · {h.marriageAllianceCount} marriage tie{h.marriageAllianceCount > 1 ? "s" : ""}</>}
          </div>
          <div className="flex flex-wrap gap-1 mt-1">
            {h.reputationTags.slice(0, 4).map((t) => (
              <span key={t} className="ranch-label text-[8px] text-amber/80 border border-amber/30 px-1">{t}</span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function StabilityView({
  score, label, factors,
}: { score: number; label: string; factors: { label: string; weight: number }[] }) {
  const barColor = score >= 70 ? "bg-amber" : score >= 40 ? "bg-amber/70" : "bg-danger";
  return (
    <div className="space-y-3">
      <div>
        <div className="flex justify-between items-baseline">
          <span className="ranch-label text-[10px] text-amber">Settlement Stability</span>
          <span className="ranch-data text-base text-parchment">{score}/100</span>
        </div>
        <div className="h-2 bg-coal border border-amber/15">
          <div className={`h-full ${barColor}`} style={{ width: `${score}%` }} />
        </div>
        <div className="ranch-handwritten text-xs text-dust-light italic mt-1">{label}</div>
      </div>
      <div>
        <div className="ranch-label text-[10px] text-amber mb-1">Factors</div>
        <ul className="space-y-0.5">
          {factors.map((f, i) => (
            <li key={i} className="flex justify-between ranch-body text-xs">
              <span className="text-parchment">· {f.label}</span>
              <span className={f.weight >= 0 ? "text-amber" : "text-danger"}>
                {f.weight >= 0 ? "+" : ""}{f.weight}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-amber/20 text-center p-1">
      <div className="ranch-data text-sm text-parchment">{value}</div>
      <div className="ranch-label text-[8px] text-dust">{label}</div>
    </div>
  );
}

function PowerBadge({ value }: { value: number }) {
  const tone = value >= 70 ? "text-amber border-amber" : value >= 40 ? "text-parchment border-amber/40" : "text-dust border-amber/20";
  return (
    <span className={`ranch-data text-xs border px-1.5 py-0.5 ${tone}`} title="Political Power">
      ⚜ {value}
    </span>
  );
}

function formatRole(role: string): string {
  return role.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
}
