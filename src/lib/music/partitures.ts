import type { MusicPartitureRecord } from "@/lib/music/types";
import { AVAILABLE_INSTRUMENTS } from "@/lib/music/instruments";

// DB-backed subset — ids must stay stable for saved partitures.
const PARTITURE_INSTRUMENT_IDS = ["guitar", "bass", "drums", "keys", "vocals", "other"] as const;

export const PARTITURE_INSTRUMENTS = PARTITURE_INSTRUMENT_IDS.map((id) => ({
  id,
  label: AVAILABLE_INSTRUMENTS.find((item) => item.id === id)?.label ?? id,
})) as readonly { id: (typeof PARTITURE_INSTRUMENT_IDS)[number]; label: string }[];

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
