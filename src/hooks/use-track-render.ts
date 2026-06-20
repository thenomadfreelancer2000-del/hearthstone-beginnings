import { useRef } from "react";
import { trackRender } from "@/game/profiler";

/** Increments a render counter every time the host component re-renders. */
export function useTrackRender(name: string) {
  const n = useRef(name);
  n.current = name;
  trackRender(n.current);
}
