import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGame } from "@/game/store";
import { BACKGROUNDS, FIRST_NAMES_F, FIRST_NAMES_M, SURNAMES, TRAITS, TRAIT_BLURBS } from "@/game/data/content";
import { PORTRAITS, defaultPortraitFor } from "@/game/data/portraits";
import type { Background, Trait } from "@/game/types";
import type { CompanionsChoice } from "@/game/sim/world";

const VALUES = ["Family", "Freedom", "Security", "Status", "Community"] as const;
type Value = typeof VALUES[number];

const STEPS = [
  { id: 1, label: "Name" },
  { id: 2, label: "Past" },
  { id: 3, label: "Traits" },
  { id: 4, label: "Values" },
  { id: 5, label: "Company" },
] as const;

const STEP_TITLES: Record<number, { eyebrow: string; title: string; sub: string }> = {
  1: {
    eyebrow: "Step I — A Name on the Wind",
    title: "Who walked in first?",
    sub: "Every dynasty begins with a single person and a single decision. Start with a name.",
  },
  2: {
    eyebrow: "Step II — Before the End",
    title: "What did you used to be?",
    sub: "The world you came from will not return. But its lessons will.",
  },
  3: {
    eyebrow: "Step III — Bones of Character",
    title: "Three traits that will never change.",
    sub: "Choose carefully. Your descendants will remember these long after they forget your face.",
  },
  4: {
    eyebrow: "Step IV — A Final Vow",
    title: "Two things you will not compromise.",
    sub: "When everything else is taken, this is what remains.",
  },
  5: {
    eyebrow: "Step V — Who Walks With You",
    title: "Did you come to this porch alone?",
    sub: "Some founders arrive with nothing but a name. Others bring a spouse, a family, or friends from the road.",
  },
};


