import { useGame } from "@/game/store";
import { CROPS, type CropId } from "@/game/data/crops";

const KIND_LABEL: Record<string, string> = {
  "lone": "Lone Traveler",
  "couple": "Weary Couple",
  "parent-child": "Parent & Child",
  "small-family": "Small Family",
  "travelers": "Group of Travelers",
  "injured": "Injured Survivor",
  "refugees": "Refugee Group",
};

export function ArrivalEvent() {
  const ev = useGame((s) => s.pendingArrival);
  const accept = useGame((s) => s.acceptArrival);
  const reject = useGame((s) => s.rejectArrival);
  const reputation = useGame((s) => s.reputation);

  if (!ev) return null;

  const gifts = Object.entries(ev.gifts).filter(([, v]) => (v ?? 0) > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="parchment-panel border border-amber/40 max-w-lg w-full p-5 sm:p-6 corner-brackets relative">
        <div className="ranch-label text-[10px] text-amber mb-1">
          Arrival · {KIND_LABEL[ev.kind] ?? ev.kind}
        </div>
        <h2 className="ranch-display text-2xl sm:text-3xl leading-tight text-parchment">
          {ev.title}
        </h2>
        <p className="ranch-handwritten text-sm text-dust-light mt-2">{ev.blurb}</p>

        <div className="divider-amber my-4" />

        <ul className="space-y-1.5 max-h-48 overflow-auto scroll-amber pr-2">
          {ev.survivors.map((s) => (
            <li key={s.id} className="flex justify-between items-baseline text-sm">
              <span className="ranch-body text-parchment">
                {s.name} <span className="text-amber">{s.surname}</span>
              </span>
              <span className="ranch-data text-[10px] text-dust">
                {s.stage} · {s.background} · age {Math.floor(s.age)}
                {s.health < 60 && <span className="text-danger ml-2">hp {Math.round(s.health)}</span>}
              </span>
            </li>
          ))}
        </ul>

        {gifts.length > 0 && (
          <>
            <div className="ranch-label text-[10px] mt-4 mb-1">They carry</div>
            <div className="flex flex-wrap gap-2">
              {gifts.map(([k, v]) => (
                <span key={k} className="ranch-data text-xs border border-amber/30 px-2 py-0.5 text-parchment">
                  +{v} {k}
                </span>
              ))}
            </div>
          </>
        )}

        <div className="ranch-data text-[10px] text-dust mt-3">
          Reputation: <span className={reputation >= 0 ? "text-success" : "text-danger"}>{reputation}</span>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 mt-5">
          <button onClick={reject} className="btn-ranch btn-ranch-ghost flex-1">
            Send them on
          </button>
          <button onClick={accept} className="btn-ranch btn-ranch-primary flex-1">
            Welcome them
          </button>
        </div>
      </div>
    </div>
  );
}
