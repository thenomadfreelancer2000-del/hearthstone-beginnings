import { useState } from "react";
import { useGame } from "@/game/store";
import { BUILDABLE_KINDS, BUILDINGS } from "@/game/data/content";

export function BottomDock() {
  const [tab, setTab] = useState<"build" | "people" | "chronicle">("build");
  return (
    <div className="parchment-panel border-t border-amber/30">
      <div className="flex border-b border-amber/15">
        {(["build", "people", "chronicle"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 ranch-label text-[11px] ${tab === t ? "text-amber border-b-2 border-amber" : "text-dust hover:text-parchment"}`}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="p-3 max-h-[200px] overflow-auto scroll-amber">
        {tab === "build" && <BuildMenu />}
        {tab === "people" && <PeopleList />}
        {tab === "chronicle" && <ChronicleList />}
      </div>
    </div>
  );
}

function BuildMenu() {
  const buildPlacement = useGame((s) => s.buildPlacement);
  const startBuild = useGame((s) => s.startBuild);
  const cancelBuild = useGame((s) => s.cancelBuild);
  const resources = useGame((s) => s.resources);

  return (
    <div>
      {buildPlacement && (
        <div className="ranch-handwritten text-sm text-amber mb-2 flex items-center gap-3">
          Placing <span className="text-parchment">{buildPlacement.kind}</span> — click on the map. Right-click to cancel.
          <button className="btn-ranch btn-ranch-ghost" onClick={cancelBuild}>Cancel</button>
        </div>
      )}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
        {BUILDABLE_KINDS.map((k) => {
          const def = BUILDINGS[k];
          const affordable = Object.entries(def.cost).every(
            ([r, amt]) => (resources as any)[r] >= (amt ?? 0),
          );
          return (
            <button
              key={k}
              disabled={!affordable}
              onClick={() => startBuild(k)}
              className={`btn-ranch text-left p-2 flex flex-col ${buildPlacement?.kind === k ? "btn-ranch-primary" : ""}`}
              title={def.blurb}
            >
              <span className="text-[11px]">{def.name}</span>
              <span className="ranch-data text-[10px] mt-1 normal-case tracking-normal text-dust">
                {Object.entries(def.cost).map(([r, a]) => `${a}${r[0].toUpperCase()}`).join(" ") || "free"}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PeopleList() {
  const survivors = useGame((s) => s.survivors);
  const select = useGame((s) => s.selectSurvivor);
  return (
    <table className="w-full ranch-data text-xs">
      <thead className="ranch-label text-amber">
        <tr><th className="text-left py-1">Name</th><th>Role</th><th>Mood</th><th>Health</th><th>Doing</th></tr>
      </thead>
      <tbody>
        {survivors.map((s) => (
          <tr key={s.id} className="hover:bg-amber/5 cursor-pointer" onClick={() => select(s.id)}>
            <td className="py-1 text-parchment">
              {s.isFounder && "★ "}{s.name} {s.surname}
            </td>
            <td className="text-center text-dust-light">{s.occupation}</td>
            <td className={`text-center ${s.mood >= 0 ? "text-success" : "text-danger"}`}>{Math.round(s.mood)}</td>
            <td className={`text-center ${s.health < 30 ? "text-danger" : "text-dust-light"}`}>{Math.round(s.health)}</td>
            <td className="text-dust ranch-handwritten">{s.action}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ChronicleList() {
  const chronicle = useGame((s) => s.chronicle);
  return (
    <ul className="space-y-2">
      {chronicle.map((c) => (
        <li key={c.id} className="border-l-2 border-amber/40 pl-3">
          <div className="ranch-label text-[9px] text-amber">
            Year {c.year} · {c.season} · Day {c.day} · {c.category}
          </div>
          <div className="ranch-display text-base text-parchment">{c.title}</div>
          <div className="ranch-handwritten text-sm text-dust-light">{c.body}</div>
        </li>
      ))}
    </ul>
  );
}
