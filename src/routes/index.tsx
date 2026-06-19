import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { useGame } from "@/game/store";
import { MainMenu } from "@/components/game/MainMenu";
import { FounderCreation } from "@/components/game/FounderCreation";
import { RotateDevicePrompt } from "@/components/game/RotateDevicePrompt";

// Code-split the in-game shell (MapView + IsoBuilding + sim panels).
// The main menu and founder creation render without paying for the
// ~5,700-line map/iso rendering tree until the player actually starts.
const GameShell = lazy(() =>
  import("@/components/game/GameShell").then((m) => ({ default: m.GameShell })),
);

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "The Ranch — A Frontier Dynasty Chronicle" },
      { name: "description", content: "Build a family. Build a people. Build a civilization — and pray your name survives what comes next." },
      { property: "og:title", content: "The Ranch" },
      { property: "og:description", content: "Post-apocalyptic colony and dynasty simulation." },
    ],
  }),
  component: Index,
});

function Index() {
  const screen = useGame((s) => s.screen);
  return (
    <>
      <RotateDevicePrompt />
      {screen === "menu" ? (
        <MainMenu />
      ) : screen === "founder" ? (
        <FounderCreation />
      ) : (
        <Suspense fallback={<div className="min-h-[100dvh] bg-ink" />}>
          <GameShell />
        </Suspense>
      )}
    </>
  );
}
