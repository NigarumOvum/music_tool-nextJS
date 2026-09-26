import {
  isInstrumentReady,
  playSampledNote,
  preloadInstrument,
  type SampleInstrumentId,
} from "@/lib/music/sample-engine";

export type PluckInstrument = "guitar-steel" | "guitar-nylon" | "bass" | "bass-pick";

const PLUCK_TO_SAMPLE: Record<PluckInstrument, SampleInstrumentId> = {
  "guitar-steel": "guitar-steel",
  "guitar-nylon": "guitar-nylon",
  bass: "bass",
  "bass-pick": "bass-pick",
};

/** Fetch + decode real pluck samples (see public/samples/README.md). */
export function preloadPluck(audioContext: AudioContext, instrument: PluckInstrument): Promise<boolean> {
  return preloadInstrument(audioContext, PLUCK_TO_SAMPLE[instrument]);
}

export function isPluckSampled(audioContext: AudioContext, instrument: PluckInstrument): boolean {
  return isInstrumentReady(audioContext, PLUCK_TO_SAMPLE[instrument]);
}

function karplusStrongDamping(instrument: PluckInstrument, frequency: number) {
  // Higher strings decay faster; nylon is softer than steel.
  const base =
    instrument === "guitar-nylon" ? 0.996 : instrument === "bass" || instrument === "bass-pick" ? 0.9985 : 0.9975;
  return Math.min(0.9995, base - frequency / 48000);
}

/**
 * Karplus-Strong plucked-string synthesis — dramatically closer to a real
 * string than a plain oscillator, with zero downloads.
 */
function playKarplusStrong(
  audioContext: AudioContext,
  out: AudioNode,
  frequency: number,
  instrument: PluckInstrument,
  velocity: number,
  when: number,
) {
  const sampleRate = audioContext.sampleRate;
  const ringSeconds = instrument.startsWith("bass") ? 2.4 : 1.8;
  const length = Math.min(Math.ceil(sampleRate * ringSeconds), sampleRate * 3);
  const buffer = audioContext.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);

  const period = Math.max(2, Math.round(sampleRate / frequency));
  const bright = instrument === "guitar-steel" || instrument === "bass-pick";
  for (let i = 0; i < period; i += 1) {
    // Noise burst excitation; brighter pickups keep more high end.
    data[i] = (Math.random() * 2 - 1) * (bright ? 1 : 0.8);
  }

  const rho = karplusStrongDamping(instrument, frequency);
  for (let i = period; i < length; i += 1) {
    data[i] = rho * 0.5 * (data[i - period] + data[i - period + 1 >= length ? i - period : i - period + 1]);
  }

  const source = audioContext.createBufferSource();
  source.buffer = buffer;

  // Gentle lowpass keeps nylon/bass round and tames aliasing up high.
  const filter = audioContext.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(
    Math.min(12000, Math.max(2500, frequency * (bright ? 10 : 6))),
    when,
  );

  const gain = audioContext.createGain();
  const peak = (instrument.startsWith("bass") ? 0.38 : 0.28) * (0.35 + velocity * 0.65);
  gain.gain.setValueAtTime(0, when);
  gain.gain.linearRampToValueAtTime(peak, when + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.001, when + ringSeconds);

  source.connect(filter);
  filter.connect(gain);
  gain.connect(out);
  source.start(when);
  source.stop(when + ringSeconds + 0.05);
}

export function playReferencePluck(
  audioContext: AudioContext,
  frequency: number,
  instrument: PluckInstrument,
  when = audioContext.currentTime,
  velocity = 0.85,
  out: AudioNode | null = null,
) {
  if (frequency <= 0) return;
  const destination = out ?? audioContext.destination;

  // Real samples first — silently falls through to KS synthesis when missing.
  const midi = Math.round(69 + 12 * Math.log2(frequency / 440));
  if (
    playSampledNote(audioContext, destination, PLUCK_TO_SAMPLE[instrument], midi, {
      when,
      velocity,
      duration: instrument.startsWith("bass") ? 2.2 : 1.6,
    })
  ) {
    if (instrument === "bass" || instrument === "bass-pick") {
      // Add sub weight under the sample like the old synth did.
      const sub = audioContext.createOscillator();
      sub.type = "sine";
      sub.frequency.setValueAtTime(frequency / 2, when);
      const subGain = audioContext.createGain();
      subGain.gain.setValueAtTime(0.1 * velocity, when);
      subGain.gain.exponentialRampToValueAtTime(0.001, when + 1.5);
      sub.connect(subGain);
      subGain.connect(destination);
      sub.start(when);
      sub.stop(when + 1.6);
    }
    return;
  }

  playKarplusStrong(audioContext, destination, frequency, instrument, velocity, when);

  if (instrument === "bass" || instrument === "bass-pick") {
    const sub = audioContext.createOscillator();
    sub.type = "sine";
    sub.frequency.setValueAtTime(frequency / 2, when);
    const subGain = audioContext.createGain();
    subGain.gain.setValueAtTime(0.12 * velocity, when);
    subGain.gain.exponentialRampToValueAtTime(0.001, when + 1.8);
    sub.connect(subGain);
    subGain.connect(destination);
    sub.start(when);
    sub.stop(when + 1.9);
  }
}
