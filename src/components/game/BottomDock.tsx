import { useState } from "react";
import { toast } from "sonner";
import { useGame } from "@/game/store";
import { BUILDABLE_KINDS, BUILDINGS } from "@/game/data/content";
import { useWorkshop } from "@/game/workshop/store";
import { workshopKindOf, WORKSHOP_CATEGORIES, type WorkshopCategory } from "@/game/workshop/types";
import { WorkshopPanel } from "./WorkshopPanel";
import type { BuildingKind } from "@/game/types";
import { MoodFace } from "./MoodFace";


export function BottomDock() {
  const [tab, setTab] = useState<"build" | "people" | "chronicle" | null>(null);
  const [workshopOpen, setWorkshopOpen] = useState(false);
  const open = tab !== null;
  return (
    <div className="parchment-panel border-t border-amber/30">
      <div className="flex border-b border-amber/15 items-center">
        {(["build", "people", "chronicle"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(tab === t ? null : t)}
            className={`px-3 sm:px-4 py-2 ranch-label text-[11px] ${tab === t ? "text-amber border-b-2 border-amber" : "text-dust hover:text-parchment"}`}
          >
            {t}
          </button>
        ))}
        <button
          onClick={() => setWorkshopOpen(true)}
          className="px-3 sm:px-4 py-2 ranch-label text-[11px] text-dust hover:text-amber"
          title="Community building packs"
        >
          ✦ workshop
        </button>
        {open && (
          <button
            onClick={() => setTab(null)}
            className="ml-auto mr-2 ranch-label text-[10px] text-dust hover:text-amber px-2 py-1"
            title="Collapse"
          >
            ▼ collapse
          </button>
        )}
      </div>
      {open && (
        <div className="p-2 sm:p-3 max-h-[45vh] sm:max-h-[200px] overflow-auto scroll-amber">
          {tab === "build" && <BuildMenu onOpenWorkshop={() => setWorkshopOpen(true)} />}
          {tab === "people" && <PeopleList />}
          {tab === "chronicle" && <ChronicleList />}
        </div>
      )}
      <WorkshopPanel open={workshopOpen} onOpenChange={setWorkshopOpen} />
    </div>
  );
}


const BUILD_CATEGORIES: { id: string; label: string; kinds: import("@/game/types").BuildingKind[] }[] = [
  { id: "shelter",   label: "Shelter",   kinds: ["tent", "family-tent", "cabin", "family-cabin", "house", "family-house", "large-house", "manor", "founder-manor", "bunkhouse", "guest-house", "orphan-house", "elder-house"] },
  { id: "farming",   label: "Farming",   kinds: ["farm-plot", "field", "large-field", "orchard", "greenhouse"] },
  { id: "food",      label: "Food",      kinds: ["foraging-camp"] },
  { id: "water",     label: "Water",     kinds: ["water-collector", "water-barrel", "well", "stone-well", "deep-well", "water-tower", "reservoir"] },
  { id: "crafting",  label: "Crafting",  kinds: ["workbench"] },
  { id: "storage",   label: "Storage",   kinds: ["stockpile", "food-stockpile", "warehouse", "granary", "root-cellar", "cold-storage"] },
  { id: "social",    label: "Social",    kinds: ["campfire"] },
  { id: "defense",   label: "Defense",   kinds: ["fence", "palisade", "stone-wall", "gate", "watchtower", "guard-post"] },
  { id: "livestock", label: "Livestock", kinds: ["chicken-coop", "goat-pen", "sheep-pen", "cattle-pasture", "dairy-barn", "breeding-barn", "livestock-shelter"] },
  { id: "education", label: "Education", kinds: ["learning-tent", "schoolhouse", "academy", "library"] },
  { id: "medical",   label: "Medical",   kinds: ["medical-tent", "clinic", "infirmary", "hospital"] },
  { id: "roads",     label: "Roads",     kinds: ["dirt-path", "dirt-road", "gravel-road", "paved-road", "stone-road"] },

];

// Maps a workshop category to the existing build menu category id so
// custom buildings show up next to their vanilla cousins.
const WORKSHOP_TO_DOCK: Record<WorkshopCategory, string> = {
  housing: "shelter",
  homestead: "shelter",
  farm: "farming",
  livestock: "livestock",
  storage: "storage",
  water: "water",
  school: "education",
  medical: "medical",
  decoration: "social",
  road: "roads",
  fence: "defense",
};

