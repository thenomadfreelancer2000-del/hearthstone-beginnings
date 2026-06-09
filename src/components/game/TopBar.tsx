import { useGame } from "@/game/store";

const SEASON_LABEL: Record<string, string> = {
  spring: "Spring", summer: "Summer", autumn: "Autumn", winter: "Winter",
};

export function TopBar() {
  const ranchName = useGame((s) => s.ranchName);
  const time = useGame((s) => s.time);
  const speed = useGame((s) => s.speed);
  const setSpeed = useGame((s) => s.setSpeed);
  const resources = useGame((s) => s.resources);
  const stats = useGame((s) => s.stats);
  const save = useGame((s) => s.save);
  const setScreen = useGame((s) => s.setScreen);
  const setOverlay = useGame((s) => s.setOverlay);
  const survivors = useGame((s) => s.survivors);
  const currentLeaderId = useGame((s) => s.currentLeaderId);

  const leader = survivors.find(s => s.id === currentLeaderId);

  return (
    <header className="parchment-panel border-b border-amber/30 px-4 py-2 flex items-center gap-4 z-20 flex-wrap">
      <div className="flex flex-col">
        <span className="ranch-label text-[9px]">Chronicle of</span>
        <span className="ranch-display text-lg leading-none">{ranchName}</span>
      </div>
      <div className="w-px h-10 bg-amber/30" />
      <div className="flex flex-col">
        <span className="ranch-label text-[9px]">House</span>
        <span className="ranch-display text-base leading-none text-amber">
          {stats.dynastyName || "—"}
          <span className="ranch-data text-[10px] text-dust ml-2">Gen {stats.generations + 1}</span>
        </span>
      </div>
      <div className="w-px h-10 bg-amber/30" />
      <div className="ranch-data text-xs">
        Y<span className="text-amber">{time.year}</span> · {SEASON_LABEL[time.season]} · D<span className="text-amber">{time.day}</span>
      </div>

      <div className="flex items-center gap-2 ranch-data text-xs">
        <Res label="Wood" v={resources.wood} />
        <Res label="Stone" v={resources.stone} />
        <Res label="Food" v={resources.food} />
        <Res label="Water" v={resources.water} />
        <Res label="Fiber" v={resources.fiber} />
        <Res label="Tools" v={resources.tools} />
      </div>

      <div className="ml-auto flex items-center gap-3 flex-wrap">
        {leader && (
          <div className="hidden md:flex items-center gap-2 ranch-data text-xs">
            <span className="ranch-label text-[9px]">Leader</span>
            <span className="text-amber">{leader.name} {leader.surname}</span>
            <span className="text-dust">· age {Math.floor(leader.age)}</span>
          </div>
        )}
        <div className="ranch-data text-xs text-dust">
          <span className="ranch-label text-[9px] mr-1">Souls</span>
          <span className="text-amber">{stats.population}</span>
          <span className="ranch-label text-[9px] mx-2">Mood</span>
          <span className={stats.morale >= 0 ? "text-success" : "text-danger"}>
            {Math.round(stats.morale)}
          </span>
        </div>
        <div className="flex border border-amber/30">
          {[0, 1, 2, 3].map((s) => (
            <button
              key={s}
              onClick={() => setSpeed(s as 0 | 1 | 2 | 3)}
              className={`px-2 py-1 ranch-label text-[10px] ${speed === s ? "bg-amber text-ink" : "text-dust hover:text-amber"}`}
            >
              {s === 0 ? "▮▮" : `${s === 3 ? 4 : s}×`}
            </button>
          ))}
        </div>
        <button className="btn-ranch btn-ranch-ghost" onClick={() => setOverlay("tree")}>
          Dynasty
        </button>
        <button className="btn-ranch btn-ranch-ghost" onClick={() => save()}>
          Save
        </button>
        <button className="btn-ranch btn-ranch-ghost" onClick={() => setScreen("menu")}>
          Menu
        </button>
      </div>
    </header>
  );
}

function Res({ label, v }: { label: string; v: number }) {
  return (
    <span title={label} className="inline-flex items-baseline gap-1">
      <span className="ranch-label text-[9px]">{label.slice(0, 3)}</span>
      <span className="text-parchment">{Math.floor(v)}</span>
    </span>
  );
}
