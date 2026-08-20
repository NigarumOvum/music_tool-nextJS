import { describe, expect, it } from "vitest";

import {
  defaultPartitureTitle,
  nextPartitureSlot,
  partitureInstrumentLabel,
  partitureKey,
} from "@/lib/music/partitures";

describe("partitureInstrumentLabel", () => {
  it("maps known ids to labels", () => {
    expect(partitureInstrumentLabel("guitar")).toBe("Guitar");
    expect(partitureInstrumentLabel("drums")).toBe("Drums");
  });

  it("falls back to the raw id", () => {
    expect(partitureInstrumentLabel("theremin")).toBe("theremin");
  });
});

describe("nextPartitureSlot", () => {
  it("starts at slot 1 for a new instrument", () => {
    expect(nextPartitureSlot([], "guitar")).toBe(1);
  });

  it("increments past existing slots for the same instrument", () => {
    const existing = [
      { instrument: "guitar", slot: 1 },
      { instrument: "guitar", slot: 3 },
      { instrument: "drums", slot: 5 },
    ];
    expect(nextPartitureSlot(existing, "guitar")).toBe(4);
    expect(nextPartitureSlot(existing, "drums")).toBe(6);
  });
});

describe("defaultPartitureTitle", () => {
  it("uses the label for the first slot", () => {
    expect(defaultPartitureTitle("guitar", 1)).toBe("Guitar");
  });

  it("numbers subsequent slots", () => {
    expect(defaultPartitureTitle("guitar", 2)).toBe("Guitar 2");
  });
});

describe("partitureKey", () => {
  it("combines instrument and slot", () => {
    expect(partitureKey("bass", 3)).toBe("bass:3");
  });
});