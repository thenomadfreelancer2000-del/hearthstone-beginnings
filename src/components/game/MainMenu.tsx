import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useGame } from "@/game/store";
import { hasSave } from "@/game/persistence";
import heroImage from "@/assets/menu-hero.jpg";
import { WorkshopPanel } from "./WorkshopPanel";

export function MainMenu() {
  const setScreen = useGame((s) => s.setScreen);
  const resume = useGame((s) => s.resumeFromSave);
  const [canResume, setCanResume] = useState(false);
  useEffect(() => {
    setCanResume(hasSave());
  }, []);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[color:var(--ink)]">
      {/* Hero image */}
      <motion.div
        initial={{ scale: 1.08, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 2.4, ease: [0.22, 1, 0.36, 1] }}
        className="absolute inset-0"
        style={{
          backgroundImage: `url(${heroImage})`,
          backgroundSize: "cover",
          backgroundPosition: "center 35%",
        }}
      />

      {/* Atmospheric overlays */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at 50% 40%, transparent 0%, rgba(11,9,7,0.55) 60%, rgba(5,4,2,0.95) 100%)",
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(180deg, rgba(11,9,7,0.6) 0%, transparent 20%, transparent 55%, rgba(5,4,2,0.92) 100%)",
        }}
      />
      {/* Subtle grain */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.07] mix-blend-overlay"
        style={{
          backgroundImage:
            "repeating-radial-gradient(circle at 50% 50%, rgba(255,255,255,0.3) 0, rgba(255,255,255,0.3) 1px, transparent 1px, transparent 3px)",
        }}
      />

      {/* Frame */}
      <div className="pointer-events-none absolute inset-6 md:inset-10 border border-[color:var(--amber)]/12" />
      <div className="pointer-events-none absolute inset-8 md:inset-12">
        <CornerMark className="top-0 left-0" />
        <CornerMark className="top-0 right-0 rotate-90" />
        <CornerMark className="bottom-0 right-0 rotate-180" />
        <CornerMark className="bottom-0 left-0 -rotate-90" />
      </div>


      {/* Content — bottom-left anchored */}
      <div className="absolute inset-0 z-10 flex items-end px-8 md:px-20 pb-20 md:pb-24">
        <motion.div
          initial="hidden"
          animate="show"
          variants={{
            hidden: {},
            show: { transition: { staggerChildren: 0.12, delayChildren: 0.4 } },
          }}
          className="max-w-2xl"
        >
          <motion.div
            variants={{
              hidden: { opacity: 0, y: 12 },
              show: { opacity: 1, y: 0, transition: { duration: 1.1, ease: [0.22, 1, 0.36, 1] } },
            }}
            className="flex items-center gap-3 mb-6"
          >
            <span className="h-px w-10 bg-[color:var(--amber)]/60" />
            <span className="ranch-label text-[color:var(--amber)]">
              A Frontier Dynasty Chronicle
            </span>
          </motion.div>

          <motion.h1
            variants={{
              hidden: { opacity: 0, y: 16 },
              show: { opacity: 1, y: 0, transition: { duration: 1.3, ease: [0.22, 1, 0.36, 1] } },
            }}
            className="ranch-display text-[color:var(--parchment)] leading-[0.92] tracking-[-0.03em]"
            style={{
              fontSize: "clamp(72px, 11vw, 168px)",
              textShadow: "0 8px 80px rgba(0,0,0,0.7), 0 2px 0 rgba(0,0,0,0.4)",
            }}
          >
            The Ranch
          </motion.h1>

          <motion.p
            variants={{
              hidden: { opacity: 0, y: 10 },
              show: { opacity: 1, y: 0, transition: { duration: 1.1 } },
            }}
            className="ranch-display italic text-[color:var(--parchment-dark)] mt-5 text-lg md:text-xl max-w-xl leading-snug"
          >
            Build a family. Build a people. Build a civilization —
            and pray your name survives what comes next.
          </motion.p>

          <motion.div
            variants={{
              hidden: { opacity: 0, y: 10 },
              show: { opacity: 1, y: 0, transition: { duration: 1, delay: 0.2 } },
            }}
            className="mt-10 flex flex-wrap items-center gap-3"
          >
            {canResume && (
              <button
                className="btn-ranch btn-ranch-primary"
                onClick={() => resume()}
              >
                Resume the Chronicle
              </button>
            )}
            <button
              className={`btn-ranch ${canResume ? "" : "btn-ranch-primary"}`}
              onClick={() => setScreen("founder")}
            >
              Begin a New Founding
            </button>
            <button className="btn-ranch btn-ranch-ghost opacity-70" disabled>
              Settings
            </button>
          </motion.div>
        </motion.div>
      </div>

    </div>
  );
}

function CornerMark({ className = "" }: { className?: string }) {
  return (
    <div className={`absolute w-5 h-5 ${className}`}>
      <div className="absolute top-0 left-0 w-full h-px bg-[color:var(--amber)]/50" />
      <div className="absolute top-0 left-0 h-full w-px bg-[color:var(--amber)]/50" />
    </div>
  );
}
