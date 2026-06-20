import { useEffect, useState } from "react";
import { useGame } from "@/game/store";
import {
  getEntries, getFps, getRenderCounts, resetEntries,
  isPanelOpen, setPanelOpen, subscribePanel,
} from "@/game/profiler";

/**
 * Hidden developer performance panel.
 * Toggle: Ctrl+Shift+P (or ?perf=1 in URL).
 * Read-only: collects timings already captured by `measure()` calls.
 */
export function PerfPanel() {
  const [open, setOpen] = useState<boolean>(isPanelOpen());
  const [, force] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => subscribePanel(setOpen), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && (e.key === "P" || e.key === "p")) {
        e.preventDefault();
        setPanelOpen(!isPanelOpen());
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Refresh ~3×/s while open
  useEffect(() => {
    if (!open) return;
    const id = window.setInterval(() => force((v) => v + 1), 333);
    return () => window.clearInterval(id);
  }, [open]);

  // Pull current state (all selectors are simple counts — no shallow-list churn)
  const survivors = useGame((s) => s.survivors);
  const families = useGame((s) => s.families);
  const buildings = useGame((s) => s.buildings);
  const relationships = useGame((s) => s.relationships);
  const animals = useGame((s) => s.animals);
  const expeditions = useGame((s) => s.expeditions);

  if (!open) return null;

  const { fps, avgFrameMs } = getFps();
  const entries = getEntries().slice().sort((a, b) => b.totalMs - a.totalMs);
  const top = entries.filter((e) => !e.name.startsWith("@")).slice(0, 10);
  const tickEntry = entries.find((e) => e.name === "@tick");
  const renders = getRenderCounts().sort((a, b) => b.count - a.count).slice(0, 12);

  const houses = buildings.filter((b) => b.kind === "homestead" || /home|house|hut|shelter|cabin|cottage|tent/i.test(b.kind)).length;

  // Survivor state breakdown (proxy for "active jobs / pathfinding")
  const stateCounts: Record<string, number> = {};
  let alive = 0;
  for (const s of survivors) {
    if (s.health <= 0) continue;
    alive += 1;
    stateCounts[s.state] = (stateCounts[s.state] ?? 0) + 1;
  }
  const moving = stateCounts.moving ?? 0;
  const working = stateCounts.working ?? 0;
  const idle = stateCounts.idle ?? 0;
  const activeExpeditions = expeditions.filter((e) => e.status === "active" || e.status === "planned").length;

  return (
    <div
      style={{
        position: "fixed", top: 8, left: 8, zIndex: 9999,
        width: 360, maxHeight: "92vh", overflow: "auto",
        background: "rgba(10,10,12,0.92)", color: "#e8e6df",
        font: "11px/1.35 ui-monospace, SFMono-Regular, Menlo, monospace",
        border: "1px solid #5a4a2a", padding: 8,
        pointerEvents: "auto",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <strong style={{ color: "#e6b35c" }}>PERF</strong>
        <div>
          <button onClick={() => { resetEntries(); force((v) => v + 1); }} style={btnStyle}>reset</button>
          <button onClick={() => exportJson(buildReport(survivors, families, buildings, relationships, animals, expeditions))} style={btnStyle}>export</button>
          <button onClick={() => copyReport(buildReport(survivors, families, buildings, relationships, animals, expeditions), setCopied)} style={btnStyle}>{copied ? "✓" : "copy"}</button>
          <button onClick={() => setPanelOpen(false)} style={btnStyle}>×</button>
        </div>
      </div>

      <Section title="Frame">
        <Row k="FPS" v={fps.toFixed(1)} />
        <Row k="Avg frame" v={`${avgFrameMs.toFixed(2)} ms`} />
        <Row k="Tick (last)" v={tickEntry ? `${tickEntry.lastMs.toFixed(2)} ms` : "—"} />
        <Row k="Tick (avg)" v={tickEntry && tickEntry.calls ? `${(tickEntry.totalMs / tickEntry.calls).toFixed(2)} ms` : "—"} />
        <Row k="Tick (max)" v={tickEntry ? `${tickEntry.maxMs.toFixed(2)} ms` : "—"} />
      </Section>

      <Section title="World">
        <Row k="Survivors (alive/total)" v={`${alive} / ${survivors.length}`} />
        <Row k="Families" v={families.length} />
        <Row k="Houses" v={houses} />
        <Row k="Buildings" v={buildings.length} />
        <Row k="Relationships" v={relationships.length} />
        <Row k="Animals (livestock)" v={animals.length} />
        <Row k="Active expeditions" v={activeExpeditions} />
        <Row k="Survivor states" v={`mov:${moving} work:${working} idle:${idle}`} />
      </Section>

      <Section title="Top systems (by total time)">
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ color: "#a89970", textAlign: "left" }}>
              <th>name</th><th style={{ textAlign: "right" }}>calls</th>
              <th style={{ textAlign: "right" }}>total</th>
              <th style={{ textAlign: "right" }}>avg</th>
              <th style={{ textAlign: "right" }}>max</th>
            </tr>
          </thead>
          <tbody>
            {top.map((e) => (
              <tr key={e.name}>
                <td>{e.name}</td>
                <td style={{ textAlign: "right" }}>{e.calls}</td>
                <td style={{ textAlign: "right" }}>{e.totalMs.toFixed(1)}</td>
                <td style={{ textAlign: "right" }}>{(e.totalMs / Math.max(1, e.calls)).toFixed(2)}</td>
                <td style={{ textAlign: "right" }}>{e.maxMs.toFixed(2)}</td>
              </tr>
            ))}
            {top.length === 0 && <tr><td colSpan={5} style={{ opacity: 0.6 }}>no samples yet — let the game run</td></tr>}
          </tbody>
        </table>
      </Section>

      <Section title="React re-renders (tracked components)">
        {renders.length === 0
          ? <div style={{ opacity: 0.6 }}>no components use useTrackRender yet</div>
          : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr style={{ color: "#a89970", textAlign: "left" }}><th>name</th><th style={{ textAlign: "right" }}>renders</th></tr></thead>
              <tbody>
                {renders.map((r) => (
                  <tr key={r.name}><td>{r.name}</td><td style={{ textAlign: "right" }}>{r.count}</td></tr>
                ))}
              </tbody>
            </table>
          )}
      </Section>

      <div style={{ marginTop: 6, opacity: 0.55, fontSize: 10 }}>
        Ctrl+Shift+P to toggle · window.__ranchProfiler for live data
      </div>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  background: "transparent", color: "#e6b35c", border: "1px solid #5a4a2a",
  marginLeft: 4, padding: "1px 6px", cursor: "pointer", font: "inherit",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 6, paddingTop: 4, borderTop: "1px dashed #3a3120" }}>
      <div style={{ color: "#e6b35c", marginBottom: 2 }}>{title}</div>
      {children}
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <span style={{ opacity: 0.75 }}>{k}</span>
      <span>{v}</span>
    </div>
  );
}
