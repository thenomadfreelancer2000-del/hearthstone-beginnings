import { useEffect, useRef, useState } from "react";
import { Toaster } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
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
import { SpeedControl } from "./SpeedControl";
import { MarriageProposalsPanel } from "./MarriageProposalsPanel";
import { LivestockRequestsPanel } from "./LivestockRequestsPanel";
import { LivestockPanel } from "./LivestockPanel";
import { MinisterRequestsPanel } from "./MinisterRequestsPanel";
import { AdministrationPanel } from "./AdministrationPanel";
import { PoliticsPanel } from "./PoliticsPanel";
import { FactionsPanel } from "./FactionsPanel";
import { CouncilVoteModal } from "./CouncilVoteModal";
import { FoundingCharterModal } from "./FoundingCharterModal";
import { ExpeditionPanel } from "./ExpeditionPanel";
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
  const [politicsOpen, setPoliticsOpen] = useState(false);
  const [factionsOpen, setFactionsOpen] = useState(false);
  const [expeditionsOpen, setExpeditionsOpen] = useState(false);
  const [inspectorCollapsed, setInspectorCollapsed] = useState(false);
  const selectionKey = selection.kind === "survivor" || selection.kind === "building" || selection.kind === "family"
    ? `${selection.kind}:${selection.id}`
    : selection.kind === "tile"
      ? `tile:${selection.x},${selection.y}`
      : "none";
  const lastSelectionKey = useRef(selectionKey);

  // Auto-open inspector on mobile only after the player changes selection.
  useEffect(() => {
    const changed = lastSelectionKey.current !== selectionKey;
    lastSelectionKey.current = selectionKey;
    if (isMobile && changed && selection.kind !== "none") setInspectorOpen(true);
  }, [isMobile, selection.kind, selectionKey]);

  const showInspector = isMobile ? selection.kind !== "none" && inspectorOpen : true;
  const anySidePanelOpen = livestockOpen || adminOpen || politicsOpen || factionsOpen || expeditionsOpen;
  const mobileFocus = isMobile && (showInspector || anySidePanelOpen);

  // Auto-collapse the bottom dock whenever a side panel takes focus on mobile.
  useEffect(() => {
    if (mobileFocus && dockOpen) setDockOpen(false);
  }, [mobileFocus, dockOpen]);


  return (
    <div className="h-full w-full flex flex-col overflow-hidden">
      <GameLoop />
      <TopBar
        onToggleDock={() => setDockOpen((v) => !v)}
        dockOpen={dockOpen}
      />

      <div className="flex-1 flex min-h-0 relative">
        <MapView />
        {!mobileFocus && <FoundingPanel />}
        <AnimatePresence>
          {!(isMobile && (mobileFocus || dockOpen)) && (
            <motion.div
              key="leader-profile"
              initial={{ opacity: 0, y: 8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.95 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
            >
              <LeaderProfile dockOpen={dockOpen} />
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {!(isMobile && (mobileFocus || dockOpen)) && (
            <motion.div
              key="speed-control"
              initial={{ opacity: 0, y: 8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.95 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
            >
              <SpeedControl dockOpen={dockOpen} inspectorOpen={!isMobile && !inspectorCollapsed} />
            </motion.div>
          )}
        </AnimatePresence>
        <MarriageProposalsPanel />
        <LivestockRequestsPanel />
        <MinisterRequestsPanel />
        {!mobileFocus && (
          <div
            className="absolute top-2 z-40 flex flex-col gap-1 items-stretch transition-all"
            style={{ right: !isMobile && !inspectorCollapsed ? 348 : (!isMobile && inspectorCollapsed ? 40 : 8) }}
          >
            <SideButton onClick={() => setLivestockOpen(true)} label="Livestock" />
            <SideButton onClick={() => setAdminOpen(true)} label="Ministers" />
            <SideButton onClick={() => setPoliticsOpen(true)} label="Council" />
            <SideButton onClick={() => setFactionsOpen(true)} label="Factions" />
            <SideButton onClick={() => setExpeditionsOpen(true)} label="Expeditions" />
            <SideButton onClick={() => setOverlay("tree")} label="Dynasty" />
          </div>
        )}
        {livestockOpen && <LivestockPanel onClose={() => setLivestockOpen(false)} />}
        {adminOpen && <AdministrationPanel onClose={() => setAdminOpen(false)} />}
        {politicsOpen && <PoliticsPanel onClose={() => setPoliticsOpen(false)} />}
        {factionsOpen && <FactionsPanel onClose={() => setFactionsOpen(false)} />}
        {expeditionsOpen && <ExpeditionPanel onClose={() => setExpeditionsOpen(false)} />}
        <FoundingCharterModal />


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

        {/* Mobile inspector as right drawer — narrow so part of the map stays visible. */}
        {isMobile && showInspector && (
          <>
            <div
              className="absolute inset-0 bg-black/40 z-30"
              onClick={() => { setInspectorOpen(false); clearSelection(); }}
            />
            <div className="absolute right-0 top-0 bottom-0 z-40 w-[78vw] max-w-[300px] flex">
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
      <CouncilVoteModal />
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

function SideButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className="ranch-label text-[8px] tracking-wider text-amber bg-coal/80 backdrop-blur-sm border border-amber/40 hover:border-amber hover:bg-amber/10 hover:text-amber-light px-1.5 h-5 min-w-[64px] text-right transition"
      title={label}
    >
      {label}
    </button>
  );
}
