import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useGame } from "@/game/store";
import { debugLog } from "@/game/debug";
import { MainMenu } from "@/components/game/MainMenu";
import { FounderCreation } from "@/components/game/FounderCreation";
import { GameShell } from "@/components/game/GameShell";
import { RotateDevicePrompt } from "@/components/game/RotateDevicePrompt";

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
  useEffect(() => {
    debugLog("app:startup", {
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
      href: typeof window !== "undefined" ? window.location.href : "unknown",
    });
  }, []);

  useEffect(() => {
    debugLog("app:screen", { screen });
  }, [screen]);

  return (
    <>
      <RotateDevicePrompt />
      {screen === "menu" ? <MainMenu /> : screen === "founder" ? <FounderCreation /> : <GameShell />}
    </>
  );
}
