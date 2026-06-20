import { useState } from "react";
import { useTrackRender } from "@/hooks/use-track-render";
import { useGame } from "@/game/store";
import { useIsMobile } from "@/hooks/use-mobile";
import { SettingsMenu } from "./SettingsMenu";
import { HudInline } from "./HudInline";

const SEASON_LABEL: Record<string, string> = {
  spring: "Spring", summer: "Summer", autumn: "Autumn", winter: "Winter",
};

interface Props {
  onToggleDock?: () => void;
  dockOpen?: boolean;
  onSettingsOpenChange?: (open: boolean) => void;
}

const RES_ORDER: { key: keyof ReturnType<typeof useGame.getState>["resources"]; label: string }[] = [
  { key: "food", label: "Food" },
  { key: "water", label: "Water" },
  { key: "wood", label: "Wood" },
  { key: "stone", label: "Stone" },
  { key: "fiber", label: "Fiber" },
  { key: "tools", label: "Tools" },
  { key: "eggs", label: "Eggs" },
  { key: "milk", label: "Milk" },
  { key: "wool", label: "Wool" },
];

function ResourcesPanel() {
  const resources = useGame((s) => s.resources);
  const season = useGame((s) => s.time.season);
  const day = useGame((s) => s.time.day);
  const year = useGame((s) => s.time.year);
  return (
    <div className="parchment-panel-warm border-t border-amber/30 px-3 py-1.5 shadow-inner">
      <div className="ranch-label text-[9px] text-amber mb-1">
        {SEASON_LABEL[season]} · Day {day} · Year {year} · Stockpile
      </div>
      <ul className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-x-3 gap-y-0.5">
        {RES_ORDER.map((r) => (
          <li key={r.key} className="flex justify-between ranch-data text-[10px]">
            <span className="text-dust">{r.label}</span>
            <span className="text-parchment">{Math.floor(resources[r.key] ?? 0)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function TopBar({ onToggleDock, dockOpen, onSettingsOpenChange }: Props) {
  useTrackRender("TopBar");
  const ranchName = useGame((s) => s.ranchName);
  const season = useGame((s) => s.time.season);
  const year = useGame((s) => s.time.year);
  const speed = useGame((s) => s.speed);
  const setSpeed = useGame((s) => s.setSpeed);
  const population = useGame((s) => s.stats.population);
  const morale = useGame((s) => s.stats.morale);
  const save = useGame((s) => s.save);
  const setScreen = useGame((s) => s.setScreen);
  const isMobile = useIsMobile();
  const [resOpen, setResOpen] = useState(false);

  if (isMobile) {
    return (
      <div className="z-20 shrink-0">
        <header className="parchment-panel border-b border-amber/30 px-2 py-1 flex items-center gap-1.5 relative">
          <button
            className="flex flex-col min-w-0 flex-1 text-left"
            onClick={() => setResOpen((v) => !v)}
          >
            <span className="ranch-display text-[12px] leading-none truncate text-amber underline-offset-2 hover:underline">
              {ranchName}
            </span>
            <span className="ranch-data text-[9px] text-dust truncate">
              {SEASON_LABEL[time.season].slice(0,3)} Y{time.year} · {stats.population} souls
            </span>
          </button>
          <HudInline />
          <SettingsMenu compact onOpenChange={onSettingsOpenChange} />
          <button
            onClick={onToggleDock}
            className="btn-ranch btn-ranch-ghost text-[10px] !px-1.5 !py-1 shrink-0"
            aria-label="Menu"
          >
            {dockOpen ? "✕" : "☰"}
          </button>
        </header>
        {resOpen && <ResourcesPanel />}
      </div>
    );
  }

  return (
    <div className="z-20 shrink-0">
      <header className="parchment-panel border-b border-amber/30 px-3 py-1 flex items-center gap-x-3 text-[11px] relative">
        <div className="flex items-baseline gap-1.5 ranch-data min-w-0">
          <button
            onClick={() => setResOpen((v) => !v)}
            className="ranch-display text-[13px] leading-none text-amber truncate hover:underline underline-offset-2"
            title="Show stockpile"
          >
            {ranchName}
          </button>
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
          <HudInline />
          <button className="btn-ranch btn-ranch-ghost !py-0.5 !px-1.5 text-[10px]" onClick={() => save()} title="Save">Save</button>
          <button className="btn-ranch btn-ranch-ghost !py-0.5 !px-1.5 text-[10px]" onClick={() => setScreen("menu")} title="Menu">Menu</button>
          <SettingsMenu onOpenChange={onSettingsOpenChange} />
        </div>
      </header>
      {resOpen && <ResourcesPanel />}
    </div>
  );
}
