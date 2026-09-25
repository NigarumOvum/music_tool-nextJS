export type InstrumentFamily = "strings" | "keys" | "percussion" | "voice" | "wind" | "electronic" | "other";

export type AvailableInstrument = {
  id: string;
  label: string;
  family: InstrumentFamily;
  /** Short hint shown in pickers / tooltips */
  hint: string;
};

/**
 * Single source of truth for every instrument list in the app.
 * Reused by: scales explorer, theory-lab harmony builder, progression
 * voicing preview, tab studio, song studio partitures, production-studio
 * filters, musician helpers.
 *
 * NOTE: ids are lowercase stable keys. `partitureInstrumentLabel` and the
 * DB-backed partiture instrument ids ("guitar" | "bass" | "drums" | "keys"
 * | "vocals" | "other") are a subset of this list, so existing saved
 * partitures keep resolving.
 */
export const AVAILABLE_INSTRUMENTS: AvailableInstrument[] = [
  { id: "guitar", label: "Guitar", family: "strings", hint: "6-string fretboard shapes" },
  { id: "ukulele", label: "Ukulele", family: "strings", hint: "4-string island voicing" },
  { id: "bass", label: "Bass", family: "strings", hint: "4/5/6-string root + fifth" },
  { id: "piano", label: "Piano / Keyboard", family: "keys", hint: "Keyboard voicing" },
  { id: "keys", label: "Keys", family: "keys", hint: "Pad & synth voicing" },
  { id: "synth", label: "Synth", family: "electronic", hint: "Pad & lead voicing" },
  { id: "drums", label: "Drums", family: "percussion", hint: "Rhythmic accent pattern" },
  { id: "percussion", label: "Percussion", family: "percussion", hint: "Aux groove accents" },
  { id: "vocals", label: "Vocals", family: "voice", hint: "Singable voicing order" },
  { id: "strings", label: "Strings", family: "strings", hint: "Sustained ensemble pad" },
  { id: "brass", label: "Brass", family: "wind", hint: "Stab voicing" },
  { id: "woodwinds", label: "Woodwinds", family: "wind", hint: "Sustained airy voicing" },
  { id: "other", label: "Other", family: "other", hint: "Generic voicing" },
];

export function instrumentLabel(id: string): string {
  const found = AVAILABLE_INSTRUMENTS.find(
    (item) => item.id.toLowerCase() === id.toLowerCase(),
  );
  return found?.label ?? id;
}

/** Instruments that make sense for "how to play this chord" diagrams. */
export const CHORD_PLAYABLE_INSTRUMENTS = [
  "piano",
  "guitar",
  "bass",
  "ukulele",
  "drums",
  "vocals",
] as const;

export type ChordPlayableInstrumentId = (typeof CHORD_PLAYABLE_INSTRUMENTS)[number];

/** Flat label list for filter dropdowns (e.g. production-studio). */
export const INSTRUMENT_FILTER_PRESETS: string[] = [
  "Guitar",
  "Bass",
  "Drums",
  "Piano",
  "Vocals",
  "Synth",
  "Strings",
  "Brass",
  "Woodwinds",
  "Percussion",
];
