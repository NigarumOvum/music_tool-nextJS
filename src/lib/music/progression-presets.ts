export type ProgressionChord = { root: string; quality: string };

export type ProgressionPreset = {
  id: string;
  name: string;
  category: string;
  description: string;
  /** Chords expressed in C (or relative) — transposed on load */
  baseKey: string;
  chords: ProgressionChord[];
};

export const PROGRESSION_CATEGORIES = [
  "Pop & Rock",
  "Jazz & Blues",
  "Latin & Folk",
  "Cinematic & Classical",
  "Modern & Alternative",
] as const;

export const PROGRESSION_PRESETS: ProgressionPreset[] = [
  {
    id: "axis",
    name: "Axis of Awesome",
    category: "Pop & Rock",
    description: "I–V–vi–IV — the pop progression",
    baseKey: "C",
    chords: [
      { root: "C", quality: "Maj" },
      { root: "G", quality: "Maj" },
      { root: "A", quality: "min" },
      { root: "F", quality: "Maj" },
    ],
  },
  {
    id: "vi-iv-i-v",
    name: "Sensitive progression",
    category: "Pop & Rock",
    description: "vi–IV–I–V emotional pop loop",
    baseKey: "C",
    chords: [
      { root: "A", quality: "min" },
      { root: "F", quality: "Maj" },
      { root: "C", quality: "Maj" },
      { root: "G", quality: "Maj" },
    ],
  },
  {
    id: "i-iv-v",
    name: "Three-chord rock",
    category: "Pop & Rock",
    description: "Classic I–IV–V",
    baseKey: "C",
    chords: [
      { root: "C", quality: "Maj" },
      { root: "F", quality: "Maj" },
      { root: "G", quality: "Maj" },
    ],
  },
  {
    id: "i-iv-vi-v",
    name: "Pop ballad",
    category: "Pop & Rock",
    description: "I–IV–vi–V",
    baseKey: "C",
    chords: [
      { root: "C", quality: "Maj" },
      { root: "F", quality: "Maj" },
      { root: "A", quality: "min" },
      { root: "G", quality: "Maj" },
    ],
  },
  {
    id: "doo-wop",
    name: "Doo-wop",
    category: "Pop & Rock",
    description: "I–vi–IV–V golden era",
    baseKey: "C",
    chords: [
      { root: "C", quality: "Maj" },
      { root: "A", quality: "min" },
      { root: "F", quality: "Maj" },
      { root: "G", quality: "Maj" },
    ],
  },
  {
    id: "50s",
    name: "50s progression",
    category: "Pop & Rock",
    description: "I–vi–ii–V",
    baseKey: "C",
    chords: [
      { root: "C", quality: "Maj" },
      { root: "A", quality: "min" },
      { root: "D", quality: "min" },
      { root: "G", quality: "Maj" },
    ],
  },
  {
    id: "canon",
    name: "Canon loop",
    category: "Pop & Rock",
    description: "Pachelbel-style I–V–vi–iii–IV",
    baseKey: "C",
    chords: [
      { root: "C", quality: "Maj" },
      { root: "G", quality: "Maj" },
      { root: "A", quality: "min" },
      { root: "E", quality: "min" },
      { root: "F", quality: "Maj" },
    ],
  },
  {
    id: "royals",
    name: "Andalusian cadence",
    category: "Pop & Rock",
    description: "i–VII–VI–V (Am–G–F–E in A minor)",
    baseKey: "A",
    chords: [
      { root: "A", quality: "min" },
      { root: "G", quality: "Maj" },
      { root: "F", quality: "Maj" },
      { root: "E", quality: "Maj" },
    ],
  },
  {
    id: "metal",
    name: "Natural minor loop",
    category: "Modern & Alternative",
    description: "i–VI–III–VII",
    baseKey: "A",
    chords: [
      { root: "A", quality: "min" },
      { root: "F", quality: "Maj" },
      { root: "C", quality: "Maj" },
      { root: "G", quality: "Maj" },
    ],
  },
  {
    id: "ii-v-i",
    name: "ii–V–I",
    category: "Jazz & Blues",
    description: "Core jazz cadence",
    baseKey: "C",
    chords: [
      { root: "D", quality: "min7" },
      { root: "G", quality: "7" },
      { root: "C", quality: "maj7" },
    ],
  },
  {
    id: "ii-v-i-vi",
    name: "Turnaround",
    category: "Jazz & Blues",
    description: "ii–V–I–vi extended cadence",
    baseKey: "C",
    chords: [
      { root: "D", quality: "min7" },
      { root: "G", quality: "7" },
      { root: "C", quality: "maj7" },
      { root: "A", quality: "min7" },
    ],
  },
  {
    id: "blues-quick",
    name: "Quick change blues",
    category: "Jazz & Blues",
    description: "I7–IV7–I7–V7",
    baseKey: "C",
    chords: [
      { root: "C", quality: "7" },
      { root: "F", quality: "7" },
      { root: "C", quality: "7" },
      { root: "G", quality: "7" },
    ],
  },
  {
    id: "blues-12",
    name: "12-bar blues",
    category: "Jazz & Blues",
    description: "Full 12-bar in dominant 7ths",
    baseKey: "C",
    chords: [
      { root: "C", quality: "7" },
      { root: "C", quality: "7" },
      { root: "C", quality: "7" },
      { root: "C", quality: "7" },
      { root: "F", quality: "7" },
      { root: "F", quality: "7" },
      { root: "C", quality: "7" },
      { root: "C", quality: "7" },
      { root: "G", quality: "7" },
      { root: "F", quality: "7" },
      { root: "C", quality: "7" },
      { root: "G", quality: "7" },
    ],
  },
  {
    id: "rhythm-changes",
    name: "Rhythm changes A",
    category: "Jazz & Blues",
    description: "I–vi–ii–V jazz standard frame",
    baseKey: "C",
    chords: [
      { root: "C", quality: "maj7" },
      { root: "A", quality: "min7" },
      { root: "D", quality: "min7" },
      { root: "G", quality: "7" },
    ],
  },
  {
    id: "autumn-leaves",
    name: "Autumn leaves",
    category: "Jazz & Blues",
    description: "ii–V–I–VI–ii–V–i minor",
    baseKey: "A",
    chords: [
      { root: "B", quality: "min7" },
      { root: "E", quality: "7" },
      { root: "A", quality: "min7" },
      { root: "F#", quality: "min7" },
      { root: "B", quality: "min7" },
      { root: "E", quality: "7" },
      { root: "A", quality: "min" },
    ],
  },
  {
    id: "bossa",
    name: "Bossa nova",
    category: "Latin & Folk",
    description: "I–maj7–ii–V Brazilian feel",
    baseKey: "C",
    chords: [
      { root: "C", quality: "maj7" },
      { root: "C", quality: "maj7" },
      { root: "D", quality: "min7" },
      { root: "G", quality: "7" },
    ],
  },
  {
    id: "montuno",
    name: "Montuno loop",
    category: "Latin & Folk",
    description: "Am–G–F–E latin minor",
    baseKey: "A",
    chords: [
      { root: "A", quality: "min" },
      { root: "G", quality: "Maj" },
      { root: "F", quality: "Maj" },
      { root: "E", quality: "Maj" },
    ],
  },
  {
    id: "cumbia",
    name: "Cumbia major",
    category: "Latin & Folk",
    description: "I–IV–V–IV dance loop",
    baseKey: "C",
    chords: [
      { root: "C", quality: "Maj" },
      { root: "F", quality: "Maj" },
      { root: "G", quality: "Maj" },
      { root: "F", quality: "Maj" },
    ],
  },
  {
    id: "flamenco",
    name: "Flamenco cadence",
    category: "Latin & Folk",
    description: "i–VII–VI–V",
    baseKey: "A",
    chords: [
      { root: "A", quality: "min" },
      { root: "G", quality: "Maj" },
      { root: "F", quality: "Maj" },
      { root: "E", quality: "7" },
    ],
  },
  {
    id: "la-folia",
    name: "La Folia",
    category: "Cinematic & Classical",
    description: "i–V–i–VII–III–VII–i–V",
    baseKey: "A",
    chords: [
      { root: "A", quality: "min" },
      { root: "E", quality: "Maj" },
      { root: "A", quality: "min" },
      { root: "G", quality: "Maj" },
      { root: "C", quality: "Maj" },
      { root: "G", quality: "Maj" },
      { root: "A", quality: "min" },
      { root: "E", quality: "Maj" },
    ],
  },
  {
    id: "pirates",
    name: "Epic minor",
    category: "Cinematic & Classical",
    description: "i–V–VI–III cinematic",
    baseKey: "A",
    chords: [
      { root: "A", quality: "min" },
      { root: "E", quality: "Maj" },
      { root: "F", quality: "Maj" },
      { root: "C", quality: "Maj" },
    ],
  },
  {
    id: "neapolitan",
    name: "Neapolitan turn",
    category: "Cinematic & Classical",
    description: "I–bII–V–I color cadence",
    baseKey: "C",
    chords: [
      { root: "C", quality: "Maj" },
      { root: "C#", quality: "Maj" },
      { root: "G", quality: "Maj" },
      { root: "C", quality: "Maj" },
    ],
  },
  {
    id: "funk",
    name: "Funk vamp",
    category: "Modern & Alternative",
    description: "i7–IV7 groove",
    baseKey: "A",
    chords: [
      { root: "A", quality: "min7" },
      { root: "D", quality: "7" },
      { root: "A", quality: "min7" },
      { root: "D", quality: "7" },
    ],
  },
  {
    id: "reggae",
    name: "Reggae skank",
    category: "Modern & Alternative",
    description: "I–V offbeat feel",
    baseKey: "C",
    chords: [
      { root: "C", quality: "Maj" },
      { root: "G", quality: "Maj" },
    ],
  },
  {
    id: "gospel",
    name: "Gospel lift",
    category: "Modern & Alternative",
    description: "I–IV–I–V uplifting",
    baseKey: "C",
    chords: [
      { root: "C", quality: "Maj" },
      { root: "F", quality: "Maj" },
      { root: "C", quality: "Maj" },
      { root: "G", quality: "Maj" },
    ],
  },
  {
    id: "dream-pop",
    name: "Dream pop",
    category: "Modern & Alternative",
    description: "I–V–vi–iii–IV",
    baseKey: "C",
    chords: [
      { root: "C", quality: "Maj" },
      { root: "G", quality: "Maj" },
      { root: "A", quality: "min" },
      { root: "E", quality: "min" },
      { root: "F", quality: "Maj" },
    ],
  },
];

const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export function transposeRoot(root: string, fromKey: string, toKey: string) {
  const from = NOTES.indexOf(fromKey);
  const to = NOTES.indexOf(toKey);
  const rootIdx = NOTES.indexOf(root);
  if (from === -1 || to === -1 || rootIdx === -1) return root;
  const semitones = (to - from + 12) % 12;
  return NOTES[(rootIdx + semitones) % 12];
}

export function transposePreset(preset: ProgressionPreset, targetKey: string): ProgressionChord[] {
  return preset.chords.map((chord) => ({
    root: transposeRoot(chord.root, preset.baseKey, targetKey),
    quality: chord.quality,
  }));
}
