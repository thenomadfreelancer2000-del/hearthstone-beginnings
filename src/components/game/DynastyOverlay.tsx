import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGame } from "@/game/store";
import type { Family, Survivor } from "@/game/types";

export function DynastyOverlay() {
  const setOverlay = useGame((s) => s.setOverlay);
  const survivors = useGame((s) => s.survivors);
  const families = useGame((s) => s.families);
  const founderId = useGame((s) => s.founderId);
  const currentLeaderId = useGame((s) => s.currentLeaderId);
  const ranchName = useGame((s) => s.ranchName);
  const stats = useGame((s) => s.stats);
  const time = useGame((s) => s.time);
  const selectSurvivor = useGame((s) => s.selectSurvivor);

  const [view, setView] = useState<"tree" | "families">("tree");

  const founder = survivors.find((s) => s.id === founderId);
  const founderFamily = families.find((f) => f.id === founder?.familyId);

  // Build generation rows from founder line
  const generations = useMemo(() => {
    if (!founder) return [];
    const byGen: Record<number, Survivor[]> = {};
    const visit = (id: string, gen: number) => {
      const s = survivors.find((x) => x.id === id);
      if (!s) return;
      if (!byGen[gen]) byGen[gen] = [];
      if (byGen[gen].some((x) => x.id === s.id)) return;
      byGen[gen].push(s);
      // include spouse on same row
      if (s.spouseId) {
        const sp = survivors.find((x) => x.id === s.spouseId);
        if (sp && !byGen[gen].some((x) => x.id === sp.id)) byGen[gen].push(sp);
      }
      for (const cid of s.childrenIds) visit(cid, gen + 1);
    };
    visit(founder.id, 0);
    return Object.entries(byGen)
      .map(([g, arr]) => ({ gen: Number(g), people: arr }))
      .sort((a, b) => a.gen - b.gen);
  }, [founder, survivors]);

  return (
    <div className="fixed inset-0 z-40 bg-coal/95 backdrop-blur-md grain flex flex-col">
      <div className="pointer-events-none fixed inset-6 border border-amber/15 hidden sm:block" />

      <header className="px-4 sm:px-10 pt-5 pb-4 flex items-center justify-between gap-4 shrink-0">
        <div>
          <p className="ranch-label">The Dynasty</p>
          <h1 className="ranch-display text-3xl sm:text-5xl leading-none">
            House of <span className="text-amber">{founderFamily?.name ?? "—"}</span>
          </h1>
          <p className="ranch-display italic text-dust-light text-sm sm:text-base mt-2">
            of {ranchName} · founded Year {stats.foundedYear} · now Year {time.year}
          </p>
        </div>
        <button onClick={() => setOverlay(null)} className="btn-ranch btn-ranch-ghost">Close</button>
      </header>

      <div className="px-4 sm:px-10 pb-3 flex gap-2 shrink-0">
        {(["tree", "families"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`btn-ranch ${view === v ? "btn-ranch-primary" : ""}`}
          >
            {v === "tree" ? "Family Tree" : "All Houses"}
          </button>
        ))}
        <div className="ml-auto hidden sm:flex items-center gap-4 ranch-data text-xs text-dust">
          <Stat label="Souls" v={stats.population} />
          <Stat label="Born" v={stats.totalBorn} />
          <Stat label="Lost" v={stats.totalDied} />
          <Stat label="Generations" v={stats.generations + 1} />
          <Stat label="Prestige" v={Math.round(stats.prestige)} />
        </div>
      </div>

      <main className="flex-1 overflow-auto scroll-amber px-4 sm:px-10 pb-10">
        <AnimatePresence mode="wait">
          {view === "tree" ? (
            <motion.div
              key="tree"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-8 pt-2"
            >
              {generations.length === 0 && (
                <p className="ranch-handwritten text-dust">No founder recorded yet.</p>
              )}
              {generations.map(({ gen, people }) => (
                <section key={gen}>
                  <div className="flex items-center gap-3 mb-3">
                    <span className="ranch-label text-amber">Generation {gen + 1}</span>
                    <span className="h-px flex-1 bg-amber/20" />
                    <span className="ranch-data text-[10px] text-dust">{people.length} {people.length === 1 ? "soul" : "souls"}</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {people.map((p) => (
                      <PersonCard
                        key={p.id}
                        s={p}
                        isFounder={p.id === founderId}
                        isLeader={p.id === currentLeaderId}
                        onClick={() => { selectSurvivor(p.id); setOverlay(null); }}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </motion.div>
          ) : (
            <motion.div
              key="families"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2"
            >
              {families.map((f) => (
                <FamilyCard key={f.id} f={f} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

function Stat({ label, v }: { label: string; v: number }) {
  return (
    <span className="inline-flex items-baseline gap-1">
      <span className="ranch-label text-[9px]">{label}</span>
      <span className="text-amber">{v}</span>
    </span>
  );
}

function PersonCard({
  s, isFounder, isLeader, onClick,
}: { s: Survivor; isFounder: boolean; isLeader: boolean; onClick: () => void }) {
  const dead = s.health <= 0;
  return (
    <button
      onClick={onClick}
      className={`parchment-panel corner-brackets p-3 text-left hover:border-amber transition ${dead ? "opacity-60" : ""}`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="ranch-display text-lg leading-tight text-parchment">
          {s.name} <span className="text-amber">{s.surname}</span>
        </span>
        <span className="ranch-data text-[10px] text-dust">
          {dead ? "†" : `${Math.floor(s.age)}y`}
        </span>
      </div>
      <p className="ranch-label text-[9px] mt-1 text-amber">
        {isFounder && "★ Founder · "}
        {isLeader && !dead && "◆ Leader · "}
        {s.stage}{s.spouseId ? " · wed" : ""}
      </p>
      <p className="ranch-handwritten text-xs text-dust-light mt-1 line-clamp-1">
        {dead ? `Passed Y${s.deathYear}` : s.action}
      </p>
      {s.traits.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {s.traits.slice(0, 3).map(t => (
            <span key={t} className="ranch-label text-[8px] border border-amber/30 px-1.5 py-0.5 text-parchment-dark">
              {t}
            </span>
          ))}
        </div>
      )}
    </button>
  );
}

function FamilyCard({ f }: { f: Family }) {
  const survivors = useGame((s) => s.survivors);
  const chronicle = useGame((s) => s.chronicle);
  const alive = f.memberIds.filter(id => {
    const m = survivors.find(x => x.id === id);
    return m && m.health > 0;
  }).length;
  const counts = useMemo(() => {
    let births = 0, marriages = 0, deaths = 0;
    for (const c of chronicle) {
      if (!c.involvedFamilyIds?.includes(f.id)) continue;
      if (c.category === "birth") births++;
      else if (c.category === "marriage") marriages++;
      else if (c.category === "death") deaths++;
    }
    return { births, marriages, deaths };
  }, [chronicle, f.id]);
  return (
    <div className="parchment-panel corner-brackets p-4">
      <div className="flex items-baseline justify-between">
        <h3 className="ranch-display text-xl">House of <span className="text-amber">{f.name}</span></h3>
        {f.extinctYear && <span className="ranch-label text-[10px] text-danger">extinct Y{f.extinctYear}</span>}
      </div>
      <p className="ranch-data text-xs text-dust mt-1">
        Founded Y{f.foundedYear} · {f.memberIds.length} members · {alive} living
      </p>
      <div className="divider-amber my-3" />
      <div className="grid grid-cols-3 gap-2 ranch-data text-xs">
        <div>
          <span className="ranch-label text-[9px] block">Prestige</span>
          <span className="text-amber">{Math.round(f.prestige)}</span>
        </div>
        <div>
          <span className="ranch-label text-[9px] block">Wealth</span>
          <span className="text-amber">{Math.round(f.wealth)}</span>
        </div>
        <div>
          <span className="ranch-label text-[9px] block">Living</span>
          <span className="text-amber">{alive}</span>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 ranch-data text-xs mt-2">
        <div>
          <span className="ranch-label text-[9px] block">Births</span>
          <span className="text-success">{counts.births}</span>
        </div>
        <div>
          <span className="ranch-label text-[9px] block">Marriages</span>
          <span className="text-amber-light">{counts.marriages}</span>
        </div>
        <div>
          <span className="ranch-label text-[9px] block">Deaths</span>
          <span className="text-danger">{counts.deaths}</span>
        </div>
      </div>
      {Object.keys(f.relations).length > 0 && (
        <>
          <h4 className="ranch-label text-[9px] mt-3 mb-1">Bonds</h4>
          <ul className="ranch-handwritten text-xs text-dust-light space-y-0.5">
            {Object.entries(f.relations).slice(0, 4).map(([fid, v]) => {
              const other = useGame.getState().families.find(x => x.id === fid);
              if (!other) return null;
              return <li key={fid}>· {other.name}: {Math.round(v)}</li>;
            })}
          </ul>
        </>
      )}
    </div>
  );
}
