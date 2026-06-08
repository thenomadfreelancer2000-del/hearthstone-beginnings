import { createFileRoute } from "@tanstack/react-router";
import { useGame } from "@/game/store";
import { MainMenu } from "@/components/game/MainMenu";
import { FounderCreation } from "@/components/game/FounderCreation";
import { GameShell } from "@/components/game/GameShell";

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
  if (screen === "menu") return <MainMenu />;
  if (screen === "founder") return <FounderCreation />;
  return <GameShell />;
}
