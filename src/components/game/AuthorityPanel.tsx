import { useMemo } from "react";
import { useGame } from "@/game/store";
import { computeAuthority } from "@/game/sim/authority";

export function AuthorityPanel() {
  const survivors = useGame((s) => s.survivors);
  const families = useGame((s) => s.families);
  const buildings = useGame((s) => s.buildings);
  const resources = useGame((s) => s.resources);
  const setOverlay = useGame((s) => s.setOverlay);

  const a = useMemo(
    () => computeAuthority({ survivors, families, buildings, resources }),
    [survivors, families, buildings, resources]
  );

  const barColor =
    a.score >= 75 ? "bg-amber" :
    a.score >= 40 ? "bg-amber/70" :
    "bg-danger";

  return (
    <div className="parchment-panel-warm corner-brackets p-3 mt-5">
      <div className="flex items-baseline justify-between mb-1">
        <span className="ranch-label text-[10px] text-amber">Founder Authority</span>
        <span className="ranch-data text-[11px] text-parchment">{a.score}/100</span>
      </div>
      <div className="h-1.5 bg-coal border border-amber/15">
        <div className={`h-full ${barColor}`} style={{ width: `${a.score}%` }} />
      </div>
      <p className="ranch-handwritten text-xs text-dust-light mt-1 italic">{a.status}</p>

      {a.positive.length > 0 && (
        <>
          <div className="ranch-label text-[9px] text-amber mt-3 mb-1">Contributors</div>
          <ul className="space-y-0.5">
            {a.positive.map((f, i) => (
              <li key={i} className="flex justify-between ranch-body text-xs">
                <span className="text-parchment">· {f.label}</span>
                <span className="text-amber">+{f.weight}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      {a.negative.length > 0 && (
        <>
          <div className="ranch-label text-[9px] text-danger mt-3 mb-1">Negative Factors</div>
          <ul className="space-y-0.5">
            {a.negative.map((f, i) => (
              <li key={i} className="flex justify-between ranch-body text-xs">
                <span className="text-parchment">· {f.label}</span>
                <span className="text-danger">{f.weight}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="divider-amber my-3" />
      <div className="ranch-label text-[10px] text-amber mb-1">Settlement Support</div>
      <div className="grid grid-cols-3 gap-1 text-center">
        <SupportCell label="Supporters" v={a.supporters} tone="good" />
        <SupportCell label="Neutral" v={a.neutral} tone="mid" />
        <SupportCell label="Opponents" v={a.opponents} tone="bad" />
      </div>

      {a.mostLoyal.length > 0 && (
        <>
          <div className="ranch-label text-[9px] text-amber mt-3 mb-1">Most Loyal Families</div>
          <ul className="space-y-0.5">
            {a.mostLoyal.map((f) => (
              <li key={f.familyId} className="flex justify-between ranch-body text-xs">
                <button onClick={() => setOverlay("tree")} className="text-parchment hover:text-amber text-left">
                  · {f.name}
                </button>
                <span className="text-amber">{f.avg >= 0 ? "+" : ""}{Math.round(f.avg)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      {a.mostDissatisfied.length > 0 && a.mostDissatisfied[0].avg < 0 && (
        <>
          <div className="ranch-label text-[9px] text-danger mt-3 mb-1">Most Dissatisfied</div>
          <ul className="space-y-0.5">
            {a.mostDissatisfied.filter(f => f.avg < 0).map((f) => (
              <li key={f.familyId} className="flex justify-between ranch-body text-xs">
                <button onClick={() => setOverlay("tree")} className="text-parchment hover:text-amber text-left">
                  · {f.name}
                </button>
                <span className="text-danger">{Math.round(f.avg)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function SupportCell({ label, v, tone }: { label: string; v: number; tone: "good" | "mid" | "bad" }) {
  const color = tone === "good" ? "text-amber" : tone === "bad" ? "text-danger" : "text-dust-light";
  return (
    <div className="border border-amber/20 p-1">
      <div className={`ranch-data text-base ${color}`}>{v}</div>
      <div className="ranch-label text-[8px] text-dust">{label}</div>
    </div>
  );
}
