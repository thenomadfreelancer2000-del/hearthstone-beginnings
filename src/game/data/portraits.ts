import m1 from "@/assets/portraits/m1.jpg";
import m2 from "@/assets/portraits/m2.jpg";
import m3 from "@/assets/portraits/m3.jpg";
import m4 from "@/assets/portraits/m4.jpg";
import f1 from "@/assets/portraits/f1.jpg";
import f2 from "@/assets/portraits/f2.jpg";
import f3 from "@/assets/portraits/f3.jpg";
import f4 from "@/assets/portraits/f4.jpg";

export type Ethnicity = "white" | "arab" | "black" | "chinese";

export interface PortraitDef {
  id: string;
  gender: "m" | "f";
  ethnicity: Ethnicity;
  url: string;
  /** Approximate age of the depicted face (used to set founder age in-game). */
  age: number;
}

export const PORTRAITS: PortraitDef[] = [
  { id: "m1", gender: "m", ethnicity: "white",   url: m1, age: 28 },
  { id: "f1", gender: "f", ethnicity: "white",   url: f1, age: 28 },
  { id: "m2", gender: "m", ethnicity: "arab",    url: m2, age: 32 },
  { id: "f2", gender: "f", ethnicity: "arab",    url: f2, age: 26 },
  { id: "m3", gender: "m", ethnicity: "black",   url: m3, age: 34 },
  { id: "f3", gender: "f", ethnicity: "black",   url: f3, age: 29 },
  { id: "m4", gender: "m", ethnicity: "chinese", url: m4, age: 28 },
  { id: "f4", gender: "f", ethnicity: "chinese", url: f4, age: 25 },
];

export function getPortrait(id: string | null | undefined): PortraitDef | null {
  if (!id) return null;
  return PORTRAITS.find((p) => p.id === id) ?? null;
}

export function getPortraitUrl(id: string | null | undefined): string | null {
  return getPortrait(id)?.url ?? null;
}

export function defaultPortraitFor(gender: "m" | "f"): string {
  return gender === "m" ? "m1" : "f1";
}
