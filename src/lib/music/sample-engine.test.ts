import { describe, expect, it } from "vitest";

import {
  anchorToMidi,
  midiToAnchorName,
  nearestAnchor,
  sampleUrl,
  SAMPLE_ANCHORS,
  type SampleInstrumentId,
} from "@/lib/music/sample-engine";

describe("sample-engine note math", () => {
  it("converts anchors to MIDI numbers", () => {
    expect(anchorToMidi("C4")).toBe(60);
    expect(anchorToMidi("A4")).toBe(69);
    expect(anchorToMidi("E2")).toBe(40);
    expect(anchorToMidi("nope")).toBe(-1);
  });

  it("converts MIDI numbers to anchor names", () => {
    expect(midiToAnchorName(60)).toBe("C4");
    expect(midiToAnchorName(69)).toBe("A4");
    expect(midiToAnchorName(41)).toBe("F2");
  });

  it("finds the nearest anchor for pitch shifting", () => {
    const { anchor } = nearestAnchor("piano", 62);
    expect(["C1", "C2", "C3", "C4", "C5", "C6", "C7"]).toContain(anchor);
    // D4 (62) sits between C4 and C5 — C4 wins the tie.
    expect(anchor).toBe("C4");
    expect(nearestAnchor("guitar-steel", 64).anchor).toBe("E4");
  });

  it("every instrument ships at least 4 anchors", () => {
    for (const id of Object.keys(SAMPLE_ANCHORS) as SampleInstrumentId[]) {
      expect(SAMPLE_ANCHORS[id].length).toBeGreaterThanOrEqual(4);
    }
  });

  it("builds sample URLs under the base path", () => {
    expect(sampleUrl("piano", "C4")).toBe("/samples/piano/C4.mp3");
  });
});
