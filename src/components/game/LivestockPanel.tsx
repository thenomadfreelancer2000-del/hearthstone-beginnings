import { useState } from "react";
import { useGame } from "@/game/store";
import { SPECIES_LABEL } from "@/game/sim/livestock";
import type { AnimalSpecies, ID } from "@/game/types";

export function LivestockPanel({ onClose }: { onClose: () => void }) {
  const animals = useGame((s) => s.animals);
  const families = useGame((s) => s.families);
  const buildings = useGame((s) => s.buildings);
  const survivors = useGame((s) => s.survivors);
  const [tab, setTab] = useState<"overview" | "byHouse">("overview");

  const alive = animals.filter((a) => !a.dead);
  const dead = animals.filter((a) => a.dead).length;
  const pregnancies = alive.filter((a) => a.pregnant).length;
  const ranchers = survivors.filter((s) => s.health > 0 && s.occupation === "rancher").length;
  const pens = buildings.filter((b) => b.builtProgress >= 1 && ["chicken-coop", "goat-pen", "sheep-pen", "cattle-pasture"].includes(b.kind));

  const counts: Record<AnimalSpecies, number> = { chicken: 0, goat: 0, sheep: 0, cattle: 0 };
  for (const a of alive) counts[a.species]++;

  const byFamily = new Map<ID, Record<AnimalSpecies, number>>();
  for (const a of alive) {
    if (!byFamily.has(a.ownerFamilyId)) byFamily.set(a.ownerFamilyId, { chicken: 0, goat: 0, sheep: 0, cattle: 0 });
    byFamily.get(a.ownerFamilyId)![a.species]++;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="parchment-panel corner-brackets w-full max-w-[560px] max-h-[80vh] overflow-auto scroll-amber p-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-baseline justify-between mb-3">
          <h3 className="ranch-display text-2xl text-amber">Livestock Ledger</h3>
          <button onClick={onClose} className="ranch-label text-dust hover:text-amber">close ×</button>
        </div>
        <div className="flex gap-2 mb-3">
          {(["overview", "byHouse"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-1 ranch-label text-[10px] border ${tab === t ? "border-amber text-amber bg-amber/10" : "border-amber/20 text-dust hover:text-parchment"}`}>
              {t === "overview" ? "Overview" : "By House"}
            </button>
          ))}
        </div>

        {tab === "overview" && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(Object.keys(counts) as AnimalSpecies[]).map((sp) => (
                <div key={sp} className="parchment-panel-warm p-2 text-center">
                  <div className="ranch-display text-xl text-parchment">{counts[sp]}</div>
                  <div className="ranch-label text-[10px] text-amber">{SPECIES_LABEL[sp]}</div>
                </div>
              ))}
            </div>
            <ul className="ranch-data text-[11px] text-dust space-y-0.5">
              <li>Total animals: <span className="text-parchment">{alive.length}</span></li>
              <li>Pregnancies: <span className="text-parchment">{pregnancies}</span></li>
              <li>Deaths recorded: <span className="text-danger">{dead}</span></li>
              <li>Assigned ranchers: <span className="text-parchment">{ranchers}</span></li>
              <li>Pens & coops: <span className="text-parchment">{pens.length}</span></li>
            </ul>
          </div>
        )}

        {tab === "byHouse" && (
          <table className="w-full ranch-data text-xs">
            <thead className="ranch-label text-amber">
              <tr><th className="text-left py-1">House</th><th>🐔</th><th>🐐</th><th>🐑</th><th>🐄</th><th>Total</th></tr>
            </thead>
            <tbody>
              {[...byFamily.entries()].map(([fid, c]) => {
                const fam = families.find((f) => f.id === fid);
                const total = c.chicken + c.goat + c.sheep + c.cattle;
                const known = topSpecies(c);
                return (
                  <tr key={fid} className="hover:bg-amber/5">
                    <td className="py-1 text-parchment">
                      House of {fam?.name ?? "?"}
                      {known && <span className="ranch-data text-[10px] text-amber ml-2">— Known for {SPECIES_LABEL[known].toLowerCase()}</span>}
                    </td>
                    <td className="text-center">{c.chicken}</td>
                    <td className="text-center">{c.goat}</td>
                    <td className="text-center">{c.sheep}</td>
                    <td className="text-center">{c.cattle}</td>
                    <td className="text-center text-amber">{total}</td>
                  </tr>
                );
              })}
              {byFamily.size === 0 && (
                <tr><td colSpan={6} className="text-center text-dust ranch-handwritten py-3">No livestock yet on the ranch.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function topSpecies(c: Record<AnimalSpecies, number>): AnimalSpecies | null {
  const entries = (Object.keys(c) as AnimalSpecies[]).map((k) => [k, c[k]] as const);
  entries.sort((a, b) => b[1] - a[1]);
  if (!entries[0] || entries[0][1] < 4) return null;
  if (entries[1] && entries[1][1] === entries[0][1]) return null;
  return entries[0][0];
}
