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
import { FoundingPanel } from "./FoundingPanel";
import { LeaderProfile } from "./LeaderProfile";
import { MarriageProposalsPanel } from "./MarriageProposalsPanel";
import { LivestockRequestsPanel } from "./LivestockRequestsPanel";
import { LivestockPanel } from "./LivestockPanel";
import { MinisterRequestsPanel } from "./MinisterRequestsPanel";
import { AdministrationPanel } from "./AdministrationPanel";
import { useGame } from "@/game/store";
import { useIsMobile } from "@/hooks/use-mobile";

export function GameShell() {
  const overlay = useGame((s) => s.overlay);
  const selection = useGame((s) => s.selection);
  const clearSelection = useGame((s) => s.clearSelection);
  const setOverlay = useGame((s) => s.setOverlay);
  const isMobile = useIsMobile();
  const [dockOpen, setDockOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [livestockOpen, setLivestockOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [inspectorCollapsed, setInspectorCollapsed] = useState(false);

  // Auto-open inspector when something is selected on mobile.
  useEffect(() => {
    if (isMobile && selection.kind !== "none") setInspectorOpen(true);
  }, [isMobile, selection.kind, selection.kind === "survivor" ? selection.id : selection.kind === "building" ? selection.id : ""]);

  const showInspector = isMobile ? selection.kind !== "none" && inspectorOpen : true;


  return (
    <div className="h-full w-full flex flex-col overflow-hidden">
      <GameLoop />
      <TopBar
        onToggleDock={() => setDockOpen((v) => !v)}
        dockOpen={dockOpen}
      />

      <div className="flex-1 flex min-h-0 relative">
        <MapView />
        <FoundingPanel />
        <LeaderProfile dockOpen={dockOpen} />
        <MarriageProposalsPanel />
        <LivestockRequestsPanel />
        <MinisterRequestsPanel />
        <div
          className="absolute top-2 z-40 flex flex-col gap-1 items-end transition-all"
          style={{ right: !isMobile && !inspectorCollapsed ? 348 : (!isMobile && inspectorCollapsed ? 40 : 8) }}
        >
          <button
            onClick={() => setLivestockOpen(true)}
            className="btn-ranch btn-ranch-ghost text-base backdrop-blur-sm bg-coal/70 w-9 h-9 flex items-center justify-center p-0"
            title="Livestock Ledger"
            aria-label="Livestock"
          >
            🐄
          </button>
          <button
            onClick={() => setAdminOpen(true)}
            className="btn-ranch btn-ranch-ghost text-base backdrop-blur-sm bg-coal/70 w-9 h-9 flex items-center justify-center p-0"
            title="Managers & Administration"
            aria-label="Managers"
          >
            ⚖
          </button>
          <button
            onClick={() => setOverlay("tree")}
            className="btn-ranch btn-ranch-ghost text-base backdrop-blur-sm bg-coal/70 w-9 h-9 flex items-center justify-center p-0"
            title="Dynasty Tree"
            aria-label="Dynasty"
          >
            🜲
          </button>
        </div>
        {livestockOpen && <LivestockPanel onClose={() => setLivestockOpen(false)} />}
        {adminOpen && <AdministrationPanel onClose={() => setAdminOpen(false)} />}


        {!isMobile && (
          inspectorCollapsed ? (
            <button
              onClick={() => setInspectorCollapsed(false)}
              className="absolute top-2 right-2 z-40 btn-ranch btn-ranch-ghost text-[10px] px-1.5 py-3 backdrop-blur-sm bg-coal/80"
              title="Show inspector"
              style={{ right: 8 }}
            >
              ◀
            </button>
          ) : (
            <Inspector onHide={() => setInspectorCollapsed(true)} />
          )
        )}

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

      {/* Desktop: dock always; Mobile: inline bottom tray so it never covers the leader portrait */}
      {!isMobile && <BottomDock />}
      {isMobile && dockOpen && (
          <div className="relative z-30 max-h-[50vh] overflow-hidden shrink-0">
            <BottomDock />
          </div>
      )}

      {overlay === "tree" && <DynastyOverlay />}
      <ArrivalEvent />
      <AssignBuilderModal />
      <FarmSetupModal />
      <Toaster
        position="top-center"
        theme="dark"
        offset={isMobile ? 96 : 64}
        mobileOffset={96}
        toastOptions={{
          unstyled: true,
          classNames: {
            toast:
              "parchment-panel corner-brackets w-[340px] max-w-[92vw] flex items-start gap-2 px-3 py-2 ranch-body text-parchment shadow-[0_8px_24px_rgba(0,0,0,0.5)]",
            title: "ranch-display text-[13px] leading-tight text-parchment",
            description: "ranch-handwritten text-[11px] text-dust-light mt-0.5",
            icon: "text-amber mt-0.5 scale-75",
            success: "border-l-2 border-l-success",
            error: "border-l-2 border-l-danger",
            warning: "border-l-2 border-l-warning",
            info: "border-l-2 border-l-amber",
            default: "border-l-2 border-l-amber/60",
            actionButton: "btn-ranch btn-ranch-primary !py-1 !px-2 !text-[10px] ml-auto",
            cancelButton: "btn-ranch btn-ranch-ghost !py-1 !px-2 !text-[10px]",
            closeButton:
              "!bg-coal !border !border-amber/40 !text-amber hover:!text-amber-light",
          },
        }}
      />
    </div>
  );
}
