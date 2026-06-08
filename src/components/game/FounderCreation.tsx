import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useGame } from "@/game/store";
import { BACKGROUNDS, FIRST_NAMES_F, FIRST_NAMES_M, SURNAMES, TRAITS, TRAIT_BLURBS } from "@/game/data/content";
import type { Background, Trait } from "@/game/types";

const VALUES = ["Family", "Freedom", "Security", "Status", "Community"] as const;

export function FounderCreation() {
  const setScreen = useGame((s) => s.setScreen);
  const newGame = useGame((s) => s.newGame);
  const [gender, setGender] = useState<"m" | "f">("m");
  const [firstName, setFirstName] = useState("Eli");
  const [surname, setSurname] = useState("Hollow");
  const [ranchName, setRanchName] = useState("The Hollow Ranch");
  const [background, setBackground] = useState<Background>("rancher");
  const [traits, setTraits] = useState<Trait[]>(["Brave", "Principled", "Traditional"]);
  const [values, setValues] = useState<("Family" | "Freedom" | "Security" | "Status" | "Community")[]>(["Family", "Community"]);

  const firstNames = useMemo(() => gender === "m" ? FIRST_NAMES_M : FIRST_NAMES_F, [gender]);

  function toggleTrait(t: Trait) {
    setTraits(prev =>
      prev.includes(t) ? prev.filter(x => x !== t) : prev.length < 3 ? [...prev, t] : prev,
    );
  }
  function toggleValue(v: typeof VALUES[number]) {
    setValues(prev =>
      prev.includes(v) ? prev.filter(x => x !== v) : prev.length < 2 ? [...prev, v] : prev,
    );
  }

  const valid = traits.length === 3 && values.length === 2 && firstName && surname && ranchName;

  function begin() {
    if (!valid) return;
    newGame(ranchName, {
      firstName, surname, gender, background, traits, values,
    });
  }

  return (
    <div className="grain min-h-screen flex flex-col px-6 py-10 overflow-auto scroll-amber">
      <div className="pointer-events-none fixed inset-8 border border-[color:var(--amber)]/20" />
      <div className="max-w-5xl mx-auto w-full">
        <button onClick={() => setScreen("menu")} className="ranch-label hover:text-amber transition">
          ← Back
        </button>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mt-6"
        >
          <p className="ranch-label mb-2">Part I — The Founder</p>
          <h1 className="ranch-display text-5xl md:text-6xl mb-3">Who walked in first?</h1>
          <p className="ranch-display italic text-dust-light text-lg max-w-2xl">
            Every dynasty begins with a single person and a single decision.
            What you choose here will haunt your descendants. Or honor them.
          </p>
          <div className="divider-amber my-8" />

          <div className="grid md:grid-cols-2 gap-6">
            {/* Identity */}
            <section className="parchment-panel corner-brackets p-6">
              <h2 className="ranch-label mb-4">Identity</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="ranch-label text-[9px] block mb-1">First Name</label>
                  <select
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full bg-coal/60 border border-amber/30 px-3 py-2 ranch-body text-parchment"
                  >
                    {firstNames.map(n => <option key={n}>{n}</option>)}
                  </select>
                </div>
                <div>
                  <label className="ranch-label text-[9px] block mb-1">Surname</label>
                  <select
                    value={surname}
                    onChange={(e) => setSurname(e.target.value)}
                    className="w-full bg-coal/60 border border-amber/30 px-3 py-2 ranch-body text-parchment"
                  >
                    {SURNAMES.map(n => <option key={n}>{n}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="ranch-label text-[9px] block mb-1">Ranch Name</label>
                  <input
                    value={ranchName}
                    onChange={(e) => setRanchName(e.target.value)}
                    className="w-full bg-coal/60 border border-amber/30 px-3 py-2 ranch-body text-parchment"
                  />
                </div>
                <div className="col-span-2 flex gap-2">
                  {(["m", "f"] as const).map(g => (
                    <button
                      key={g}
                      onClick={() => setGender(g)}
                      className={`btn-ranch flex-1 ${gender === g ? "btn-ranch-primary" : ""}`}
                    >
                      {g === "m" ? "He" : "She"}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            {/* Background */}
            <section className="parchment-panel corner-brackets p-6">
              <h2 className="ranch-label mb-4">Before the End</h2>
              <div className="grid grid-cols-2 gap-2">
                {BACKGROUNDS.map(bg => (
                  <button
                    key={bg.id}
                    onClick={() => setBackground(bg.id)}
                    className={`btn-ranch text-left ${background === bg.id ? "btn-ranch-primary" : ""}`}
                  >
                    {bg.name}
                  </button>
                ))}
              </div>
              <p className="ranch-handwritten mt-4 text-sm">
                {BACKGROUNDS.find(b => b.id === background)?.blurb}
              </p>
            </section>

            {/* Traits */}
            <section className="parchment-panel corner-brackets p-6 md:col-span-2">
              <div className="flex items-baseline justify-between mb-4">
                <h2 className="ranch-label">Three Traits That Will Never Change</h2>
                <span className="ranch-data">{traits.length} / 3</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                {TRAITS.map(t => {
                  const active = traits.includes(t);
                  const disabled = !active && traits.length >= 3;
                  return (
                    <button
                      key={t}
                      disabled={disabled}
                      onClick={() => toggleTrait(t)}
                      className={`btn-ranch ${active ? "btn-ranch-primary" : ""}`}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
              <div className="mt-4 space-y-1">
                {traits.map(t => (
                  <p key={t} className="ranch-handwritten text-sm">
                    <span className="text-amber">{t}.</span> {TRAIT_BLURBS[t]}
                  </p>
                ))}
              </div>
            </section>

            {/* Values */}
            <section className="parchment-panel corner-brackets p-6 md:col-span-2">
              <div className="flex items-baseline justify-between mb-4">
                <h2 className="ranch-label">Two Things You Will Not Compromise</h2>
                <span className="ranch-data">{values.length} / 2</span>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {VALUES.map(v => {
                  const active = values.includes(v);
                  const disabled = !active && values.length >= 2;
                  return (
                    <button
                      key={v}
                      disabled={disabled}
                      onClick={() => toggleValue(v)}
                      className={`btn-ranch ${active ? "btn-ranch-primary" : ""}`}
                    >
                      {v}
                    </button>
                  );
                })}
              </div>
            </section>
          </div>

          <div className="divider-amber my-10" />
          <div className="flex justify-end gap-3">
            <button className="btn-ranch" onClick={() => setScreen("menu")}>Reconsider</button>
            <button
              className="btn-ranch btn-ranch-primary"
              disabled={!valid}
              onClick={begin}
            >
              Walk onto the porch
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
