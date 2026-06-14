import { useGame } from "@/game/store";
import { COUNCIL_ACTION_INFO, forecastActionRisk, type CouncilAction } from "@/game/sim/councilVote";
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

  const leader = useGame((s) => s.survivors.find((x) => x.id === s.currentLeaderId));
  const leadSkill = leader?.skills.lead ?? 0;

  const ActionCard = ({ action, danger }: { action: CouncilAction; danger?: boolean }) => {
    const info = COUNCIL_ACTION_INFO[action];
    const risk = forecastActionRisk(ev, action, leadSkill);
    const needsCh = requiresChallenger.includes(action);
    const lacksCh = needsCh && !canChallenge;
    const lacksRes = !canAfford(info.cost);
    const disabled = lacksCh || lacksRes;
    const riskColor =
      risk.label === "Reckless" ? "bg-danger" :
      risk.label === "High" ? "bg-danger/70" :
      risk.label === "Moderate" ? "bg-amber" : "bg-amber/40";
    const riskText =
      risk.label === "Reckless" || risk.label === "High" ? "text-danger" :
      risk.label === "Moderate" ? "text-amber" : "text-amber/70";
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

        {/* Risk bar */}
        <div className="mt-2">
          <div className="flex justify-between items-center">
            <span className="ranch-label text-[9px] text-dust">Risk</span>
            <span className={`ranch-data text-[10px] ${riskText}`}>{risk.label} · {risk.score}/100</span>
          </div>
          <div className="h-1.5 bg-coal border border-amber/15 mt-0.5">
            <div className={`h-full ${riskColor}`} style={{ width: `${risk.score}%` }} />
          </div>
        </div>

        {lacksCh && (
          <div className="ranch-body text-[10px] text-danger mt-1">No challenger to act against.</div>
        )}

        {/* Effects */}
        <ul className="mt-1.5 space-y-0.5">
          {info.effects.map((e, i) => (
            <li key={`e${i}`} className="ranch-body text-[10px] text-amber/90">+ {e}</li>
          ))}
        </ul>

        {/* Blowback (faction reactions) */}
        {risk.backlash.length > 0 && (
          <div className="mt-1.5 border-t border-amber/10 pt-1">
            <div className="ranch-label text-[9px] text-danger/80">Blowback</div>
            <ul className="space-y-0.5">
              {risk.backlash.map((b, i) => (
                <li key={`b${i}`} className="ranch-body text-[10px] text-danger/80">! {b}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Reputation axis shifts */}
        {risk.repShifts.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {risk.repShifts.map((s, i) => (
              <span
                key={i}
                title={s.reason}
                className={`ranch-label text-[9px] border px-1 py-0.5 ${
                  s.delta >= 0 ? "text-amber border-amber/40" : "text-danger border-danger/40"
                }`}
              >
                {s.delta >= 0 ? "+" : ""}{s.delta} {s.axis}
              </span>
            ))}
          </div>
        )}
      </button>
    );
  };

  const isLawDemand = !!ev.lawRepealRequest;

  return (
    <div className="absolute inset-0 z-[60] bg-black/70 flex items-center justify-center p-4">
      <div className="parchment-panel-warm corner-brackets w-[min(680px,96vw)] max-h-[92vh] overflow-y-auto p-4 shadow-2xl">
        <div className="ranch-label text-[10px] text-amber">Council of Houses · Year {ev.year}</div>
        <div className="ranch-display text-lg text-parchment mt-0.5">
          {isLawDemand
            ? `Demand: Repeal "${ev.lawRepealRequest!.lawTitle}"`
            : ev.contested ? "A Challenge in the Hall" : "The Annual Council"}
        </div>
        <div className="ranch-handwritten text-xs text-dust-light italic mt-1">{ev.flavor}</div>

        {isLawDemand && (
          <div className="mt-2 border border-danger/40 bg-coal/40 p-2">
            <div className="ranch-label text-[10px] text-danger">Law in Question</div>
            <div className="ranch-display text-sm text-parchment mt-0.5">{ev.lawRepealRequest!.lawTitle}</div>
            <div className="ranch-handwritten text-[11px] text-dust-light italic mt-1">
              {ev.lawRepealRequest!.factionName} press the council. Strength of their hand: {ev.lawRepealRequest!.intensity}.
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 mt-3">
          <div className="border border-amber/30 bg-coal/40 p-2">
            <div className="ranch-label text-[9px] text-amber">The Leader</div>
            <div className="ranch-body text-sm text-parchment">{ev.leaderName}</div>
            <div className="ranch-body text-[11px] text-dust">House {ev.leaderHouseName}</div>
            <div className="ranch-data text-xs text-amber mt-1">⚜ Power {ev.leaderPower}</div>
          </div>
          <div className={`border ${canChallenge ? "border-danger/40" : "border-amber/15"} bg-coal/40 p-2`}>
            <div className="ranch-label text-[9px] text-danger">{isLawDemand ? "The Petitioner" : "The Challenger"}</div>
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
          {isLawDemand ? (
            <>
              <ActionCard action="repeal-law" />
              <ActionCard action="refuse-repeal" danger />
              <ActionCard action="bribe" />
            </>
          ) : (
            <>
              <ActionCard action="speech" />
              <ActionCard action="bribe" />
              <ActionCard action="office" />
              <ActionCard action="crush" danger />
              <ActionCard action="stepdown" danger />
              {!ev.contested && <ActionCard action="abdicate-peace" />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
