import type { Accent } from "./api";

export const ACCENTS: Record<Accent, { bar: string; chip: string; name: string }> = {
  forest: { bar: "bg-forest", chip: "bg-forest/10 text-forest", name: "Indigo" },
  gold: { bar: "bg-gold", chip: "bg-gold/10 text-slate", name: "Sky" },
  clay: { bar: "bg-clay", chip: "bg-clay/10 text-clay", name: "Orange" },
  slate: { bar: "bg-slate", chip: "bg-slate/10 text-slate", name: "Slate" },
};

export function accentOf(value: string | undefined): Accent {
  return value && value in ACCENTS ? (value as Accent) : "forest";
}
