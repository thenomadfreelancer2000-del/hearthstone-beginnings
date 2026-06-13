import { useState } from "react";
import { useGame } from "@/game/store";
import { CROPS, expectedYield, type CropId, skillTierLabel } from "@/game/data/crops";
import { BUILDINGS } from "@/game/data/content";

export function FarmSetupModal() {
  const buildingId = useGame((s) => s.pendingFarmSetup);
  const buildings = useGame((s) => s.buildings);
  const survivors = useGame((s) => s.survivors);
  const unlockedCrops = useGame((s) => s.unlockedCrops);
  const configureFarm = useGame((s) => s.configureFarm);
  const close = useGame((s) => s.closeFarmSetup);

  const [cropId, setCropId] = useState<CropId>("corn");
  const [farmerId, setFarmerId] = useState<string | null>(null);

  if (!buildingId) return null;
  const b = buildings.find(x => x.id === buildingId);
  if (!b) return null;
  const def = BUILDINGS[b.kind];

  const eligible = survivors
    .filter(s => s.health > 0 && (s.stage === "adult" || s.stage === "youth" || s.stage === "elder" || s.isFounder))
    .sort((a, c) => (c.skills.farm ?? 1) - (a.skills.farm ?? 1));

  const crop = CROPS[cropId];
  const skill = farmerId
    ? Math.round(survivors.find(s => s.id === farmerId)?.skills.farm ?? 1)
    : Math.round(eligible[0]?.skills.farm ?? 1);
  const yieldEst = expectedYield(crop, skill);

  function confirm() {
    configureFarm(buildingId!, cropId, farmerId);
  }
  function autoAssign() {
    const pick = eligible[0]?.id ?? null;
    configureFarm(buildingId!, cropId, pick);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="parchment-panel corner-brackets max-w-md w-full p-5 max-h-[90vh] overflow-auto scroll-amber">
        <p className="ranch-label text-amber text-[10px]">Plan The Farm</p>
        <h2 className="ranch-display text-2xl mt-1">{def.name}</h2>
        <p className="ranch-handwritten text-sm text-dust-light mt-1">
          Choose a crop and a farmer. The plot will be tilled, planted, tended, and harvested in turn.
        </p>

        <div className="divider-amber my-3" />

        <p className="ranch-label text-[10px] text-amber mb-2">Crop</p>
        <div className="grid grid-cols-1 gap-1.5 mb-4">
          {unlockedCrops.map((id) => {
            const c = CROPS[id as CropId];
            if (!c) return null;
            const selected = cropId === id;
            return (
              <button
                key={id}
                onClick={() => setCropId(id as CropId)}
                className={`text-left px-2 py-1.5 border ${selected ? "border-amber bg-amber/15" : "border-amber/20 hover:bg-amber/5"}`}
              >
                <div className="flex justify-between items-baseline">
                  <span className="ranch-body text-parchment text-sm">{c.name}</span>
                  <span className="ranch-data text-[10px] text-dust">
                    {c.growthDays}d · {c.baseYield} food
                  </span>
                </div>
                <div className="ranch-handwritten text-[11px] text-dust-light">{c.blurb}</div>
              </button>
            );
          })}
        </div>

        <p className="ranch-label text-[10px] text-amber mb-2">Farmer</p>
        <div className="space-y-1 mb-3 max-h-40 overflow-auto scroll-amber pr-1">
          <button
            onClick={() => setFarmerId(null)}
            className={`w-full text-left px-2 py-1 border ${farmerId === null ? "border-amber bg-amber/15" : "border-amber/20 hover:bg-amber/5"}`}
          >
            <span className="ranch-body text-sm text-parchment">Anyone with idle hands</span>
          </button>
          {eligible.map((s) => {
            const sk = Math.round(s.skills.farm ?? 1);
            const selected = farmerId === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setFarmerId(s.id)}
                className={`w-full flex justify-between items-center px-2 py-1 border ${selected ? "border-amber bg-amber/15" : "border-amber/20 hover:bg-amber/5"}`}
              >
                <span className="ranch-body text-parchment text-sm">
                  {s.isFounder && "★ "}{s.name} {s.surname}
                </span>
                <span className="ranch-data text-[10px] text-dust">
                  Farm <span className="text-amber">{sk}</span> · {skillTierLabel(sk)}
                </span>
              </button>
            );
          })}
        </div>

        <div className="parchment-panel-warm p-2 mb-3">
          <div className="ranch-label text-[10px] text-amber mb-1">Expected harvest</div>
          <div className="ranch-data text-xs text-parchment">
            ~{yieldEst} food · in roughly {Math.ceil(crop.growthDays / (0.5 + (skill / 30) * 0.8))} days
          </div>
        </div>

        <div className="flex gap-2">
          <button onClick={autoAssign} className="btn-ranch btn-ranch-primary flex-1">
            Auto-assign & plant
          </button>
          <button onClick={confirm} className="btn-ranch flex-1">
            Confirm
          </button>
        </div>
        <button onClick={close} className="btn-ranch btn-ranch-ghost w-full mt-2 text-[10px]">
          Skip for now
        </button>
      </div>
    </div>
  );
}
