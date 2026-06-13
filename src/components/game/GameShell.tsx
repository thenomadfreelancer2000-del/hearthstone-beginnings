import { useEffect, useState } from "react";
import { Toaster } from "sonner";
import { TopBar } from "./TopBar";
import { MapView } from "./MapView";
import { Inspector } from "./Inspector";
import { BottomDock } from "./BottomDock";
import { GameLoop } from "./GameLoop";
import { DynastyOverlay } from "./DynastyOverlay";
import { ArrivalEvent } from "./ArrivalEvent";
import { AssignBuilderModal } from "./AssignBuilderModal";
import { FarmSetupModal } from "./FarmSetupModal";
import { useGame } from "@/game/store";
import { useIsMobile } from "@/hooks/use-mobile";

export function GameShell() {
  const overlay = useGame((s) => s.overlay);
  const selection = useGame((s) => s.selection);
  const clearSelection = useGame((s) => s.clearSelection);
  const isMobile = useIsMobile();
  const [dockOpen, setDockOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);

  // Auto-open inspector when something is selected on mobile.
  useEffect(() => {
    if (isMobile && selection.kind !== "none") setInspectorOpen(true);
  }, [isMobile, selection.kind, selection.kind === "survivor" ? selection.id : selection.kind === "building" ? selection.id : ""]);

  const showInspector = isMobile ? selection.kind !== "none" && inspectorOpen : true;


  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden">
      <GameLoop />
      <TopBar
        onToggleDock={() => setDockOpen((v) => !v)}
        dockOpen={dockOpen}
      />

      <div className="flex-1 flex min-h-0 relative">
        <MapView />

        {!isMobile && <Inspector />}

        {/* Mobile inspector as right drawer */}
        {isMobile && showInspector && (
          <>
            <div
              className="absolute inset-0 bg-black/40 z-30"
              onClick={() => { setInspectorOpen(false); clearSelection(); }}
            />
            <div className="absolute right-0 top-0 bottom-0 z-40 w-[88vw] max-w-[360px] flex">
              <Inspector />
            </div>
          </>
        )}
      </div>

      {/* Desktop: dock always; Mobile: drawer */}
      {!isMobile && <BottomDock />}
      {isMobile && dockOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-30"
            onClick={() => setDockOpen(false)}
          />
          <div className="fixed left-0 right-0 bottom-0 z-40 max-h-[70vh] overflow-hidden">
            <BottomDock />
          </div>
        </>
      )}

      {overlay === "tree" && <DynastyOverlay />}
      <ArrivalEvent />
      <AssignBuilderModal />
      <Toaster
        position={isMobile ? "top-center" : "bottom-right"}
        toastOptions={{
          classNames: {
            toast: "bg-coal text-parchment border border-amber/40",
            description: "text-dust-light",
          },
        }}
      />
    </div>
  );
}
