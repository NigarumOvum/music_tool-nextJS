import type { MusicPartitureRecord } from "@/lib/music/types";

export const PARTITURE_INSTRUMENTS = [
  { id: "guitar", label: "Guitar" },
  { id: "bass", label: "Bass" },
  { id: "drums", label: "Drums" },
  { id: "keys", label: "Keys" },
  { id: "vocals", label: "Vocals" },
  { id: "other", label: "Other" },
] as const;

export type PartitureInstrumentId = (typeof PARTITURE_INSTRUMENTS)[number]["id"];

export function partitureInstrumentLabel(instrument: string) {
  return PARTITURE_INSTRUMENTS.find((item) => item.id === instrument)?.label ?? instrument;
}

export function nextPartitureSlot(
  existing: Pick<MusicPartitureRecord, "instrument" | "slot">[],
  instrument: string,
) {
  const slots = existing
    .filter((item) => item.instrument === instrument)
    .map((item) => item.slot);
  if (slots.length === 0) return 1;
  return Math.max(...slots) + 1;
}

export function defaultPartitureTitle(instrument: string, slot: number) {
  const label = partitureInstrumentLabel(instrument);
  return slot > 1 ? `${label} ${slot}` : label;
}

export function partitureKey(instrument: string, slot: number) {
  return `${instrument}:${slot}`;
}
