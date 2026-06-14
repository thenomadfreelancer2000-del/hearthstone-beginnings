import { useGame } from "@/game/store";
import { useIsMobile } from "@/hooks/use-mobile";
import { SettingsMenu } from "./SettingsMenu";

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
  
  const survivors = useGame((s) => s.survivors);
  const currentLeaderId = useGame((s) => s.currentLeaderId);
  const isMobile = useIsMobile();

  const leader = survivors.find(s => s.id === currentLeaderId);

  if (isMobile) {
    return (
      <header className="parchment-panel border-b border-amber/30 px-2 py-1 z-20 flex items-center gap-1.5">
        <div className="flex flex-col min-w-0 flex-1">
          <span className="ranch-display text-[12px] leading-none truncate">{ranchName}</span>
          <span className="ranch-data text-[9px] text-dust truncate">
            {SEASON_LABEL[time.season].slice(0,3)} Y{time.year} · {stats.population} souls
          </span>
        </div>
        <div className="flex border border-amber/30 shrink-0">
          {[0, 1, 2, 3].map((s) => (
            <button
              key={s}
              onClick={() => setSpeed(s as 0 | 1 | 2 | 3)}
              className={`px-1 py-0.5 ranch-label text-[9px] ${speed === s ? "bg-amber text-ink" : "text-dust"}`}
            >
              {s === 0 ? "❚❚" : `${s === 3 ? 4 : s}×`}
            </button>
          ))}
        </div>
        <SettingsMenu compact />
        <button
          onClick={onToggleDock}
          className="btn-ranch btn-ranch-ghost text-[10px] !px-1.5 !py-1 shrink-0"
          aria-label="Menu"
        >
          {dockOpen ? "✕" : "☰"}
        </button>
      </header>
    );
  }

  return (
    <header className="parchment-panel border-b border-amber/30 px-3 py-1 flex items-center gap-x-3 z-20 text-[11px]">
      <div className="flex items-baseline gap-1.5 ranch-data min-w-0">
        <span className="ranch-display text-[13px] leading-none text-amber truncate">{ranchName}</span>
        <span className="text-dust whitespace-nowrap">
          {SEASON_LABEL[time.season]} Y<span className="text-amber">{time.year}</span>
        </span>
      </div>

      <div className="ml-auto flex items-center gap-2 ranch-data">
        <span className="text-dust">
          <span className="text-amber">{stats.population}</span> souls
          <span className="text-dust/60"> · </span>
          <span className={stats.morale >= 0 ? "text-success" : "text-danger"}>{Math.round(stats.morale)}</span> mood
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
        <button className="btn-ranch btn-ranch-ghost !py-0.5 !px-1.5 text-[10px]" onClick={() => save()} title="Save">Save</button>
        <button className="btn-ranch btn-ranch-ghost !py-0.5 !px-1.5 text-[10px]" onClick={() => setScreen("menu")} title="Menu">Menu</button>
        <SettingsMenu />
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

