import { TopBar } from "./TopBar";
import { MapView } from "./MapView";
import { Inspector } from "./Inspector";
import { BottomDock } from "./BottomDock";
import { GameLoop } from "./GameLoop";

export function GameShell() {
  return (
    <div className="h-screen w-screen flex flex-col">
      <GameLoop />
      <TopBar />
      <div className="flex-1 flex min-h-0">
        <MapView />
        <Inspector />
      </div>
      <BottomDock />
    </div>
  );
}