export function FounderCreation() {
  const setScreen = useGame((s) => s.setScreen);
  const newGame = useGame((s) => s.newGame);

  const [step, setStep] = useState(1);
  const [gender, setGender] = useState<"m" | "f">("m");
  const [firstName, setFirstName] = useState("Eli");
  const [surname, setSurname] = useState("Hollow");
  const [ranchName, setRanchName] = useState("The Hollow Ranch");
  const [background, setBackground] = useState<Background>("rancher");
  const [traits, setTraits] = useState<Trait[]>(["Brave", "Principled", "Traditional"]);
  const [values, setValues] = useState<Value[]>(["Family", "Community"]);
  const [companions, setCompanions] = useState<CompanionsChoice>("alone");
  const [portraitId, setPortraitId] = useState<string>(defaultPortraitFor("m"));

  const firstNames = useMemo(() => (gender === "m" ? FIRST_NAMES_M : FIRST_NAMES_F), [gender]);

  function toggleTrait(t: Trait) {
    setTraits((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : prev.length < 3 ? [...prev, t] : prev,
    );
  }
  function toggleValue(v: Value) {
    setValues((prev) =>
      prev.includes(v) ? prev.filter((x) => x !== v) : prev.length < 2 ? [...prev, v] : prev,
    );
  }

  const stepValid: Record<number, boolean> = {
    1: !!firstName && !!surname && !!ranchName.trim(),
    2: !!background,
    3: traits.length === 3,
    4: values.length === 2,
    5: !!companions,
  };

  function next() {
    if (!stepValid[step]) return;
    if (step < 5) setStep(step + 1);
    else begin();
  }
  function back() {
    if (step === 1) setScreen("menu");
    else setStep(step - 1);
  }
  function begin() {
    if (!stepValid[5]) return;
    newGame(ranchName, { firstName, surname, gender, background, traits, values, companions });
  }


  const t = STEP_TITLES[step];

  return (
    <div className="grain min-h-[100dvh] flex flex-col bg-ink text-parchment overflow-hidden">
      {/* Decorative gold frame — hidden on phones */}
      <div className="pointer-events-none fixed inset-4 md:inset-8 border border-amber/15 hidden sm:block" />

      {/* Top chrome — step indicator */}
      <header className="px-4 sm:px-8 pt-4 sm:pt-6 pb-3 sm:pb-4 flex items-center justify-between gap-3 shrink-0">
        <button
          onClick={back}
          className="ranch-label text-[9px] sm:text-[10px] hover:text-amber transition shrink-0"
        >
          ← {step === 1 ? "Menu" : "Back"}
        </button>

        <div className="flex items-center gap-1.5 sm:gap-3 overflow-hidden">
          {STEPS.map((s, i) => {
            const active = s.id === step;
            const done = s.id < step;
            return (
              <div key={s.id} className="flex items-center gap-1.5 sm:gap-3">
                <button
                  onClick={() => done && setStep(s.id)}
                  disabled={!done && !active}
                  className={`flex items-center gap-1.5 sm:gap-2 ${
                    active ? "text-amber" : done ? "text-parchment-dark hover:text-amber" : "text-dust/60"
                  }`}
                >
                  <span
                    className={`w-5 h-5 sm:w-6 sm:h-6 grid place-items-center border text-[10px] sm:text-[11px] font-data ${
                      active
                        ? "border-amber bg-amber text-ink"
                        : done
                          ? "border-amber/60 text-amber"
                          : "border-dust/30"
                    }`}
                  >
                    {s.id}
                  </span>
                  <span className="ranch-label text-[8px] sm:text-[10px] hidden sm:inline">{s.label}</span>
                </button>
                {i < STEPS.length - 1 && (
                  <span className={`w-4 sm:w-8 h-px ${done ? "bg-amber/50" : "bg-dust/20"}`} />
                )}
              </div>
            );
          })}
        </div>

        <div className="ranch-label text-[9px] sm:text-[10px] text-dust-light shrink-0">
          {step}<span className="opacity-50">/5</span>
        </div>
      </header>

      {/* Scrollable body */}
      <main className="flex-1 overflow-y-auto scroll-amber px-4 sm:px-8 pb-32">
        <div className="max-w-3xl mx-auto w-full">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="pt-2 sm:pt-6"
            >
              <p
                className="ranch-label mb-3 text-[9px] sm:text-[10px]"
                style={{ letterSpacing: "0.2em" }}
              >
                {t.eyebrow}
              </p>
              <h1 className="ranch-display text-[26px] sm:text-5xl md:text-6xl leading-[1.05] mb-2 sm:mb-4">
                {t.title}
              </h1>
              <p className="ranch-display italic text-dust-light text-sm sm:text-lg max-w-2xl leading-snug">
                {t.sub}
              </p>
              <div className="divider-amber my-5 sm:my-8" />


              {step === 1 && (
                <StepIdentity
                  gender={gender}
                  setGender={setGender}
                  firstName={firstName}
                  setFirstName={setFirstName}
                  surname={surname}
                  setSurname={setSurname}
                  ranchName={ranchName}
                  setRanchName={setRanchName}
                  firstNames={firstNames}
                />
              )}
              {step === 2 && (
                <StepBackground background={background} setBackground={setBackground} />
              )}
              {step === 3 && (
                <StepTraits traits={traits} toggle={toggleTrait} />
              )}
              {step === 4 && (
                <StepValues
                  values={values}
                  toggle={toggleValue}
                  founder={{ firstName, surname, ranchName, background, traits }}
                />
              )}
              {step === 5 && (
                <StepCompanions
                  companions={companions}
                  setCompanions={setCompanions}
                  founder={{ firstName, surname }}
                />
              )}

            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Sticky footer */}
      <footer
        className="fixed bottom-0 inset-x-0 px-4 sm:px-8 pt-3 sm:pt-5 bg-coal border-t border-amber/15"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)" }}
      >
        <div className="max-w-3xl mx-auto w-full flex items-center justify-between gap-3">
          <button onClick={back} className="btn-ranch flex-1 sm:flex-none">
            {step === 1 ? "Reconsider" : "Back"}
          </button>
          <button
            onClick={next}
            disabled={!stepValid[step]}
            className="btn-ranch btn-ranch-primary flex-1 sm:flex-none"
          >
            {step < 5 ? "Continue" : "Walk onto the porch"}
          </button>
        </div>
      </footer>
    </div>
  );
}

