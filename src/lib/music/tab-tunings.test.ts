import { describe, expect, it } from "vitest";
import { GUITAR_TUNINGS, BASS_TUNINGS } from "@/lib/music/tunings";
import { parseMidiFile } from "@/lib/music/midi-parser";

describe("Tab Studio Tunings & Multi-Track MIDI", () => {
  it("has complete guitar tunings and correct string counts", () => {
    expect(GUITAR_TUNINGS.length).toBeGreaterThanOrEqual(10);
    const standard = GUITAR_TUNINGS.find((t) => t.id === "guitar-standard");
    expect(standard).toBeDefined();
    expect(standard?.strings).toHaveLength(6);
    expect(standard?.strings[0].note).toBe("E2");
    expect(standard?.strings[5].note).toBe("E4");
  });

  it("has complete bass tunings with 4, 5, and 6 string configurations", () => {
    const bass4 = BASS_TUNINGS.find((t) => t.id === "bass-standard-4");
    const bass5 = BASS_TUNINGS.find((t) => t.id === "bass-standard-5");
    const bass6 = BASS_TUNINGS.find((t) => t.id === "bass-6-standard");

    expect(bass4?.strings).toHaveLength(4);
    expect(bass5?.strings).toHaveLength(5);
    expect(bass6?.strings).toHaveLength(6);
  });
});
