export type TuningString = {
  label: string;
  note: string;
  frequency: number;
};

export type TuningPreset = {
  id: string;
  name: string;
  instrument: "guitar" | "bass";
  strings: TuningString[];
};

const A4 = 440;

function freqFromNote(noteName: string): number {
  const match = noteName.match(/^([A-G]#?)(-?\d+)$/);
  if (!match) return 0;
  const [, pitch, octaveStr] = match;
  const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const semitone = names.indexOf(pitch);
  const octave = Number(octaveStr);
  const midi = semitone + (octave + 1) * 12;
  return A4 * 2 ** ((midi - 69) / 12);
}

function stringRow(label: string, note: string): TuningString {
  return { label, note, frequency: freqFromNote(note) };
}

// ── 6-string guitar tunings ────────────────────────────────────────────────
const GUITAR_6_TUNINGS: TuningPreset[] = [
  {
    id: "guitar-standard",
    name: "Standard (EADGBE)",
    instrument: "guitar",
    strings: [
      stringRow("E", "E2"),
      stringRow("A", "A2"),
      stringRow("D", "D3"),
      stringRow("G", "G3"),
      stringRow("B", "B3"),
      stringRow("e", "E4"),
    ],
  },
  {
    id: "guitar-drop-d",
    name: "Drop D",
    instrument: "guitar",
    strings: [
      stringRow("D", "D2"),
      stringRow("A", "A2"),
      stringRow("D", "D3"),
      stringRow("G", "G3"),
      stringRow("B", "B3"),
      stringRow("e", "E4"),
    ],
  },
  {
    id: "guitar-drop-c",
    name: "Drop C",
    instrument: "guitar",
    strings: [
      stringRow("C", "C2"),
      stringRow("G", "G2"),
      stringRow("C", "C3"),
      stringRow("F", "F3"),
      stringRow("A", "A3"),
      stringRow("D", "D4"),
    ],
  },
  {
    id: "guitar-drop-b",
    name: "Drop B",
    instrument: "guitar",
    strings: [
      stringRow("B", "B1"),
      stringRow("F#", "F#2"),
      stringRow("B", "B2"),
      stringRow("E", "E3"),
      stringRow("G#", "G#3"),
      stringRow("C#", "C#4"),
    ],
  },
  {
    id: "guitar-half-step-down",
    name: "Half step down (Eb)",
    instrument: "guitar",
    strings: [
      stringRow("Eb", "D#2"),
      stringRow("Ab", "G#2"),
      stringRow("Db", "C#3"),
      stringRow("Gb", "F#3"),
      stringRow("Bb", "A#3"),
      stringRow("eb", "D#4"),
    ],
  },
  {
    id: "guitar-full-step-down",
    name: "Whole step down (D)",
    instrument: "guitar",
    strings: [
      stringRow("D", "D2"),
      stringRow("G", "G2"),
      stringRow("C", "C3"),
      stringRow("F", "F3"),
      stringRow("A", "A3"),
      stringRow("D", "D4"),
    ],
  },
  {
    id: "guitar-dadgad",
    name: "DADGAD",
    instrument: "guitar",
    strings: [
      stringRow("D", "D2"),
      stringRow("A", "A2"),
      stringRow("D", "D3"),
      stringRow("G", "G3"),
      stringRow("A", "A3"),
      stringRow("D", "D4"),
    ],
  },
  {
    id: "guitar-open-g",
    name: "Open G (DGDGBD)",
    instrument: "guitar",
    strings: [
      stringRow("D", "D2"),
      stringRow("G", "G2"),
      stringRow("D", "D3"),
      stringRow("G", "G3"),
      stringRow("B", "B3"),
      stringRow("D", "D4"),
    ],
  },
  {
    id: "guitar-open-d",
    name: "Open D (DADF#AD)",
    instrument: "guitar",
    strings: [
      stringRow("D", "D2"),
      stringRow("A", "A2"),
      stringRow("D", "D3"),
      stringRow("F#", "F#3"),
      stringRow("A", "A3"),
      stringRow("D", "D4"),
    ],
  },
  {
    id: "guitar-open-e",
    name: "Open E (EBEG#BE)",
    instrument: "guitar",
    strings: [
      stringRow("E", "E2"),
      stringRow("B", "B2"),
      stringRow("E", "E3"),
      stringRow("G#", "G#3"),
      stringRow("B", "B3"),
      stringRow("E", "E4"),
    ],
  },
  {
    id: "guitar-open-a",
    name: "Open A (EAEAC#E)",
    instrument: "guitar",
    strings: [
      stringRow("E", "E2"),
      stringRow("A", "A2"),
      stringRow("E", "E3"),
      stringRow("A", "A3"),
      stringRow("C#", "C#4"),
      stringRow("E", "E4"),
    ],
  },
  {
    id: "guitar-csny",
    name: "Nashville high-strung",
    instrument: "guitar",
    strings: [
      stringRow("E", "E3"),
      stringRow("A", "A3"),
      stringRow("D", "D4"),
      stringRow("G", "G4"),
      stringRow("B", "B4"),
      stringRow("e", "E5"),
    ],
  },
];

// ── 7-string guitar tunings ────────────────────────────────────────────────
const GUITAR_7_TUNINGS: TuningPreset[] = [
  {
    id: "guitar-7-standard",
    name: "Standard 7-str (BEADGBE)",
    instrument: "guitar",
    strings: [
      stringRow("B", "B1"),
      stringRow("E", "E2"),
      stringRow("A", "A2"),
      stringRow("D", "D3"),
      stringRow("G", "G3"),
      stringRow("B", "B3"),
      stringRow("e", "E4"),
    ],
  },
  {
    id: "guitar-7-drop-a",
    name: "Drop A (AEADGBE)",
    instrument: "guitar",
    strings: [
      stringRow("A", "A1"),
      stringRow("E", "E2"),
      stringRow("A", "A2"),
      stringRow("D", "D3"),
      stringRow("G", "G3"),
      stringRow("B", "B3"),
      stringRow("e", "E4"),
    ],
  },
  {
    id: "guitar-7-half-down",
    name: "Half step down 7-str",
    instrument: "guitar",
    strings: [
      stringRow("Bb", "A#1"),
      stringRow("Eb", "D#2"),
      stringRow("Ab", "G#2"),
      stringRow("Db", "C#3"),
      stringRow("Gb", "F#3"),
      stringRow("Bb", "A#3"),
      stringRow("eb", "D#4"),
    ],
  },
];

// ── 8-string guitar tunings ────────────────────────────────────────────────
const GUITAR_8_TUNINGS: TuningPreset[] = [
  {
    id: "guitar-8-standard",
    name: "Standard 8-str (F#BEADGBE)",
    instrument: "guitar",
    strings: [
      stringRow("F#", "F#1"),
      stringRow("B", "B1"),
      stringRow("E", "E2"),
      stringRow("A", "A2"),
      stringRow("D", "D3"),
      stringRow("G", "G3"),
      stringRow("B", "B3"),
      stringRow("e", "E4"),
    ],
  },
  {
    id: "guitar-8-drop-e",
    name: "Drop E 8-str (EBEADGBE)",
    instrument: "guitar",
    strings: [
      stringRow("E", "E1"),
      stringRow("B", "B1"),
      stringRow("E", "E2"),
      stringRow("A", "A2"),
      stringRow("D", "D3"),
      stringRow("G", "G3"),
      stringRow("B", "B3"),
      stringRow("e", "E4"),
    ],
  },
  {
    id: "guitar-8-half-down",
    name: "Half step down 8-str",
    instrument: "guitar",
    strings: [
      stringRow("F", "F1"),
      stringRow("Bb", "A#1"),
      stringRow("Eb", "D#2"),
      stringRow("Ab", "G#2"),
      stringRow("Db", "C#3"),
      stringRow("Gb", "F#3"),
      stringRow("Bb", "A#3"),
      stringRow("eb", "D#4"),
    ],
  },
];

// ── 12-string guitar tunings ───────────────────────────────────────────────
const GUITAR_12_TUNINGS: TuningPreset[] = [
  {
    id: "guitar-12-standard",
    name: "Standard 12-str (EADGBE×2)",
    instrument: "guitar",
    strings: [
      stringRow("E", "E2"),
      stringRow("e", "E3"),
      stringRow("A", "A2"),
      stringRow("a", "A3"),
      stringRow("D", "D3"),
      stringRow("d", "D4"),
      stringRow("G", "G3"),
      stringRow("g", "G4"),
      stringRow("B", "B3"),
      stringRow("b", "B3"),
      stringRow("e1", "E4"),
      stringRow("e2", "E4"),
    ],
  },
  {
    id: "guitar-12-drop-d",
    name: "Drop D 12-str",
    instrument: "guitar",
    strings: [
      stringRow("D", "D2"),
      stringRow("d", "D3"),
      stringRow("A", "A2"),
      stringRow("a", "A3"),
      stringRow("D", "D3"),
      stringRow("d2", "D4"),
      stringRow("G", "G3"),
      stringRow("g", "G4"),
      stringRow("B", "B3"),
      stringRow("b", "B3"),
      stringRow("e1", "E4"),
      stringRow("e2", "E4"),
    ],
  },
];

// ── Full guitar catalog ────────────────────────────────────────────────────
export const GUITAR_TUNINGS: TuningPreset[] = [
  ...GUITAR_6_TUNINGS,
  ...GUITAR_7_TUNINGS,
  ...GUITAR_8_TUNINGS,
  ...GUITAR_12_TUNINGS,
];

// ── Bass tunings by string count ───────────────────────────────────────────
const BASS_4_TUNINGS: TuningPreset[] = [
  {
    id: "bass-standard-4",
    name: "Standard 4-str (EADG)",
    instrument: "bass",
    strings: [
      stringRow("E", "E1"),
      stringRow("A", "A1"),
      stringRow("D", "D2"),
      stringRow("G", "G2"),
    ],
  },
  {
    id: "bass-drop-d",
    name: "Drop D",
    instrument: "bass",
    strings: [
      stringRow("D", "D1"),
      stringRow("A", "A1"),
      stringRow("D", "D2"),
      stringRow("G", "G2"),
    ],
  },
  {
    id: "bass-half-step-down",
    name: "Half step down (Eb)",
    instrument: "bass",
    strings: [
      stringRow("Eb", "D#1"),
      stringRow("Ab", "G#1"),
      stringRow("Db", "C#2"),
      stringRow("Gb", "F#2"),
    ],
  },
  {
    id: "bass-full-step-down",
    name: "Whole step down (D)",
    instrument: "bass",
    strings: [
      stringRow("D", "D1"),
      stringRow("G", "G1"),
      stringRow("C", "C2"),
      stringRow("F", "F2"),
    ],
  },
];

const BASS_5_TUNINGS: TuningPreset[] = [
  {
    id: "bass-standard-5",
    name: "Standard 5-str (BEADG)",
    instrument: "bass",
    strings: [
      stringRow("B", "B0"),
      stringRow("E", "E1"),
      stringRow("A", "A1"),
      stringRow("D", "D2"),
      stringRow("G", "G2"),
    ],
  },
  {
    id: "bass-5-high-c",
    name: "5-str high C (EADGC)",
    instrument: "bass",
    strings: [
      stringRow("E", "E1"),
      stringRow("A", "A1"),
      stringRow("D", "D2"),
      stringRow("G", "G2"),
      stringRow("C", "C3"),
    ],
  },
  {
    id: "bass-5-drop-a",
    name: "Drop A 5-str",
    instrument: "bass",
    strings: [
      stringRow("A", "A0"),
      stringRow("E", "E1"),
      stringRow("A", "A1"),
      stringRow("D", "D2"),
      stringRow("G", "G2"),
    ],
  },
];

const BASS_6_TUNINGS: TuningPreset[] = [
  {
    id: "bass-6-standard",
    name: "Standard 6-str (BEADGC)",
    instrument: "bass",
    strings: [
      stringRow("B", "B0"),
      stringRow("E", "E1"),
      stringRow("A", "A1"),
      stringRow("D", "D2"),
      stringRow("G", "G2"),
      stringRow("C", "C3"),
    ],
  },
  {
    id: "bass-6-drop-a",
    name: "Drop A 6-str (AEADGC)",
    instrument: "bass",
    strings: [
      stringRow("A", "A0"),
      stringRow("E", "E1"),
      stringRow("A", "A1"),
      stringRow("D", "D2"),
      stringRow("G", "G2"),
      stringRow("C", "C3"),
    ],
  },
];

const BASS_7_TUNINGS: TuningPreset[] = [
  {
    id: "bass-7-standard",
    name: "Standard 7-str (F#BEADGC)",
    instrument: "bass",
    strings: [
      stringRow("F#", "F#0"),
      stringRow("B", "B0"),
      stringRow("E", "E1"),
      stringRow("A", "A1"),
      stringRow("D", "D2"),
      stringRow("G", "G2"),
      stringRow("C", "C3"),
    ],
  },
  {
    id: "bass-7-drop-e",
    name: "Drop E 7-str",
    instrument: "bass",
    strings: [
      stringRow("E", "E0"),
      stringRow("B", "B0"),
      stringRow("E", "E1"),
      stringRow("A", "A1"),
      stringRow("D", "D2"),
      stringRow("G", "G2"),
      stringRow("C", "C3"),
    ],
  },
];

// ── Full bass catalog ──────────────────────────────────────────────────────
export const BASS_TUNINGS: TuningPreset[] = [
  ...BASS_4_TUNINGS,
  ...BASS_5_TUNINGS,
  ...BASS_6_TUNINGS,
  ...BASS_7_TUNINGS,
];

// ── Helpers ────────────────────────────────────────────────────────────────
export type GuitarStringCount = 6 | 7 | 8 | 12;
export type BassStringCount = 4 | 5 | 6 | 7;

export function guitarTuningsForStringCount(count: GuitarStringCount): TuningPreset[] {
  switch (count) {
    case 7: return GUITAR_7_TUNINGS;
    case 8: return GUITAR_8_TUNINGS;
    case 12: return GUITAR_12_TUNINGS;
    default: return GUITAR_6_TUNINGS;
  }
}

export function bassTuningsForStringCount(count: BassStringCount): TuningPreset[] {
  switch (count) {
    case 5: return BASS_5_TUNINGS;
    case 6: return BASS_6_TUNINGS;
    case 7: return BASS_7_TUNINGS;
    default: return BASS_4_TUNINGS;
  }
}

export function centsFromTarget(frequency: number, targetFrequency: number) {
  if (frequency <= 0 || targetFrequency <= 0) return 0;
  return Math.round(1200 * Math.log2(frequency / targetFrequency));
}

export function findClosestString(frequency: number, strings: TuningString[]) {
  if (frequency <= 0) return null;

  let best: { string: TuningString; cents: number; octaveShift: number } | null = null;
  let bestAbs = Infinity;

  for (const tuningString of strings) {
    for (const shift of [-2, -1, 0, 1, 2]) {
      const target = tuningString.frequency * 2 ** shift;
      const cents = centsFromTarget(frequency, target);
      const abs = Math.abs(cents);
      if (abs < bestAbs) {
        bestAbs = abs;
        best = { string: tuningString, cents, octaveShift: shift };
      }
    }
  }

  return best;
}

// ── Additional instrument types ────────────────────────────────────────────
export type OtherInstrumentId =
  | "ukulele"
  | "violin"
  | "viola"
  | "cello"
  | "mandolin"
  | "banjo";

export type TunerInstrumentId = "guitar" | "bass" | OtherInstrumentId;

export const OTHER_INSTRUMENT_TUNINGS: Record<OtherInstrumentId, TuningPreset[]> = {
  ukulele: [
    {
      id: "ukulele-standard",
      name: "Standard (GCEA)",
      instrument: "guitar",
      strings: [
        stringRow("G", "G4"),
        stringRow("C", "C4"),
        stringRow("E", "E4"),
        stringRow("A", "A4"),
      ],
    },
    {
      id: "ukulele-low-g",
      name: "Low G (gCEA)",
      instrument: "guitar",
      strings: [
        stringRow("G", "G3"),
        stringRow("C", "C4"),
        stringRow("E", "E4"),
        stringRow("A", "A4"),
      ],
    },
    {
      id: "ukulele-baritone",
      name: "Baritone (DGBE)",
      instrument: "guitar",
      strings: [
        stringRow("D", "D3"),
        stringRow("G", "G3"),
        stringRow("B", "B3"),
        stringRow("E", "E4"),
      ],
    },
    {
      id: "ukulele-tenor",
      name: "Tenor (GCEA)",
      instrument: "guitar",
      strings: [
        stringRow("G", "G3"),
        stringRow("C", "C3"),
        stringRow("E", "E4"),
        stringRow("A", "A4"),
      ],
    },
  ],
  violin: [
    {
      id: "violin-standard",
      name: "Standard (GDAE)",
      instrument: "guitar",
      strings: [
        stringRow("G", "G3"),
        stringRow("D", "D4"),
        stringRow("A", "A4"),
        stringRow("E", "E5"),
      ],
    },
    {
      id: "violin-scordatura",
      name: "Scordatura (ADAE)",
      instrument: "guitar",
      strings: [
        stringRow("A", "A3"),
        stringRow("D", "D4"),
        stringRow("A", "A4"),
        stringRow("E", "E5"),
      ],
    },
  ],
  viola: [
    {
      id: "viola-standard",
      name: "Standard (CGDA)",
      instrument: "guitar",
      strings: [
        stringRow("C", "C3"),
        stringRow("G", "G3"),
        stringRow("D", "D4"),
        stringRow("A", "A4"),
      ],
    },
  ],
  cello: [
    {
      id: "cello-standard",
      name: "Standard (CGDA)",
      instrument: "bass",
      strings: [
        stringRow("C", "C2"),
        stringRow("G", "G2"),
        stringRow("D", "D3"),
        stringRow("A", "A3"),
      ],
    },
    {
      id: "cello-5string",
      name: "5-string (FCGDA)",
      instrument: "bass",
      strings: [
        stringRow("F", "F1"),
        stringRow("C", "C2"),
        stringRow("G", "G2"),
        stringRow("D", "D3"),
        stringRow("A", "A3"),
      ],
    },
  ],
  mandolin: [
    {
      id: "mandolin-standard",
      name: "Standard (GDAE×2)",
      instrument: "guitar",
      strings: [
        stringRow("G", "G3"),
        stringRow("g", "G3"),
        stringRow("D", "D4"),
        stringRow("d", "D4"),
        stringRow("A", "A4"),
        stringRow("a", "A4"),
        stringRow("E", "E5"),
        stringRow("e", "E5"),
      ],
    },
    {
      id: "mandolin-gdae",
      name: "Single course (GDAE)",
      instrument: "guitar",
      strings: [
        stringRow("G", "G3"),
        stringRow("D", "D4"),
        stringRow("A", "A4"),
        stringRow("E", "E5"),
      ],
    },
  ],
  banjo: [
    {
      id: "banjo-5string",
      name: "5-string Open G (gDGBD)",
      instrument: "guitar",
      strings: [
        stringRow("g", "G4"),
        stringRow("D", "D3"),
        stringRow("G", "G3"),
        stringRow("B", "B3"),
        stringRow("D", "D4"),
      ],
    },
    {
      id: "banjo-4string",
      name: "4-string Chicago (DGBE)",
      instrument: "guitar",
      strings: [
        stringRow("D", "D3"),
        stringRow("G", "G3"),
        stringRow("B", "B3"),
        stringRow("E", "E4"),
      ],
    },
    {
      id: "banjo-4string-irish",
      name: "4-string Irish (GDAE)",
      instrument: "guitar",
      strings: [
        stringRow("G", "G3"),
        stringRow("D", "D4"),
        stringRow("A", "A4"),
        stringRow("E", "E5"),
      ],
    },
    {
      id: "banjo-open-d",
      name: "Open D (f#DF#AD)",
      instrument: "guitar",
      strings: [
        stringRow("f#", "F#4"),
        stringRow("D", "D3"),
        stringRow("F#", "F#3"),
        stringRow("A", "A3"),
        stringRow("D", "D4"),
      ],
    },
  ],
};

export function tuningsForInstrument(id: TunerInstrumentId, stringCount?: number): TuningPreset[] {
  if (id === "guitar") return guitarTuningsForStringCount((stringCount as GuitarStringCount) ?? 6);
  if (id === "bass") return bassTuningsForStringCount((stringCount as BassStringCount) ?? 4);
  return OTHER_INSTRUMENT_TUNINGS[id as OtherInstrumentId] ?? [];
}
