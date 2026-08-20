import { describe, expect, it } from "vitest";

import { PROGRESSION_PRESETS, transposePreset, transposeRoot } from "@/lib/music/progression-presets";

describe("transposeRoot", () => {
  it("keeps the root when keys match", () => {
    expect(transposeRoot("C", "C", "C")).toBe("C");
  });

  it("transposes C to G when moving from C to G", () => {
    expect(transposeRoot("C", "C", "G")).toBe("G");
    expect(transposeRoot("E", "C", "G")).toBe("B");
  });

  it("wraps around the octave", () => {
    expect(transposeRoot("B", "C", "D")).toBe("C#");
  });

  it("returns the root untouched for unknown keys", () => {
    expect(transposeRoot("C", "H", "G")).toBe("C");
  });
});

describe("transposePreset", () => {
  it("preserves chord qualities while moving roots", () => {
    const preset = PROGRESSION_PRESETS.find((item) => item.baseKey === "C");
    expect(preset).toBeDefined();
    if (!preset) return;

    const transposed = transposePreset(preset, "G");
    expect(transposed).toHaveLength(preset.chords.length);
    expect(transposed[0].quality).toBe(preset.chords[0].quality);
    expect(transposed[0].root).toBe(transposeRoot(preset.chords[0].root, "C", "G"));
  });

  it("transposes C major chord set to G", () => {
    const fakePreset = {
      baseKey: "C",
      chords: [
        { root: "C", quality: "Maj" },
        { root: "G", quality: "Maj" },
        { root: "A", quality: "min" },
      ],
    };
    const transposed = transposePreset(fakePreset, "G");
    expect(transposed.map((chord) => chord.root)).toEqual(["G", "D", "E"]);
  });
});