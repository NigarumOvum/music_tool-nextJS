export type TabGridRow = {
  label: string;
  cells: string[];
};

export type TimeSignature = {
  numerator: number;
  denominator: 4 | 8;
};

export const NOTE_DIVISIONS = [8, 16, 32] as const;
export type NoteDivision = (typeof NOTE_DIVISIONS)[number];

export function stepsPerBar(timeSignature: TimeSignature, noteDivision: NoteDivision): number {
  return (timeSignature.numerator * noteDivision) / timeSignature.denominator;
}

export function stepsPerBeat(timeSignature: TimeSignature, noteDivision: NoteDivision): number {
  const unitsPerBeat = timeSignature.denominator === 8 && timeSignature.numerator % 3 === 0 ? 3 : 1;
  return (noteDivision / timeSignature.denominator) * unitsPerBeat;
}

export function secondsPerStep(bpm: number, noteDivision: NoteDivision): number {
  return (60 / bpm) * (4 / noteDivision);
}

export function reconcileTabGridRows(
  current: readonly TabGridRow[],
  stringLabels: readonly string[],
  columnCount: number,
): TabGridRow[] {
  const columns = Math.max(1, columnCount);

  return stringLabels.map((label, index) => {
    const cells = current[index]?.cells.slice(0, columns) ?? [];
    while (cells.length < columns) cells.push("-");
    return { label, cells };
  });
}
