import { motion } from "framer-motion";
import { useGame } from "@/game/store";
import { hasSave } from "@/game/persistence";

export function MainMenu() {
  const setScreen = useGame((s) => s.setScreen);
  const resume = useGame((s) => s.resumeFromSave);
  const canResume = hasSave();

  return (
    <div className="grain min-h-screen flex flex-col items-center justify-center px-6 py-12 relative">
      {/* corner brackets */}
      <div className="pointer-events-none fixed inset-8 border border-[color:var(--amber)]/30" />
      <div className="pointer-events-none fixed inset-12 border border-[color:var(--amber)]/15" />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
        className="text-center max-w-2xl"
      >
        <p className="ranch-label mb-8">A Frontier Dynasty Chronicle</p>
        <h1 className="ranch-display text-[clamp(80px,15vw,160px)] leading-[0.85] text-parchment"
          style={{ textShadow: "0 4px 60px rgba(196,135,42,0.25)" }}>
          The Ranch
        </h1>
        <p className="ranch-display italic text-dust-light text-lg mt-3 mb-12">
          Build a family. Build a people. Build a civilization —<br />
          and pray your name survives what comes next.
        </p>

        <div className="ornate-rule mb-10">
          <span className="ranch-label">·</span>
        </div>

        <div className="flex flex-col gap-3 items-center">
          {canResume && (
            <button
              className="btn-ranch btn-ranch-primary min-w-[280px]"
              onClick={() => resume()}
            >
              Resume the Chronicle
            </button>
          )}
          <button
            className="btn-ranch min-w-[280px]"
            onClick={() => setScreen("founder")}
          >
            Begin a New Founding
          </button>
        </div>

        <p className="ranch-handwritten text-dust opacity-60 mt-16 text-sm">
          Pre-Production · Phase I — Founding & First Light
        </p>
      </motion.div>
    </div>
  );
}
