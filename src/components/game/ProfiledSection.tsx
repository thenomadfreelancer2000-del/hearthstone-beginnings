import React from "react";
import { recordRender } from "@/game/profiler";

/** Wraps children in React.Profiler and feeds commit time into the profiler. */
export function ProfiledSection({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <React.Profiler
      id={id}
      onRender={(_id, _phase, actualDuration) => recordRender(id, actualDuration)}
    >
      {children}
    </React.Profiler>
  );
}