/* ───────── Step 1 ───────── */
function StepIdentity(props: {
  gender: "m" | "f";
  setGender: (g: "m" | "f") => void;
  firstName: string;
  setFirstName: (s: string) => void;
  surname: string;
  setSurname: (s: string) => void;
  ranchName: string;
  setRanchName: (s: string) => void;
  firstNames: readonly string[];
}) {
  const { gender, setGender, firstName, setFirstName, surname, setSurname, ranchName, setRanchName, firstNames } = props;
  return (
    <section className="parchment-panel corner-brackets p-5 sm:p-7">
      <div className="grid sm:grid-cols-2 gap-4 sm:gap-5">
        <div className="sm:col-span-2 flex gap-2">
          {(["m", "f"] as const).map((g) => (
            <button
              key={g}
              onClick={() => setGender(g)}
              className={`btn-ranch flex-1 ${gender === g ? "btn-ranch-primary" : ""}`}
            >
              {g === "m" ? "He" : "She"}
            </button>
          ))}
        </div>
        <Field label="First Name">
          <select
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="ranch-input"
          >
            {firstNames.map((n) => <option key={n}>{n}</option>)}
          </select>
        </Field>
        <Field label="Surname">
          <select
            value={surname}
            onChange={(e) => setSurname(e.target.value)}
            className="ranch-input"
          >
            {SURNAMES.map((n) => <option key={n}>{n}</option>)}
          </select>
        </Field>
        <div className="sm:col-span-2">
          <Field label="Ranch Name">
            <input
              value={ranchName}
              onChange={(e) => setRanchName(e.target.value)}
              className="ranch-input"
              placeholder="The Hollow Ranch"
            />
          </Field>
        </div>
      </div>

      <p className="ranch-handwritten text-sm mt-5 text-dust-light">
        “{firstName} {surname}” will be the first name in your Chronicle.
      </p>

      <style>{`
        .ranch-input {
          width: 100%;
          background: rgba(5,4,2,0.6);
          border: 1px solid rgba(201,161,74,0.28);
          padding: 10px 12px;
          font-family: var(--font-body);
          color: var(--parchment);
          font-size: 14px;
          outline: none;
          transition: border-color 200ms;
        }
        .ranch-input:focus { border-color: var(--amber); }
      `}</style>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="ranch-label text-[9px] block mb-1.5">{label}</label>
      {children}
    </div>
  );
}

/* ───────── Step 2 ───────── */
function StepBackground({ background, setBackground }: { background: Background; setBackground: (b: Background) => void }) {
  const current = BACKGROUNDS.find((b) => b.id === background);
  return (
    <section className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
        {BACKGROUNDS.map((bg) => (
          <button
            key={bg.id}
            onClick={() => setBackground(bg.id)}
            className={`btn-ranch text-left !py-3 ${background === bg.id ? "btn-ranch-primary" : ""}`}
          >
            {bg.name}
          </button>
        ))}
      </div>
      {current && (
        <div className="parchment-panel corner-brackets p-5 sm:p-6">
          <p className="ranch-label mb-2">{current.name}</p>
          <p className="ranch-handwritten text-base text-parchment-dark leading-relaxed">{current.blurb}</p>
        </div>
      )}
    </section>
  );
}

/* ───────── Step 3 ───────── */
function StepTraits({ traits, toggle }: { traits: Trait[]; toggle: (t: Trait) => void }) {
  return (
    <section className="space-y-5">
      <div className="flex items-baseline justify-between">
        <p className="ranch-label">Selected</p>
        <span className="ranch-data">{traits.length} / 3</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
        {TRAITS.map((t) => {
          const active = traits.includes(t);
          const disabled = !active && traits.length >= 3;
          return (
            <button
              key={t}
              disabled={disabled}
              onClick={() => toggle(t)}
              className={`btn-ranch ${active ? "btn-ranch-primary" : ""}`}
            >
              {t}
            </button>
          );
        })}
      </div>
      {traits.length > 0 && (
        <div className="parchment-panel corner-brackets p-5 sm:p-6 space-y-2">
          {traits.map((t) => (
            <p key={t} className="ranch-handwritten text-sm sm:text-base">
              <span className="text-amber">{t}.</span>{" "}
              <span className="text-parchment-dark">{TRAIT_BLURBS[t]}</span>
            </p>
          ))}
        </div>
      )}
    </section>
  );
}