function BuildMenu({ onOpenWorkshop }: { onOpenWorkshop: () => void }) {
  const buildPlacement = useGame((s) => s.buildPlacement);
  const startBuild = useGame((s) => s.startBuild);
  const cancelBuild = useGame((s) => s.cancelBuild);
  const resources = useGame((s) => s.resources);
  const wsPacks = useWorkshop((s) => s.packs);
  const wsEnabled = useWorkshop((s) => s.enabled);
  const workshopActive = wsPacks.flatMap((p) =>
    wsEnabled[p.id] ? p.buildings.map((building) => ({ pack: p, building })) : [],
  );

  const [cat, setCat] = useState<string>("food");

  // Workshop kinds bucketed into their target dock category, plus a
  // dedicated "workshop" category that shows them all together.
  const workshopKindsByDockCat = new Map<string, BuildingKind[]>();
  const allWorkshopKinds: BuildingKind[] = [];
  for (const { pack, building } of workshopActive) {
    const k = workshopKindOf(pack.id, building.id);
    allWorkshopKinds.push(k);
    const dockCat = WORKSHOP_TO_DOCK[building.category];
    const arr = workshopKindsByDockCat.get(dockCat) ?? [];
    arr.push(k);
    workshopKindsByDockCat.set(dockCat, arr);
  }

  const active = BUILD_CATEGORIES.find((c) => c.id === cat) ?? BUILD_CATEGORIES[0];
  const known = new Set(BUILD_CATEGORIES.flatMap((c) => c.kinds));
  const orphans = BUILDABLE_KINDS.filter((k) => !known.has(k));
  const kinds =
    cat === "workshop"
      ? allWorkshopKinds
      : cat === "other"
      ? orphans
      : [...active.kinds, ...(workshopKindsByDockCat.get(active.id) ?? [])];


  return (
    <div>
      {buildPlacement && (
        <div className="ranch-handwritten text-sm text-amber mb-2 flex items-center gap-3">
          Placing <span className="text-parchment">{buildPlacement.kind}</span> — click on the map. Right-click to cancel.
          <button className="btn-ranch btn-ranch-ghost" onClick={cancelBuild}>Cancel</button>
        </div>
      )}
      <div className="flex flex-wrap gap-1 mb-2">
        {BUILD_CATEGORIES.map((c) => (
          <button
            key={c.id}
            onClick={() => setCat(c.id)}
            className={`px-2 py-1 ranch-label text-[10px] border ${cat === c.id ? "border-amber text-amber bg-amber/10" : "border-amber/20 text-dust hover:text-parchment"}`}
          >
            {c.label}
          </button>
        ))}
        {allWorkshopKinds.length > 0 && (
          <button
            onClick={() => setCat("workshop")}
            className={`px-2 py-1 ranch-label text-[10px] border ${cat === "workshop" ? "border-amber text-amber bg-amber/10" : "border-amber/30 text-amber/80 hover:text-amber"}`}
            title="Buildings from enabled workshop packs"
          >
            ✦ Workshop ({allWorkshopKinds.length})
          </button>
        )}
        <button
          onClick={onOpenWorkshop}
          className="px-2 py-1 ranch-label text-[10px] border border-amber/20 text-dust hover:text-amber ml-auto"
          title="Manage community packs"
        >
          + manage packs
        </button>
        {orphans.length > 0 && (
          <button
            onClick={() => setCat("other")}
            className={`px-2 py-1 ranch-label text-[10px] border ${cat === "other" ? "border-amber text-amber bg-amber/10" : "border-amber/20 text-dust hover:text-parchment"}`}
          >
            Other
          </button>
        )}

      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
        {kinds.map((k) => {
          const def = BUILDINGS[k];
          const missing = Object.entries(def.cost)
            .map(([r, amt]) => [r, Math.max(0, (amt ?? 0) - ((resources as any)[r] ?? 0))] as const)
            .filter(([, m]) => m > 0);
          const affordable = missing.length === 0;
          return (
            <button
              key={k}
              onClick={() => {
                if (!affordable) {
                  toast.error(
                    `Can't build ${def.name} — missing ${missing.map(([r, m]) => `${m} ${r}`).join(", ")}`,
                  );
                  return;
                }
                startBuild(k);
              }}
              className={`btn-ranch text-left p-2 flex flex-col ${buildPlacement?.kind === k ? "btn-ranch-primary" : ""} ${!affordable ? "opacity-60" : ""}`}
              title={affordable ? def.blurb : `Missing: ${missing.map(([r, m]) => `${m} ${r}`).join(", ")}`}
            >
              <span className="text-[11px]">{def.name}</span>
              <span className="ranch-handwritten text-[10px] text-dust-light mt-0.5 line-clamp-2">{def.blurb}</span>
              <span className="ranch-data text-[10px] mt-1 normal-case tracking-normal text-dust">
                {Object.entries(def.cost).map(([r, a]) => `${a}${r[0].toUpperCase()}`).join(" ") || "free"}
              </span>
              {!affordable && (
                <span className="ranch-data text-[10px] mt-0.5 text-danger normal-case tracking-normal">
                  need {missing.map(([r, m]) => `${m}${r[0].toUpperCase()}`).join(" ")}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PeopleList() {
  const survivors = useGame((s) => s.survivors);
  const select = useGame((s) => s.selectSurvivor);
  return (
    <table className="w-full ranch-data text-xs">
      <thead className="ranch-label text-amber">
        <tr><th className="text-left py-1">Name</th><th>Role</th><th>Mood</th><th>Health</th><th>Doing</th></tr>
      </thead>
      <tbody>
        {survivors.map((s) => (
          <tr key={s.id} className="hover:bg-amber/5 cursor-pointer" onClick={() => select(s.id)}>
            <td className="py-1 text-parchment">
              {s.isFounder && "★ "}{s.name} {s.surname}
            </td>
            <td className="text-center text-dust-light">{s.occupation}</td>
            <td className={`text-center ${s.mood >= 0 ? "text-success" : "text-danger"}`}>{Math.round(s.mood)}</td>
            <td className={`text-center ${s.health < 30 ? "text-danger" : "text-dust-light"}`}>{Math.round(s.health)}</td>
            <td className="text-dust ranch-handwritten">{s.action}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ChronicleList() {
  const chronicle = useGame((s) => s.chronicle);
  return (
    <ul className="space-y-2">
      {chronicle.map((c) => (
        <li key={c.id} className="border-l-2 border-amber/40 pl-3">
          <div className="ranch-label text-[9px] text-amber">
            Year {c.year} · {c.season} · Day {c.day} · {c.category}
          </div>
          <div className="ranch-display text-base text-parchment">{c.title}</div>
          <div className="ranch-handwritten text-sm text-dust-light">{c.body}</div>
        </li>
      ))}
    </ul>
  );
}
