import { describe, expect, it } from "vitest";

import {
  NOTE_DIVISIONS,
  reconcileTabGridRows,
  secondsPerStep,
  stepsPerBar,
  stepsPerBeat,
} from "@/lib/music/tab-grid";

describe("reconcileTabGridRows", () => {
  it("uses the selected preset's exact string order and count", () => {
    const current = [
      { label: "E", cells: ["1", "-"] },
      { label: "A", cells: ["2", "-"] },
      { label: "D", cells: ["3", "-"] },
      { label: "G", cells: ["4", "-"] },
      { label: "B", cells: ["5", "-"] },
      { label: "e", cells: ["6", "-"] },
    ];

    expect(reconcileTabGridRows(current, ["e", "B", "G", "D", "A", "E"], 2)).toEqual([
      { label: "e", cells: ["1", "-"] },
      { label: "B", cells: ["2", "-"] },
      { label: "G", cells: ["3", "-"] },
      { label: "D", cells: ["4", "-"] },
      { label: "A", cells: ["5", "-"] },
      { label: "E", cells: ["6", "-"] },
    ]);
  });

  it("handles repeated labels and changing string counts without duplicating rows", () => {
    const current = [
      { label: "e", cells: ["1", "2"] },
      { label: "B", cells: ["3", "4"] },
      { label: "e", cells: ["5", "6"] },
    ];

    expect(reconcileTabGridRows(current, ["e", "B", "e", "A"], 3)).toEqual([
      { label: "e", cells: ["1", "2", "-"] },
      { label: "B", cells: ["3", "4", "-"] },
      { label: "e", cells: ["5", "6", "-"] },
      { label: "A", cells: ["-", "-", "-"] },
    ]);
    expect(reconcileTabGridRows(current, ["e", "B"], 1)).toEqual([
      { label: "e", cells: ["1"] },
      { label: "B", cells: ["3"] },
    ]);
  });

  it("calculates bar and beat divisions for common meters", () => {
    expect(stepsPerBar({ numerator: 4, denominator: 4 }, 16)).toBe(16);
    expect(stepsPerBar({ numerator: 6, denominator: 8 }, 16)).toBe(12);
    expect(stepsPerBar({ numerator: 7, denominator: 8 }, 8)).toBe(7);
    expect(stepsPerBeat({ numerator: 4, denominator: 4 }, 16)).toBe(4);
    expect(stepsPerBeat({ numerator: 6, denominator: 8 }, 16)).toBe(6);
    expect(stepsPerBeat({ numerator: 7, denominator: 8 }, 16)).toBe(2);
  });

  it("calculates note-step timing from tempo and note division", () => {
    expect(secondsPerStep(120, 8)).toBeCloseTo(0.25);
    expect(secondsPerStep(120, 16)).toBeCloseTo(0.125);
    expect(secondsPerStep(60, 32)).toBeCloseTo(0.125);
    expect(NOTE_DIVISIONS).toEqual([8, 16, 32]);
  });
});
