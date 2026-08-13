const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export type PitchDetection = {
  frequency: number;
  note: string;
  cents: number;
};

export function frequencyToNote(frequency: number): { note: string; cents: number } {
  if (!Number.isFinite(frequency) || frequency <= 0) {
    return { note: "—", cents: 0 };
  }

  const midi = 12 * Math.log2(frequency / 440) + 69;
  const rounded = Math.round(midi);
  const cents = Math.round((midi - rounded) * 100);
  const note = NOTE_NAMES[((rounded % 12) + 12) % 12];
  const octave = Math.floor(rounded / 12) - 1;

  return {
    note: `${note}${octave}`,
    cents,
  };
}

export function detectPitchAutocorrelation(buffer: Float32Array, sampleRate: number): PitchDetection | null {
  if (buffer.length === 0 || sampleRate <= 0) {
    return null;
  }

  const minPeriod = Math.floor(sampleRate / 1200);
  const maxPeriod = Math.floor(sampleRate / 60);
  if (maxPeriod >= buffer.length) {
    return null;
  }

  let bestOffset = -1;
  let bestCorrelation = 0;

  for (let offset = minPeriod; offset <= maxPeriod; offset += 1) {
    let correlation = 0;
    for (let i = 0; i < buffer.length - offset; i += 1) {
      correlation += buffer[i] * buffer[i + offset];
    }

    if (correlation > bestCorrelation) {
      bestCorrelation = correlation;
      bestOffset = offset;
    }
  }

  if (bestOffset <= 0 || bestCorrelation < 0.01) {
    return null;
  }

  const frequency = sampleRate / bestOffset;
  const { note, cents } = frequencyToNote(frequency);

  return {
    frequency,
    note,
    cents,
  };
}
