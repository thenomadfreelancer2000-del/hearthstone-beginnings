import { useMemo, useState } from "react";
import { useGame } from "@/game/store";
import { moodFace, moodFaceFromAvg, computeMoodReasons, type MoodReason } from "@/game/sim/moodFace";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Survivor } from "@/game/types";

type Size = "xs" | "sm" | "md" | "lg";

const SIZE_MAP: Record<Size, string> = {
  xs: "text-sm leading-none",
  sm: "text-base leading-none",
  md: "text-xl leading-none",
  lg: "text-3xl leading-none",
};

interface MoodFaceProps {
  survivor: Survivor;
  size?: Size;
  /** Show the label next to the face. */
  showLabel?: boolean;
  /** Compact label only (no detail dialog on click). */
  readOnly?: boolean;
  className?: string;
}

/**
 * Visual mood indicator for a single survivor.
 * Hover → top-3 reasons tooltip. Click → full breakdown dialog.
 */
export function MoodFace({
  survivor, size = "md", showLabel = true, readOnly = false, className = "",
}: MoodFaceProps) {
  const buildings = useGame((s) => s.buildings);
  const survivors = useGame((s) => s.survivors);
  const [open, setOpen] = useState(false);

  const info = moodFace(survivor.mood);
  const reasons = useMemo(
    () => computeMoodReasons(survivor, { buildings, survivors }),
    [survivor, buildings, survivors],
  );
  const top = reasons.slice(0, 3);

  const content = (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <span className={SIZE_MAP[size]} aria-hidden>{info.emoji}</span>
      {showLabel && (
        <span className={`ranch-data text-[11px] ${info.tone}`}>{info.label}</span>
      )}
    </span>
  );

  if (readOnly) return content;

  return (
    <>
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setOpen(true); }}
              className="hover:opacity-80 transition-opacity"
              aria-label={`Mood: ${info.label}. Click for details.`}
            >
              {content}
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="parchment-panel border-amber/40 max-w-[220px]">
            <div className="ranch-display text-sm mb-1">
              <span className="mr-1">{info.emoji}</span>{info.label}
            </div>
            {top.length === 0 ? (
              <div className="ranch-data text-[10px] text-dust">Nothing of note.</div>
            ) : (
              <ul className="ranch-data text-[10px] space-y-0.5">
                {top.map((r, i) => (
                  <li key={i} className="flex justify-between gap-2">
                    <span className="truncate">• {r.label}</span>
                    <span className={r.weight >= 0 ? "text-success" : "text-danger"}>
                      {r.weight > 0 ? "+" : ""}{r.weight}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <div className="ranch-label text-[9px] text-dust-light mt-1.5">tap for full breakdown</div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="parchment-panel border-amber/40 max-w-md">
          <DialogHeader>
            <DialogTitle className="ranch-display text-2xl flex items-center gap-2">
              <span className="text-3xl" aria-hidden>{info.emoji}</span>
              <span className={info.tone}>{info.label}</span>
            </DialogTitle>
          </DialogHeader>
          <p className="ranch-handwritten text-sm text-dust-light">
            How {survivor.name} {survivor.surname} feels right now
            <span className="text-dust"> · mood score {Math.round(survivor.mood)}</span>
          </p>
          <ReasonsBreakdown reasons={reasons} />
        </DialogContent>
      </Dialog>
    </>
  );
}

function ReasonsBreakdown({ reasons }: { reasons: MoodReason[] }) {
  const positives = reasons.filter(r => r.weight > 0);
  const negatives = reasons.filter(r => r.weight < 0);
  return (
    <div className="space-y-3 mt-2">
      {negatives.length > 0 && (
        <section>
          <h4 className="ranch-label text-[10px] text-danger mb-1">Weighing on them</h4>
          <ul className="ranch-data text-xs space-y-1">
            {negatives.map((r, i) => (
              <li key={i} className="flex justify-between gap-2">
                <span className="text-parchment">− {r.label}</span>
                <span className="text-danger ranch-data">{r.weight}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {positives.length > 0 && (
        <section>
          <h4 className="ranch-label text-[10px] text-success mb-1">Lifting them up</h4>
          <ul className="ranch-data text-xs space-y-1">
            {positives.map((r, i) => (
              <li key={i} className="flex justify-between gap-2">
                <span className="text-parchment">+ {r.label}</span>
                <span className="text-success ranch-data">+{r.weight}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {reasons.length === 0 && (
        <p className="ranch-handwritten text-sm text-dust">
          Nothing in particular — a quiet day.
        </p>
      )}
    </div>
  );
}

/** Compact, non-interactive face for an average mood (e.g. family roll-up). */
export function MoodFaceAvg({ avg, size = "sm", showLabel = true }:
  { avg: number; size?: Size; showLabel?: boolean }) {
  const info = moodFaceFromAvg(avg);
  return (
    <span className="inline-flex items-center gap-1">
      <span className={SIZE_MAP[size]} aria-hidden>{info.emoji}</span>
      {showLabel && <span className={`ranch-data text-[10px] ${info.tone}`}>{info.label}</span>}
    </span>
  );
}
