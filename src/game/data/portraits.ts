import m1 from "@/assets/portraits/m1.jpg";
import m2 from "@/assets/portraits/m2.jpg";
import m3 from "@/assets/portraits/m3.jpg";
import m4 from "@/assets/portraits/m4.jpg";
import f1 from "@/assets/portraits/f1.jpg";
import f2 from "@/assets/portraits/f2.jpg";
import f3 from "@/assets/portraits/f3.jpg";
import f4 from "@/assets/portraits/f4.jpg";

export interface PortraitDef {
  id: string;
  gender: "m" | "f";
  url: string;
}

export const PORTRAITS: PortraitDef[] = [
  { id: "m1", gender: "m", url: m1 },
  { id: "m2", gender: "m", url: m2 },
  { id: "m3", gender: "m", url: m3 },
  { id: "m4", gender: "m", url: m4 },
  { id: "f1", gender: "f", url: f1 },
  { id: "f2", gender: "f", url: f2 },
  { id: "f3", gender: "f", url: f3 },
  { id: "f4", gender: "f", url: f4 },
];

export function getPortraitUrl(id: string | null | undefined): string | null {
  if (!id) return null;
  return PORTRAITS.find((p) => p.id === id)?.url ?? null;
}

export function defaultPortraitFor(gender: "m" | "f"): string {
  return gender === "m" ? "m1" : "f1";
}
