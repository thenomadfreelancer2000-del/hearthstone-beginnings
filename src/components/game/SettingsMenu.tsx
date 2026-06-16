import { useEffect, useRef, useState } from "react";
import { AmbientSound, useAmbientToggle } from "./AmbientSound";
import { useGame } from "@/game/store";

export function SettingsMenu({ compact = false }: { compact?: boolean }) {
  const { enabled, toggle } = useAmbientToggle();
  const setScreen = useGame((s) => s.setScreen);
  const save = useGame((s) => s.save);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <AmbientSound enabled={enabled} />
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`btn-ranch btn-ranch-ghost ${compact ? "text-[10px] px-2 py-1" : "!py-0.5 !px-1.5 text-[10px]"}`}
        title="Settings"
        aria-label="Settings"
      >
        ⚙
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 parchment-panel corner-brackets p-3 w-[220px] shadow-[0_8px_24px_rgba(0,0,0,0.6)]">
          <div className="ranch-display text-[12px] text-amber mb-2">Settings</div>
          <label className="flex items-center justify-between gap-2 cursor-pointer">
            <span className="ranch-body text-[11px] text-parchment">
              Ambient wind
              <span className="block ranch-handwritten text-[10px] text-dust-light">
                Low mystery drone over wind
              </span>
            </span>
            <button
              type="button"
              onClick={toggle}
              className={`px-2 py-0.5 border ranch-label text-[9px] ${
                enabled ? "bg-amber text-ink border-amber" : "text-dust border-amber/40"
              }`}
              aria-pressed={enabled}
            >
              {enabled ? "ON" : "OFF"}
            </button>
          </label>
          <div className="divider-amber my-2" />
          <button
            type="button"
            onClick={() => { try { save(); } catch {} setScreen("menu"); }}
            className="btn-ranch btn-ranch-ghost w-full text-[10px] !py-1"
            title="Save and return to the main menu"
          >
            Return to Main Menu
          </button>
        </div>
      )}
    </div>
  );
}
