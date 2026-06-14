import { useGame } from "@/game/store";
import type { CouncilAction } from "@/game/sim/councilVote";

export function CouncilVoteModal() {
  const ev = useGame((s) => s.pendingCouncilVote);
  const resolve = useGame((s) => s.resolveCouncilVote);
  const resources = useGame((s) => s.resources);
  if (!ev) return null;

  const canBribe = resources.food >= 40 && resources.tools >= 6;
  const canChallenge = !!ev.challengerHouseId;

  const Btn = ({
    action, label, hint, disabled, danger,
  }: { action: CouncilAction; label: string; hint: string; disabled?: boolean; danger?: boolean }) => (
    <button
      disabled={disabled}
      onClick={() => resolve(action)}
      className={`w-full text-left border px-3 py-2 transition ${
        disabled
          ? "border-amber/10 opacity-40 cursor-not-allowed"
          : danger
            ? "border-danger/40 hover:bg-danger/10"
            : "border-amber/30 hover:bg-amber/10"
      }`}
    >
      <div className="ranch-display text-sm text-parchment">{label}</div>
      <div className="ranch-handwritten text-[11px] text-dust-light italic">{hint}</div>
    </button>
  );

  return (
    <div className="absolute inset-0 z-[60] bg-black/70 flex items-center justify-center p-4">
      <div className="parchment-panel-warm corner-brackets w-[min(640px,96vw)] max-h-[92vh] overflow-y-auto p-4 shadow-2xl">
        <div className="ranch-label text-[10px] text-amber">Council of Houses · Year {ev.year}</div>
        <div className="ranch-display text-lg text-parchment mt-0.5">
          {ev.contested ? "A Challenge in the Hall" : "The Annual Council"}
        </div>
        <div className="ranch-handwritten text-xs text-dust-light italic mt-1">{ev.flavor}</div>

        {/* Tally */}
        <div className="grid grid-cols-2 gap-2 mt-3">
          <div className="border border-amber/30 bg-coal/40 p-2">
            <div className="ranch-label text-[9px] text-amber">The Leader</div>
            <div className="ranch-body text-sm text-parchment">{ev.leaderName}</div>
            <div className="ranch-body text-[11px] text-dust">House {ev.leaderHouseName}</div>
            <div className="ranch-data text-xs text-amber mt-1">⚜ Power {ev.leaderPower}</div>
          </div>
          <div className={`border ${canChallenge ? "border-danger/40" : "border-amber/15"} bg-coal/40 p-2`}>
            <div className="ranch-label text-[9px] text-danger">The Challenger</div>
            <div className="ranch-body text-sm text-parchment">{ev.challengerName ?? "— none —"}</div>
            <div className="ranch-body text-[11px] text-dust">
              {ev.challengerHouseName ? `House ${ev.challengerHouseName}` : "No rival rises"}
            </div>
            <div className="ranch-data text-xs text-danger mt-1">⚜ Power {ev.challengerPower}</div>
            {ev.challengerAgenda && (
              <div className="ranch-handwritten text-[10px] text-dust-light italic mt-0.5">
                Agenda: {ev.challengerAgenda}
              </div>
            )}
          </div>
        </div>

        {/* Vote tally */}
        <div className="mt-3">
          <div className="flex justify-between ranch-label text-[10px]">
            <span className="text-amber">For {ev.forCount}</span>
            <span className="text-danger">Against {ev.againstCount}</span>
          </div>
          <div className="h-2 flex border border-amber/15 mt-1">
            <div className="bg-amber" style={{ width: `${(ev.forCount / Math.max(1, ev.votes.length)) * 100}%` }} />
            <div className="bg-danger" style={{ width: `${(ev.againstCount / Math.max(1, ev.votes.length)) * 100}%` }} />
          </div>
          <ul className="mt-2 space-y-0.5 max-h-32 overflow-y-auto">
            {ev.votes.map((v) => (
              <li key={v.familyId} className="flex justify-between ranch-body text-[11px]">
                <span className="text-parchment">House {v.houseName}</span>
                <span className={v.forLeader ? "text-amber" : "text-danger"}>
                  {v.forLeader ? "For" : "Against"} · <span className="text-dust">{v.reason}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Actions */}
        <div className="mt-4 space-y-1.5">
          <div className="ranch-label text-[10px] text-amber">Your Response</div>
          <Btn
            action="speech"
            label="Speak with authority"
            hint="Sway the hall with your words. Outcome depends on your Lead skill and the vote."
          />
          <Btn
            action="bribe"
            label="Grease the wheel (40 food, 6 tools)"
            hint="Cost is paid; the vote is yours this year. A small dignity cost."
            disabled={!canBribe}
          />
          <Btn
            action="office"
            label="Promise the challenger an office"
            hint="Feed ambition. They gain prestige; you keep the porch."
            disabled={!canChallenge}
          />
          <Btn
            action="crush"
            label="Crush the challenger"
            hint="High risk. If it backfires, the council rallies against you."
            disabled={!canChallenge}
            danger
          />
          <Btn
            action="stepdown"
            label="Step down — yield the porch"
            hint={canChallenge
              ? `${ev.challengerName} of House ${ev.challengerHouseName} takes leadership.`
              : "No challenger to take your place."}
            disabled={!canChallenge}
            danger
          />
          {!ev.contested && (
            <Btn action="abdicate-peace" label="Adjourn quietly" hint="No promises made. Move on." />
          )}
        </div>
      </div>
    </div>
  );
}
