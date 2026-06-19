import { useEffect, useRef, useState } from "react";
import { Toaster } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import { TopBar } from "./TopBar";
import { MapView } from "./MapView";
import { Inspector } from "./Inspector";
import { BottomDock } from "./BottomDock";
import { GameLoop } from "./GameLoop";
import { ZombieLoop } from "./ZombieLayer";
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
  const [settingsOpen, setSettingsOpen] = useState(false);
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
      <ZombieLoop />
      <TopBar
        onToggleDock={() => setDockOpen((v) => !v)}
        dockOpen={dockOpen}
        onSettingsOpenChange={setSettingsOpen}
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
        <MarriageProposalsPanel />
        <LivestockRequestsPanel />
        <MinisterRequestsPanel />
        {!mobileFocus && !settingsOpen && (
          <div
            className="absolute top-2 z-40 flex flex-col gap-1.5 items-end transition-all"
            style={{ right: !isMobile && !inspectorCollapsed ? 348 : (!isMobile && inspectorCollapsed ? 40 : 8) }}
          >
            <SideIconButton onClick={() => setLivestockOpen(true)} label="Livestock" glyph="livestock" />
            <SideIconButton onClick={() => setAdminOpen(true)} label="Ministers" glyph="ministers" />
            <SideIconButton onClick={() => setPoliticsOpen(true)} label="Council" glyph="council" />
            <SideIconButton onClick={() => setFactionsOpen(true)} label="Factions" glyph="factions" />
            <SideIconButton onClick={() => setExpeditionsOpen(true)} label="Expeditions" glyph="expeditions" />
            <SideIconButton onClick={() => setOverlay("tree")} label="Dynasty" glyph="dynasty" />
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
        position="bottom-right"
        theme="dark"
        offset={isMobile ? 96 : 24}
        mobileOffset={96}
        swipeDirections={["right", "left", "bottom", "top"]}
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

type SideGlyph = "livestock" | "ministers" | "council" | "factions" | "expeditions" | "dynasty";

function SideIconButton({ onClick, label, glyph }: { onClick: () => void; label: string; glyph: SideGlyph }) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className="group relative w-10 h-10 flex items-center justify-center bg-coal/80 backdrop-blur-sm border border-amber/40 text-amber hover:border-amber hover:bg-amber/15 hover:text-amber-light transition"
      style={{ borderRadius: 2 }}
    >
      <svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
        <SideGlyphPath glyph={glyph} />
      </svg>
      {/* branding-iron corner ticks */}
      <span className="absolute top-0 left-0 w-1 h-1 border-t border-l border-amber/70" />
      <span className="absolute top-0 right-0 w-1 h-1 border-t border-r border-amber/70" />
      <span className="absolute bottom-0 left-0 w-1 h-1 border-b border-l border-amber/70" />
      <span className="absolute bottom-0 right-0 w-1 h-1 border-b border-r border-amber/70" />
      {/* hover label flag to the left */}
      <span className="pointer-events-none absolute right-full mr-1.5 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity ranch-label text-[9px] tracking-wider text-amber bg-coal/90 border border-amber/40 px-1.5 py-0.5 whitespace-nowrap">
        {label}
      </span>
    </button>
  );
}

function SideGlyphPath({ glyph }: { glyph: SideGlyph }) {
  switch (glyph) {
    case "livestock":
      // Stylized longhorn skull silhouette
      return (
        <>
          <path d="M3 9c2-2 5 0 5 0M21 9c-2-2-5 0-5 0" />
          <path d="M8 9c0-3 2-5 4-5s4 2 4 5v3c0 3-2 5-4 5s-4-2-4-5V9z" />
          <circle cx="10.5" cy="11" r="0.8" fill="currentColor" stroke="none" />
          <circle cx="13.5" cy="11" r="0.8" fill="currentColor" stroke="none" />
          <path d="M11 15l1 1.5 1-1.5" />
        </>
      );
    case "ministers":
      // Quill pen over ledger
      return (
        <>
          <rect x="4" y="6" width="11" height="14" />
          <path d="M7 10h6M7 13h6M7 16h4" />
          <path d="M14 4l6 6-7 7-3 1 1-3 6-6-3-5z" />
        </>
      );
    case "council":
      // Round table with three chairs (top view)
      return (
        <>
          <circle cx="12" cy="12" r="5" />
          <rect x="10.5" y="2.5" width="3" height="3" />
          <rect x="3" y="14" width="3" height="3" transform="rotate(-30 4.5 15.5)" />
          <rect x="18" y="14" width="3" height="3" transform="rotate(30 19.5 15.5)" />
        </>
      );
    case "factions":
      // Two crossed banners
      return (
        <>
          <path d="M5 3v16l2-2 2 2V3z" />
          <path d="M15 5v16l2-2 2 2V5z" />
          <path d="M3 8h8M13 10h8" opacity={0.6} />
        </>
      );
    case "expeditions":
      // Compass rose
      return (
        <>
          <circle cx="12" cy="12" r="8" />
          <path d="M12 5l2 7-2 7-2-7z" fill="currentColor" stroke="none" opacity={0.85} />
          <path d="M5 12l7-2 7 2-7 2z" />
          <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
        </>
      );
    case "dynasty":
      // Family tree
      return (
        <>
          <circle cx="12" cy="4.5" r="1.8" />
          <path d="M12 6.3v3.2M6 14v-1.5c0-1.5 1-2.7 2.5-3M18 14v-1.5c0-1.5-1-2.7-2.5-3" />
          <circle cx="6" cy="16" r="1.8" />
          <circle cx="12" cy="16" r="1.8" />
          <circle cx="18" cy="16" r="1.8" />
          <path d="M12 9.5v4.7" />
        </>
      );
  }
}