/* ───────── Step 4 ───────── */
function StepValues({
  values, toggle, founder,
}: {
  values: Value[];
  toggle: (v: Value) => void;
  founder: { firstName: string; surname: string; ranchName: string; background: Background; traits: Trait[] };
}) {
  const bg = BACKGROUNDS.find((b) => b.id === founder.background);
  return (
    <section className="space-y-5">
      <div className="flex items-baseline justify-between">
        <p className="ranch-label">Selected</p>
        <span className="ranch-data">{values.length} / 2</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {VALUES.map((v) => {
          const active = values.includes(v);
          const disabled = !active && values.length >= 2;
          return (
            <button
              key={v}
              disabled={disabled}
              onClick={() => toggle(v)}
              className={`btn-ranch ${active ? "btn-ranch-primary" : ""}`}
            >
              {v}
            </button>
          );
        })}
      </div>

      <div className="parchment-panel-warm corner-brackets p-5 sm:p-6 mt-4">
        <p className="ranch-label mb-3">The Founder</p>
        <p className="ranch-display text-2xl sm:text-3xl mb-1">
          {founder.firstName} {founder.surname}
        </p>
        <p className="ranch-display italic text-dust-light mb-4">of {founder.ranchName}</p>

        <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
          <div>
            <dt className="ranch-label text-[9px] mb-1">Before</dt>
            <dd className="text-parchment">{bg?.name}</dd>
          </div>
          <div>
            <dt className="ranch-label text-[9px] mb-1">Traits</dt>
            <dd className="text-parchment">{founder.traits.join(", ")}</dd>
          </div>
          <div>
            <dt className="ranch-label text-[9px] mb-1">Vows</dt>
            <dd className="text-parchment">{values.length ? values.join(", ") : "—"}</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}

/* ───────── Step 5 ───────── */
const COMPANION_OPTIONS: { id: CompanionsChoice; name: string; blurb: string; party: string }[] = [
  {
    id: "alone",
    name: "Alone",
    blurb: "Just you, a bag, and a name. The harder road, but every choice ahead is wholly yours.",
    party: "1 settler",
  },
  {
    id: "spouse",
    name: "With a Spouse",
    blurb: "You arrive with the one you swore to. Two hands at the porch instead of one.",
    party: "2 settlers — founder + spouse",
  },
  {
    id: "family",
    name: "With a Family",
    blurb: "Spouse and a child or two underfoot. More mouths to feed — and more reasons to keep going.",
    party: "3–4 settlers — founder, spouse, children",
  },
  {
    id: "friends",
    name: "With Friends",
    blurb: "Two companions from the road. Not blood, but bound by what you all left behind.",
    party: "3 settlers — founder + 2 friends",
  },
];

function StepCompanions({
  companions,
  setCompanions,
  founder,
}: {
  companions: CompanionsChoice;
  setCompanions: (c: CompanionsChoice) => void;
  founder: { firstName: string; surname: string };
}) {
  const current = COMPANION_OPTIONS.find((c) => c.id === companions);
  return (
    <section className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        {COMPANION_OPTIONS.map((c) => (
          <button
            key={c.id}
            onClick={() => setCompanions(c.id)}
            className={`btn-ranch text-left !py-3 ${companions === c.id ? "btn-ranch-primary" : ""}`}
          >
            {c.name}
          </button>
        ))}
      </div>
      {current && (
        <div className="parchment-panel corner-brackets p-5 sm:p-6 space-y-2">
          <p className="ranch-label">{current.name}</p>
          <p className="ranch-handwritten text-base text-parchment-dark leading-relaxed">
            {current.blurb}
          </p>
          <p className="ranch-data text-[11px] text-amber/80 pt-1">{current.party}</p>
          <p className="ranch-handwritten text-sm text-dust-light pt-1">
            {founder.firstName} {founder.surname}
            {current.id === "alone"
              ? " arrives at the porch with nothing but a name."
              : current.id === "spouse"
                ? " arrives at the porch, a spouse at their side."
                : current.id === "family"
                  ? " arrives at the porch with a spouse and children."
                  : " arrives at the porch with two friends from the road."}
          </p>
        </div>
      )}
    </section>
  );
}
