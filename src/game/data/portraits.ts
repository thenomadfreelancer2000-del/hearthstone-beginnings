import m1 from "@/assets/portraits/m1.webp";
import m2 from "@/assets/portraits/m2.webp";
import m3 from "@/assets/portraits/m3.webp";
import m4 from "@/assets/portraits/m4.webp";
import m5 from "@/assets/portraits/m5.webp";
import m6 from "@/assets/portraits/m6.webp";
import m7 from "@/assets/portraits/m7.webp";
import m8 from "@/assets/portraits/m8.webp";
import f1 from "@/assets/portraits/f1.webp";
import f2 from "@/assets/portraits/f2.webp";
import f3 from "@/assets/portraits/f3.webp";
import f4 from "@/assets/portraits/f4.webp";
import f5 from "@/assets/portraits/f5.webp";
import f6 from "@/assets/portraits/f6.webp";
import f7 from "@/assets/portraits/f7.webp";
import f8 from "@/assets/portraits/f8.webp";

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
  // Men — 2 of each ethnicity
  { id: "m1", gender: "m", ethnicity: "white",   url: m1, age: 28 },
  { id: "m2", gender: "m", ethnicity: "white",   url: m2, age: 35 },
  { id: "m3", gender: "m", ethnicity: "arab",    url: m3, age: 30 },
  { id: "m4", gender: "m", ethnicity: "arab",    url: m4, age: 38 },
  { id: "m5", gender: "m", ethnicity: "black",   url: m5, age: 29 },
  { id: "m6", gender: "m", ethnicity: "black",   url: m6, age: 36 },
  { id: "m7", gender: "m", ethnicity: "chinese", url: m7, age: 27 },
  { id: "m8", gender: "m", ethnicity: "chinese", url: m8, age: 34 },
  // Women — 2 of each ethnicity
  { id: "f1", gender: "f", ethnicity: "white",   url: f1, age: 26 },
  { id: "f2", gender: "f", ethnicity: "white",   url: f2, age: 32 },
  { id: "f3", gender: "f", ethnicity: "arab",    url: f3, age: 27 },
  { id: "f4", gender: "f", ethnicity: "arab",    url: f4, age: 33 },
  { id: "f5", gender: "f", ethnicity: "black",   url: f5, age: 28 },
  { id: "f6", gender: "f", ethnicity: "black",   url: f6, age: 34 },
  { id: "f7", gender: "f", ethnicity: "chinese", url: f7, age: 25 },
  { id: "f8", gender: "f", ethnicity: "chinese", url: f8, age: 30 },
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
