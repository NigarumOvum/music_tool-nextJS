export const CHROMATIC = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;
export const WHITE_KEYS = ["C", "D", "E", "F", "G", "A", "B"] as const;
export const BLACK_KEYS = ["C#", "D#", "F#", "G#", "A#"] as const;

const A4 = 440;

export function noteFrequency(note: string, octave: number) {
  const index = CHROMATIC.indexOf(note as (typeof CHROMATIC)[number]);
  if (index === -1) return 0;
  const midi = index + (octave + 1) * 12;
  return A4 * 2 ** ((midi - 69) / 12);
}

export function noteId(note: string, octave: number) {
  return `${note}${octave}`;
}

export function pitchClassFromNoteId(noteId: string) {
  return noteId.replace(/\d+$/, "");
}

export function intervalsToPitchClasses(root: string, intervals: number[]) {
  const rootIndex = CHROMATIC.indexOf(root as (typeof CHROMATIC)[number]);
  if (rootIndex === -1) return [];
  return intervals.map((interval) => CHROMATIC[(rootIndex + interval) % 12]);
}
