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

export const GUITAR_TUNINGS: TuningPreset[] = [
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
    id: "guitar-half-step-down",
    name: "Half step down",
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
    name: "Whole step down",
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
    name: "Nashville / Csny",
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

export const BASS_TUNINGS: TuningPreset[] = [
  {
    id: "bass-standard-4",
    name: "Standard 4-string (EADG)",
    instrument: "bass",
    strings: [
      stringRow("E", "E1"),
      stringRow("A", "A1"),
      stringRow("D", "D2"),
      stringRow("G", "G2"),
    ],
  },
  {
    id: "bass-standard-5",
    name: "Standard 5-string (BEADG)",
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
    id: "bass-drop-d",
    name: "Drop D bass",
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
    name: "Half step down",
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
    name: "Whole step down",
    instrument: "bass",
    strings: [
      stringRow("D", "D1"),
      stringRow("G", "G1"),
      stringRow("C", "C2"),
      stringRow("F", "F2"),
    ],
  },
  {
    id: "bass-5-high-c",
    name: "5-string high C (EADGC)",
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
    id: "bass-6-standard",
    name: "6-string (BEADGC)",
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
];

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
