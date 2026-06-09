import { TopBar } from "./TopBar";
import { MapView } from "./MapView";
import { Inspector } from "./Inspector";
import { BottomDock } from "./BottomDock";
import { GameLoop } from "./GameLoop";
import { DynastyOverlay } from "./DynastyOverlay";
import { useGame } from "@/game/store";

export function GameShell() {
  const overlay = useGame((s) => s.overlay);
  return (
    <div className="h-screen w-screen flex flex-col">
      <GameLoop />
      <TopBar />
      <div className="flex-1 flex min-h-0">
        <MapView />
        <Inspector />
      </div>
      <BottomDock />
      {overlay === "tree" && <DynastyOverlay />}
    </div>
  );
}
