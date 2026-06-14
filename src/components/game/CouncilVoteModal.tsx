import { useGame } from "@/game/store";
import { COUNCIL_ACTION_INFO, type CouncilAction } from "@/game/sim/councilVote";
import type { ResourceKind } from "@/game/types";

export function CouncilVoteModal() {
  const ev = useGame((s) => s.pendingCouncilVote);
  const resolve = useGame((s) => s.resolveCouncilVote);
  const resources = useGame((s) => s.resources);
  if (!ev) return null;

  const canAfford = (cost: Partial<Record<ResourceKind, number>>) =>
    Object.entries(cost).every(([r, amt]) => (resources as any)[r] >= (amt ?? 0));

  const canChallenge = !!ev.challengerHouseId;
  const requiresChallenger: CouncilAction[] = ["office", "crush", "stepdown"];

  const ActionCard = ({ action, danger }: { action: CouncilAction; danger?: boolean }) => {
    const info = COUNCIL_ACTION_INFO[action];
    const needsCh = requiresChallenger.includes(action);
    const lacksCh = needsCh && !canChallenge;
    const lacksRes = !canAfford(info.cost);
    const disabled = lacksCh || lacksRes;
    return (
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
        <div className="flex items-baseline justify-between gap-2">
          <div className="ranch-display text-sm text-parchment">{info.label}</div>
          {Object.keys(info.cost).length > 0 && (
            <div className={`ranch-data text-[10px] ${lacksRes ? "text-danger" : "text-amber"}`}>
              {Object.entries(info.cost).map(([r, amt]) => `${amt} ${r}`).join(" · ")}
            </div>
          )}
        </div>
        <div className="ranch-handwritten text-[11px] text-dust-light italic mt-0.5">{info.hint}</div>
        {lacksCh && (
          <div className="ranch-body text-[10px] text-danger mt-1">No challenger to act against.</div>
        )}
        <ul className="mt-1.5 space-y-0.5">
          {info.effects.map((e, i) => (
            <li key={`e${i}`} className="ranch-body text-[10px] text-amber/90">+ {e}</li>
          ))}
          {info.risks.map((r, i) => (
            <li key={`r${i}`} className="ranch-body text-[10px] text-danger/80">! {r}</li>
          ))}
        </ul>
      </button>
    );
  };

  return (
    <div className="absolute inset-0 z-[60] bg-black/70 flex items-center justify-center p-4">
      <div className="parchment-panel-warm corner-brackets w-[min(680px,96vw)] max-h-[92vh] overflow-y-auto p-4 shadow-2xl">
        <div className="ranch-label text-[10px] text-amber">Council of Houses · Year {ev.year}</div>
        <div className="ranch-display text-lg text-parchment mt-0.5">
          {ev.contested ? "A Challenge in the Hall" : "The Annual Council"}
        </div>
        <div className="ranch-handwritten text-xs text-dust-light italic mt-1">{ev.flavor}</div>

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

        <div className="mt-3">
          <div className="flex justify-between ranch-label text-[10px]">
            <span className="text-amber">For {ev.forCount}</span>
            <span className="text-danger">Against {ev.againstCount}</span>
          </div>
          <div className="h-2 flex border border-amber/15 mt-1">
            <div className="bg-amber" style={{ width: `${(ev.forCount / Math.max(1, ev.votes.length)) * 100}%` }} />
            <div className="bg-danger" style={{ width: `${(ev.againstCount / Math.max(1, ev.votes.length)) * 100}%` }} />
          </div>
          <ul className="mt-2 space-y-0.5 max-h-28 overflow-y-auto">
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

        <div className="mt-4 space-y-1.5">
          <div className="ranch-label text-[10px] text-amber">Your Response</div>
          <ActionCard action="speech" />
          <ActionCard action="bribe" />
          <ActionCard action="office" />
          <ActionCard action="crush" danger />
          <ActionCard action="stepdown" danger />
          {!ev.contested && <ActionCard action="abdicate-peace" />}
        </div>
      </div>
    </div>
  );
}
