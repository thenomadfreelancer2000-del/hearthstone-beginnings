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

        <div className="flex gap-1 mb-3 border-b border-amber/20 flex-wrap">
          <TabBtn active={tab === "council"} onClick={() => setTab("council")}>Council</TabBtn>
          <TabBtn active={tab === "houses"} onClick={() => setTab("houses")}>All Houses</TabBtn>
          <TabBtn active={tab === "stability"} onClick={() => setTab("stability")}>Stability</TabBtn>
          <TabBtn active={tab === "reactions"} onClick={() => setTab("reactions")}>
            Reactions{reactionLog.length > 0 && <span className="ml-1 text-amber/70">· {reactionLog.length}</span>}
          </TabBtn>
        </div>

        {tab === "council" && <CouncilView seats={snap.council} totalSeats={snap.totalCouncilSeats} />}
        {tab === "houses" && <HousesView houses={snap.houses} />}
        {tab === "stability" && <StabilityView score={snap.stability.score} label={snap.stability.label} factors={snap.stability.factors} />}
        {tab === "reactions" && <ReactionsView log={reactionLog} />}
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

function ReactionsView({ log }: { log: CouncilReactionLogEntry[] }) {
  if (log.length === 0) {
    return (
      <div className="ranch-handwritten text-sm text-dust-light italic">
        No council has met yet. Reactions appear here after each annual vote.
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <div className="ranch-handwritten text-xs text-dust-light italic">
        How each house reacted to the founder's choice. Newest votes first.
      </div>
      {log.map((e) => <ReactionEntryCard key={e.id} entry={e} />)}
    </div>
  );
}

function ReactionEntryCard({ entry }: { entry: CouncilReactionLogEntry }) {
  const toneBorder =
    entry.tone === "good" ? "border-amber/60" :
    entry.tone === "bad" ? "border-danger/60" : "border-amber/25";
  const pos = entry.reactions.filter(r => r.sentiment === "elated" || r.sentiment === "pleased").length;
  const neg = entry.reactions.filter(r => r.sentiment === "wronged" || r.sentiment === "enraged").length;

  return (
    <div className={`border ${toneBorder} bg-coal/50 p-2`}>
      <div className="flex items-baseline justify-between gap-2">
        <div className="ranch-display text-sm text-parchment">{entry.title}</div>
        <span className="ranch-label text-[9px] text-dust shrink-0">Y{entry.year}</span>
      </div>
      <div className="ranch-handwritten text-[11px] text-dust-light italic mt-0.5">{entry.body}</div>
      <div className="ranch-label text-[9px] text-amber/80 mt-1">
        Action: {entry.actionLabel}
        {" · "}
        <span className="text-amber">{pos} positive</span> ·{" "}
        <span className="text-danger">{neg} negative</span>
      </div>

      {Object.keys(entry.reputationDeltas).length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {Object.entries(entry.reputationDeltas).map(([axis, delta]) => {
            if (!delta) return null;
            const positive = delta > 0;
            return (
              <span
                key={axis}
                className={`ranch-label text-[8px] px-1 py-0.5 border ${
                  positive ? "text-amber border-amber/50" : "text-danger border-danger/50"
                }`}
                title={`Founder reputation ${axis} ${positive ? "+" : ""}${delta}`}
              >
                {positive ? "+" : ""}{delta} {axis}
              </span>
            );
          })}
        </div>
      )}

      <div className="mt-2 space-y-1">
        {entry.reactions.map((r) => (
          <ReactionRow key={r.familyId} r={r} />
        ))}
      </div>
    </div>
  );
}

const SENTIMENT_STYLE: Record<CouncilReactionEntry["sentiment"], { dot: string; text: string; label: string }> = {
  elated:   { dot: "bg-amber",        text: "text-amber",        label: "Elated"  },
  pleased:  { dot: "bg-amber/70",     text: "text-amber/80",     label: "Pleased" },
  neutral:  { dot: "bg-dust",         text: "text-dust",         label: "Neutral" },
  uneasy:   { dot: "bg-danger/50",    text: "text-danger/80",    label: "Uneasy"  },
  wronged:  { dot: "bg-danger/80",    text: "text-danger",       label: "Wronged" },
  enraged:  { dot: "bg-danger",       text: "text-danger",       label: "Enraged" },
};

function ReactionRow({ r }: { r: CouncilReactionEntry }) {
  const s = SENTIMENT_STYLE[r.sentiment];
  const roleBadge =
    r.role === "leader" ? "★ leader's house" :
    r.role === "challenger" ? "✦ challenger" : null;
  return (
    <div className="border border-amber/15 bg-coal/40 px-2 py-1.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={`inline-block w-1.5 h-1.5 rounded-full ${s.dot}`} />
          <span className="ranch-body text-xs text-parchment truncate">House {r.houseName}</span>
          {roleBadge && (
            <span className="ranch-label text-[8px] text-amber/70 border border-amber/30 px-1 shrink-0">
              {roleBadge}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`ranch-label text-[9px] ${r.voted === "for" ? "text-amber" : "text-danger"}`}>
            voted {r.voted}
          </span>
          <span className={`ranch-label text-[9px] ${s.text}`}>{s.label}</span>
        </div>
      </div>
      <div className="ranch-handwritten text-[10px] text-dust-light italic mt-0.5">
        "{r.reason}" — {r.note}
      </div>
      <div className="flex flex-wrap gap-1 mt-1">
        <DeltaChip label="rel" value={r.relationsDelta} hint="Relations toward leader's house" />
        <DeltaChip label="prestige" value={r.prestigeDelta} />
        <DeltaChip label="wealth" value={r.wealthDelta} />
        <DeltaChip label="loyalty" value={r.loyaltyDelta} />
        <DeltaChip label="mood" value={r.moodDelta} />
      </div>
    </div>
  );
}

function DeltaChip({ label, value, hint }: { label: string; value: number; hint?: string }) {
  if (!value) return null;
  const positive = value > 0;
  return (
    <span
      className={`ranch-label text-[8px] px-1 py-0.5 border ${
        positive ? "text-amber border-amber/40" : "text-danger border-danger/40"
      }`}
      title={hint ?? `${label} ${positive ? "+" : ""}${value}`}
    >
      {positive ? "+" : ""}{value} {label}
    </span>
  );
}
