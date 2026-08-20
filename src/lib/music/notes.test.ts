import { describe, expect, it } from "vitest";

import {
  CHROMATIC,
  intervalsToPitchClasses,
  noteFrequency,
  noteId,
  pitchClassFromNoteId,
} from "@/lib/music/notes";

describe("noteFrequency", () => {
  it("returns 440 Hz for A4", () => {
    expect(noteFrequency("A", 4)).toBeCloseTo(440, 3);
  });

  it("returns the correct frequency for C4 (middle C)", () => {
    expect(noteFrequency("C", 4)).toBeCloseTo(261.6256, 3);
  });

  it("returns 0 for an unknown note", () => {
    expect(noteFrequency("H", 4)).toBe(0);
  });

  it("is exactly one octave higher per +12 semitones", () => {
    expect(noteFrequency("A", 5)).toBeCloseTo(noteFrequency("A", 4) * 2, 3);
  });
});

describe("noteId / pitchClassFromNoteId", () => {
  it("combines note and octave", () => {
    expect(noteId("C#", 4)).toBe("C#4");
  });

  it("strips the octave from a note id", () => {
    expect(pitchClassFromNoteId("G#3")).toBe("G#");
  });
});

describe("intervalsToPitchClasses", () => {
  it("builds a C major triad", () => {
    expect(intervalsToPitchClasses("C", [0, 4, 7])).toEqual(["C", "E", "G"]);
  });

  it("wraps around the octave", () => {
    expect(intervalsToPitchClasses("G", [0, 4, 7, 11])).toEqual(["G", "B", "D", "F#"]);
  });

  it("returns [] for an unknown root", () => {
    expect(intervalsToPitchClasses("H", [0, 4, 7])).toEqual([]);
  });

  it("has 12 chromatic notes", () => {
    expect(CHROMATIC).toHaveLength(12);
  });
});