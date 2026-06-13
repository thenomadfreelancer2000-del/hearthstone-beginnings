import { useGame } from "@/game/store";
import { useIsMobile } from "@/hooks/use-mobile";

const SEASON_LABEL: Record<string, string> = {
  spring: "Spring", summer: "Summer", autumn: "Autumn", winter: "Winter",
};

interface Props {
  onToggleDock?: () => void;
  dockOpen?: boolean;
}

export function TopBar({ onToggleDock, dockOpen }: Props) {
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
  const isMobile = useIsMobile();

  const leader = survivors.find(s => s.id === currentLeaderId);

  if (isMobile) {
    return (
      <header className="parchment-panel border-b border-amber/30 px-2 py-1.5 z-20 flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <div className="flex flex-col flex-1 min-w-0">
            <span className="ranch-display text-sm leading-none truncate">{ranchName}</span>
            <span className="ranch-data text-[9px] text-dust">
              Y{time.year} · {SEASON_LABEL[time.season]} · D{time.day} · {stats.dynastyName || "—"}
            </span>
          </div>
          <div className="flex border border-amber/30">
            {[0, 1, 2, 3].map((s) => (
              <button
                key={s}
                onClick={() => setSpeed(s as 0 | 1 | 2 | 3)}
                className={`px-1.5 py-1 ranch-label text-[9px] ${speed === s ? "bg-amber text-ink" : "text-dust"}`}
              >
                {s === 0 ? "❚❚" : `${s === 3 ? 4 : s}×`}
              </button>
            ))}
          </div>
          <button
            onClick={onToggleDock}
            className="btn-ranch btn-ranch-ghost text-[10px] px-2 py-1"
            aria-label="Menu"
          >
            {dockOpen ? "Close" : "Menu"}
          </button>
        </div>
        <div className="flex items-center gap-2 ranch-data text-[10px] overflow-x-auto scroll-amber">
          <Res label="W" v={resources.wood} />
          <Res label="St" v={resources.stone} />
          <Res label="F" v={resources.food} />
          <Res label="Wt" v={resources.water} />
          <Res label="Fi" v={resources.fiber} />
          <Res label="T" v={resources.tools} />
          <span className="ml-auto text-dust">
            <span className="text-amber">{stats.population}</span> souls ·{" "}
            <span className={stats.morale >= 0 ? "text-success" : "text-danger"}>
              {Math.round(stats.morale)}
            </span>
          </span>
        </div>
      </header>
    );
  }

  return (
    <header className="parchment-panel border-b border-amber/30 px-3 py-1 flex items-center gap-x-3 gap-y-0.5 z-20 flex-wrap text-[11px]">
      <div className="flex items-baseline gap-1.5 ranch-data">
        <span className="ranch-display text-[13px] leading-none text-amber">{stats.dynastyName || "—"}</span>
        <span className="text-dust">G{stats.generations + 1}</span>
        <span className="text-dust/60">·</span>
        <span>
          Y<span className="text-amber">{time.year}</span> {SEASON_LABEL[time.season]} D<span className="text-amber">{time.day}</span>
        </span>
      </div>

      <div className="flex items-center gap-2 ranch-data">
        <Res label="Wood" v={resources.wood} />
        <Res label="Stone" v={resources.stone} />
        <Res label="Food" v={resources.food} />
        <Res label="Water" v={resources.water} />
        <Res label="Fiber" v={resources.fiber} />
        <Res label="Tools" v={resources.tools} />
      </div>

      <div className="ml-auto flex items-center gap-2 flex-wrap ranch-data">
        {leader && (
          <span className="hidden md:inline text-dust" title="Leader">
            <span className="text-amber">{leader.name} {leader.surname}</span>
            <span className="text-dust/70"> {Math.floor(leader.age)}y</span>
          </span>
        )}
        <span className="text-dust" title="Souls · Mood">
          <span className="text-amber">{stats.population}</span>
          <span className="text-dust/60">·</span>
          <span className={stats.morale >= 0 ? "text-success" : "text-danger"}>{Math.round(stats.morale)}</span>
        </span>
        <div className="flex border border-amber/30">
          {[0, 1, 2, 3].map((s) => (
            <button
              key={s}
              onClick={() => setSpeed(s as 0 | 1 | 2 | 3)}
              className={`px-1.5 py-0.5 ranch-label text-[9px] ${speed === s ? "bg-amber text-ink" : "text-dust hover:text-amber"}`}
            >
              {s === 0 ? "▮▮" : `${s === 3 ? 4 : s}×`}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <button className="btn-ranch btn-ranch-ghost !py-0.5 !px-1.5 text-[10px]" onClick={() => setOverlay("tree")} title="Dynasty">Dynasty</button>
          <button className="btn-ranch btn-ranch-ghost !py-0.5 !px-1.5 text-[10px]" onClick={() => save()} title="Save">Save</button>
          <button className="btn-ranch btn-ranch-ghost !py-0.5 !px-1.5 text-[10px]" onClick={() => setScreen("menu")} title="Menu">Menu</button>
        </div>
      </div>
    </header>
  );
}

function Res({ label, v }: { label: string; v: number }) {
  return (
    <span title={label} className="inline-flex items-baseline gap-0.5 whitespace-nowrap">
      <span className="ranch-label text-[9px]">{label.slice(0, 3)}</span>
      <span className="text-parchment">{Math.floor(v)}</span>
    </span>
  );
}
