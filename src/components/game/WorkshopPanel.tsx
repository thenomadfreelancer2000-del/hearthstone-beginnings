import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useWorkshop, SHARE_PREFIX } from "@/game/workshop/store";
import {
  PROCEDURAL_STYLES,
  WORKSHOP_CATEGORIES,
  type ProceduralStyle,
  type WorkshopBuilding,
  type WorkshopCategory,
  type WorkshopPack,
} from "@/game/workshop/types";
import type { ResourceKind } from "@/game/types";

const RESOURCES: ResourceKind[] = ["wood", "stone", "fiber", "tools", "food", "water"];

function newId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

function blankPack(): WorkshopPack {
  return {
    id: newId("pack"),
    name: "My First Pack",
    author: "",
    version: "1.0",
    description: "",
    buildings: [],
  };
}

function blankBuilding(): WorkshopBuilding {
  return {
    id: newId("b"),
    name: "New Building",
    description: "",
    category: "housing",
    size: { w: 2, h: 2 },
    cost: { wood: 20 },
    buildEffort: 80,
    capacity: 4,
    prestige: 0,
    visual: { type: "procedural", style: "wood-cabin" },
  };
}

export function WorkshopPanel({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const packs = useWorkshop((s) => s.packs);
  const enabled = useWorkshop((s) => s.enabled);
  const togglePack = useWorkshop((s) => s.togglePack);
  const deletePack = useWorkshop((s) => s.deletePack);
  const exportPackJson = useWorkshop((s) => s.exportPackJson);
  const exportShareCode = useWorkshop((s) => s.exportShareCode);
  const importFromJson = useWorkshop((s) => s.importFromJson);
  const importFromShareCode = useWorkshop((s) => s.importFromShareCode);
  const upsertPack = useWorkshop((s) => s.upsertPack);

  const [tab, setTab] = useState<"library" | "import" | "create">("library");
  const [editing, setEditing] = useState<WorkshopPack | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [shareCode, setShareCode] = useState("");

  function handleFileImport(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const r = importFromJson(String(reader.result ?? ""));
      if (r.ok) toast.success(`Imported "${r.pack.name}".`);
      else toast.error(r.error);
    };
    reader.readAsText(file);
  }

  function handleCodeImport() {
    if (!shareCode.trim()) return;
    const r = importFromShareCode(shareCode);
    if (r.ok) {
      toast.success(`Imported "${r.pack.name}".`);
      setShareCode("");
    } else toast.error(r.error);
  }

  function exportFile(pack: WorkshopPack) {
    const json = exportPackJson(pack.id);
    if (!json) return;
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${pack.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.ranchpack.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function copyShare(pack: WorkshopPack) {
    const code = exportShareCode(pack.id);
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      toast.success("Share code copied to clipboard");
    } catch {
      toast.error("Could not copy — share code is shown in the toast below");
      toast(code);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="parchment-panel max-w-3xl border border-amber/30 text-parchment">
        <DialogHeader>
          <DialogTitle className="ranch-display text-xl text-amber">Community Workshop</DialogTitle>
          <p className="ranch-handwritten text-sm text-dust-light">
            Import, share, and create custom building packs for The Ranch.
          </p>
        </DialogHeader>

        <div className="flex border-b border-amber/20 mb-3">
          {(["library", "import", "create"] as const).map((t) => (
            <button
              key={t}
              onClick={() => {
                setTab(t);
                if (t === "create" && !editing) setEditing(blankPack());
              }}
              className={`px-3 py-2 ranch-label text-[11px] ${
                tab === t ? "text-amber border-b-2 border-amber" : "text-dust hover:text-parchment"
              }`}
            >
              {t === "library" ? `Library (${packs.length})` : t}
            </button>
          ))}
        </div>

        <div className="max-h-[55vh] overflow-auto scroll-amber pr-1">
          {tab === "library" && (
            <div className="space-y-2">
              {packs.length === 0 && (
                <div className="ranch-handwritten text-sm text-dust-light p-4 text-center">
                  No packs installed yet. Import one in the next tab or create your own.
                </div>
              )}
              {packs.map((p) => (
                <div key={p.id} className="border border-amber/20 p-3 bg-black/20">
                  <div className="flex items-start gap-2">
                    <label className="flex items-center gap-2 ranch-label text-[11px] text-parchment">
                      <input
                        type="checkbox"
                        checked={!!enabled[p.id]}
                        onChange={() => togglePack(p.id)}
                      />
                      <span className="text-amber">{p.name}</span>
                    </label>
                    <span className="ranch-data text-[10px] text-dust ml-1">
                      v{p.version} · {p.buildings.length} building{p.buildings.length === 1 ? "" : "s"}
                      {p.author ? ` · by ${p.author}` : ""}
                    </span>
                    <div className="ml-auto flex gap-1">
                      <button className="btn-ranch btn-ranch-ghost text-[10px]" onClick={() => copyShare(p)}>
                        Copy share code
                      </button>
                      <button className="btn-ranch btn-ranch-ghost text-[10px]" onClick={() => exportFile(p)}>
                        Export .json
                      </button>
                      <button
                        className="btn-ranch btn-ranch-ghost text-[10px]"
                        onClick={() => {
                          setEditing(structuredClone(p));
                          setTab("create");
                        }}
                      >
                        Edit
                      </button>
                      <button
                        className="btn-ranch btn-ranch-ghost text-[10px] text-danger"
                        onClick={() => {
                          if (window.confirm(`Delete "${p.name}"? Buildings already placed on the map will stay but show as stubs.`)) {
                            deletePack(p.id);
                          }
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  {p.description && (
                    <div className="ranch-handwritten text-xs text-dust-light mt-1">{p.description}</div>
                  )}
                  <ul className="grid grid-cols-2 md:grid-cols-3 gap-1 mt-2">
                    {p.buildings.map((b) => (
                      <li key={b.id} className="ranch-data text-[10px] text-dust normal-case tracking-normal">
                        · <span className="text-parchment">{b.name}</span>{" "}
                        <span className="text-dust-light">({b.category}, {b.size.w}×{b.size.h})</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}

          {tab === "import" && (
            <div className="space-y-4">
              <div>
                <div className="ranch-label text-[11px] text-amber mb-1">From file (.json)</div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="application/json,.json"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFileImport(f);
                    if (fileRef.current) fileRef.current.value = "";
                  }}
                  className="text-xs text-dust-light"
                />
              </div>
              <div>
                <div className="ranch-label text-[11px] text-amber mb-1">From share code</div>
                <textarea
                  value={shareCode}
                  onChange={(e) => setShareCode(e.target.value)}
                  placeholder={`${SHARE_PREFIX}...`}
                  rows={4}
                  className="w-full bg-black/30 border border-amber/30 p-2 text-[11px] ranch-data normal-case tracking-normal text-parchment"
                />
                <button className="btn-ranch btn-ranch-primary mt-2" onClick={handleCodeImport}>
                  Import share code
                </button>
              </div>
            </div>
          )}

          {tab === "create" && editing && (
            <PackEditor
              pack={editing}
              onChange={setEditing}
              onSave={() => {
                try {
                  upsertPack(editing);
                  toast.success(`Saved "${editing.name}"`);
                  setTab("library");
                } catch (e) {
                  toast.error((e as Error).message);
                }
              }}
              onReset={() => setEditing(blankPack())}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PackEditor({
  pack,
  onChange,
  onSave,
  onReset,
}: {
  pack: WorkshopPack;
  onChange: (p: WorkshopPack) => void;
  onSave: () => void;
  onReset: () => void;
}) {
  const update = (patch: Partial<WorkshopPack>) => onChange({ ...pack, ...patch });
  const updateBuilding = (id: string, patch: Partial<WorkshopBuilding>) =>
    onChange({ ...pack, buildings: pack.buildings.map((b) => (b.id === id ? { ...b, ...patch } : b)) });

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <LabeledInput label="Pack name" value={pack.name} onChange={(v) => update({ name: v })} />
        <LabeledInput label="Author" value={pack.author ?? ""} onChange={(v) => update({ author: v })} />
        <LabeledInput label="Version" value={pack.version} onChange={(v) => update({ version: v })} />
        <LabeledInput label="Pack id" value={pack.id} onChange={(v) => update({ id: v.replace(/[^a-z0-9-_]/gi, "-") })} />
      </div>
      <LabeledInput
        label="Description"
        value={pack.description ?? ""}
        onChange={(v) => update({ description: v })}
      />

      <div className="flex items-center gap-2 border-t border-amber/20 pt-2">
        <div className="ranch-label text-[11px] text-amber">Buildings</div>
        <button
          className="btn-ranch btn-ranch-ghost text-[10px] ml-auto"
          onClick={() => onChange({ ...pack, buildings: [...pack.buildings, blankBuilding()] })}
        >
          + Add building
        </button>
      </div>

      <div className="space-y-2">
        {pack.buildings.length === 0 && (
          <div className="ranch-handwritten text-sm text-dust-light p-2">
            No buildings yet — add one above.
          </div>
        )}
        {pack.buildings.map((b) => (
          <BuildingEditor
            key={b.id}
            building={b}
            onChange={(patch) => updateBuilding(b.id, patch)}
            onDelete={() => onChange({ ...pack, buildings: pack.buildings.filter((x) => x.id !== b.id) })}
          />
        ))}
      </div>

      <div className="flex gap-2 border-t border-amber/20 pt-2">
        <button className="btn-ranch btn-ranch-primary" onClick={onSave}>Save pack</button>
        <button className="btn-ranch btn-ranch-ghost ml-auto" onClick={onReset}>Start over</button>
      </div>
    </div>
  );
}

function BuildingEditor({
  building,
  onChange,
  onDelete,
}: {
  building: WorkshopBuilding;
  onChange: (patch: Partial<WorkshopBuilding>) => void;
  onDelete: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  function handleSprite(file: File) {
    if (file.size > 250_000) {
      toast.error("Sprite must be under 250 KB. Try resizing or compressing the PNG.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      onChange({ visual: { type: "sprite", dataUrl: String(reader.result ?? "") } });
    };
    reader.readAsDataURL(file);
  }

  const costEntries = useMemo(
    () => RESOURCES.map((r) => [r, building.cost[r] ?? 0] as const),
    [building.cost],
  );

  return (
    <div className="border border-amber/15 p-2 bg-black/20">
      <div className="flex items-center gap-2 mb-2">
        <input
          className="bg-black/30 border border-amber/30 px-2 py-1 text-sm text-parchment flex-1"
          value={building.name}
          onChange={(e) => onChange({ name: e.target.value })}
        />
        <button className="btn-ranch btn-ranch-ghost text-[10px] text-danger" onClick={onDelete}>Remove</button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <LabeledSelect<WorkshopCategory>
          label="Category"
          value={building.category}
          options={WORKSHOP_CATEGORIES.map((c) => ({ value: c.id, label: c.label }))}
          onChange={(v) => onChange({ category: v })}
        />
        <LabeledNumber label="Width" min={1} max={8} value={building.size.w}
          onChange={(v) => onChange({ size: { ...building.size, w: v } })} />
        <LabeledNumber label="Height" min={1} max={8} value={building.size.h}
          onChange={(v) => onChange({ size: { ...building.size, h: v } })} />
        <LabeledNumber label="Effort" min={0} value={building.buildEffort}
          onChange={(v) => onChange({ buildEffort: v })} />
        <LabeledNumber label="Capacity" min={0} value={building.capacity}
          onChange={(v) => onChange({ capacity: v })} />
        <LabeledNumber label="Prestige" min={0} value={building.prestige}
          onChange={(v) => onChange({ prestige: v })} />
      </div>

      <LabeledInput
        label="Description"
        value={building.description}
        onChange={(v) => onChange({ description: v })}
      />

      <div className="mt-2">
        <div className="ranch-label text-[10px] text-amber mb-1">Construction cost</div>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-1">
          {costEntries.map(([r, n]) => (
            <label key={r} className="flex items-center gap-1 text-[10px] text-dust-light">
              <span className="w-10 uppercase">{r}</span>
              <input
                type="number"
                min={0}
                value={n}
                onChange={(e) => {
                  const v = Math.max(0, Number(e.target.value) || 0);
                  const cost = { ...building.cost, [r]: v };
                  if (v === 0) delete cost[r];
                  onChange({ cost });
                }}
                className="w-full bg-black/30 border border-amber/20 px-1 py-0.5 text-parchment"
              />
            </label>
          ))}
        </div>
      </div>

      <div className="mt-2 border-t border-amber/10 pt-2">
        <div className="ranch-label text-[10px] text-amber mb-1">Appearance</div>
        <div className="flex gap-3 flex-wrap items-start">
          <label className="flex items-center gap-1 text-[11px] text-parchment">
            <input
              type="radio"
              checked={building.visual.type === "procedural"}
              onChange={() =>
                onChange({
                  visual: { type: "procedural", style: PROCEDURAL_STYLES[0].id },
                })
              }
            />
            Procedural style
          </label>
          <label className="flex items-center gap-1 text-[11px] text-parchment">
            <input
              type="radio"
              checked={building.visual.type === "sprite"}
              onChange={() => fileRef.current?.click()}
            />
            Custom sprite (PNG)
          </label>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleSprite(f);
              if (fileRef.current) fileRef.current.value = "";
            }}
          />
        </div>

        {building.visual.type === "procedural" && (
          <select
            className="mt-2 bg-black/30 border border-amber/30 px-2 py-1 text-[11px] text-parchment"
            value={building.visual.style}
            onChange={(e) =>
              onChange({ visual: { type: "procedural", style: e.target.value as ProceduralStyle } })
            }
          >
            {PROCEDURAL_STYLES.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        )}

        {building.visual.type === "sprite" && (
          <div className="mt-2 flex items-center gap-2">
            <img
              src={building.visual.dataUrl}
              alt={building.name}
              className="w-16 h-16 object-contain border border-amber/30 bg-black/30"
            />
            <button className="btn-ranch btn-ranch-ghost text-[10px]" onClick={() => fileRef.current?.click()}>
              Replace
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function LabeledInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="ranch-label text-[10px] text-amber block mb-0.5">{label}</span>
      <input
        className="w-full bg-black/30 border border-amber/30 px-2 py-1 text-sm text-parchment"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function LabeledNumber({
  label, value, onChange, min, max,
}: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  return (
    <label className="block">
      <span className="ranch-label text-[10px] text-amber block mb-0.5">{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="w-full bg-black/30 border border-amber/30 px-2 py-1 text-sm text-parchment"
      />
    </label>
  );
}

function LabeledSelect<T extends string>({
  label, value, options, onChange,
}: { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <label className="block">
      <span className="ranch-label text-[10px] text-amber block mb-0.5">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="w-full bg-black/30 border border-amber/30 px-2 py-1 text-sm text-parchment"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}
