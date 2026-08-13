import type { MidiNote } from "@/lib/music/midi-parser";

export function scheduleMidiNotes(
  audioContext: AudioContext,
  notes: MidiNote[],
  options: {
    startAt?: number;
    offsetSeconds?: number;
    gain?: number;
    mute?: boolean;
    pan?: number;
  } = {},
) {
  if (options.mute) return () => {};

  const startAt = options.startAt ?? audioContext.currentTime + 0.05;
  const offset = options.offsetSeconds ?? 0;
  const masterGain = Math.max(0, Math.min(1, (options.gain ?? 80) / 100));
  const pan = Math.max(-1, Math.min(1, (options.pan ?? 0) / 100));
  const oscillators: OscillatorNode[] = [];

  for (const note of notes) {
    if (note.endTime <= offset) continue;
    const noteStart = Math.max(0, note.startTime - offset);
    const noteEnd = note.endTime - offset;
    if (noteEnd <= noteStart) continue;

    const when = startAt + noteStart;
    const duration = noteEnd - noteStart;
    const freq = 440 * 2 ** ((note.note - 69) / 12);
    const velocityGain = Math.max(0.04, (note.velocity / 127) * masterGain);

    const panner = audioContext.createStereoPanner();
    panner.pan.setValueAtTime(pan, when);

    const gain = audioContext.createGain();
    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(velocityGain, when + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, when + duration);

    const osc = audioContext.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, when);

    osc.connect(gain);
    gain.connect(panner);
    panner.connect(audioContext.destination);

    osc.start(when);
    osc.stop(when + duration + 0.05);
    oscillators.push(osc);
  }

  return () => {
    oscillators.forEach((osc) => {
      try {
        osc.stop();
      } catch {
        // Already stopped.
      }
    });
  };
}
