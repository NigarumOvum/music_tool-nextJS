import { playReferencePluck, type PluckInstrument } from "@/lib/music/instrument-synth";

export type KeyboardVoice =
  | "piano"
  | "electric-piano"
  | "organ"
  | "strings"
  | "synth"
  | "guitar-steel"
  | "guitar-nylon"
  | "bass"
  | "bass-pick";

export const KEYBOARD_VOICES: { id: KeyboardVoice; label: string }[] = [
  { id: "piano", label: "Grand piano" },
  { id: "electric-piano", label: "Electric piano" },
  { id: "organ", label: "Organ" },
  { id: "strings", label: "Strings" },
  { id: "synth", label: "Synth pad" },
  { id: "guitar-steel", label: "Steel guitar" },
  { id: "guitar-nylon", label: "Nylon guitar" },
  { id: "bass", label: "Fingered bass" },
  { id: "bass-pick", label: "Pick bass" },
];

export function playKeyboardNote(
  audioContext: AudioContext,
  frequency: number,
  voice: KeyboardVoice,
  when = audioContext.currentTime,
) {
  if (frequency <= 0) return;

  if (voice === "guitar-steel" || voice === "guitar-nylon" || voice === "bass" || voice === "bass-pick") {
    playReferencePluck(audioContext, frequency, voice as PluckInstrument, when);
    return;
  }

  const master = audioContext.createGain();
  master.gain.setValueAtTime(0.22, when);
  master.connect(audioContext.destination);

  const osc = audioContext.createOscillator();
  const gain = audioContext.createGain();

  if (voice === "piano") {
    osc.type = "triangle";
    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(0.35, when + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, when + 1.4);
  } else if (voice === "electric-piano") {
    osc.type = "sine";
    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(0.28, when + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, when + 1.1);

    const bell = audioContext.createOscillator();
    bell.type = "triangle";
    bell.frequency.setValueAtTime(frequency * 2, when);
    const bellGain = audioContext.createGain();
    bellGain.gain.setValueAtTime(0.08, when);
    bellGain.gain.exponentialRampToValueAtTime(0.001, when + 0.6);
    bell.connect(bellGain);
    bellGain.connect(master);
    bell.start(when);
    bell.stop(when + 0.65);
  } else if (voice === "organ") {
    osc.type = "square";
    gain.gain.setValueAtTime(0.12, when);
    gain.gain.exponentialRampToValueAtTime(0.001, when + 0.9);
  } else if (voice === "strings") {
    osc.type = "sawtooth";
    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(0.16, when + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, when + 1.8);
  } else {
    osc.type = "sine";
    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(0.2, when + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, when + 1.6);
  }

  osc.frequency.setValueAtTime(frequency, when);
  osc.connect(gain);
  gain.connect(master);
  osc.start(when);
  osc.stop(when + 2);
}

export function playKeyboardNotes(
  audioContext: AudioContext,
  frequencies: number[],
  voice: KeyboardVoice,
  staggerMs = 120,
) {
  const start = audioContext.currentTime;
  frequencies.forEach((frequency, index) => {
    playKeyboardNote(audioContext, frequency, voice, start + (index * staggerMs) / 1000);
  });
}
