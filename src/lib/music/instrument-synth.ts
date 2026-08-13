export type PluckInstrument = "guitar-steel" | "guitar-nylon" | "bass" | "bass-pick";

function createOverdriveCurve() {
  const nSamples = 44100;
  const curve = new Float32Array(nSamples);
  const deg = Math.PI / 180;
  for (let i = 0; i < nSamples; i += 1) {
    const x = (i * 2) / nSamples - 1;
    curve[i] = ((3 + 20) * x * 20 * deg) / (Math.PI + 20 * Math.abs(x));
  }
  return curve;
}

export function playReferencePluck(
  audioContext: AudioContext,
  frequency: number,
  instrument: PluckInstrument,
  when = audioContext.currentTime,
) {
  if (frequency <= 0) return;

  const masterGain = audioContext.createGain();
  masterGain.gain.setValueAtTime(instrument.startsWith("bass") ? 0.38 : 0.28, when);
  masterGain.connect(audioContext.destination);

  const osc = audioContext.createOscillator();
  const gain = audioContext.createGain();

  if (instrument === "guitar-nylon") {
    osc.type = "sine";
    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(0.18, when + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, when + 1.4);
  } else if (instrument === "bass" || instrument === "bass-pick") {
    osc.type = "triangle";
    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(instrument === "bass-pick" ? 0.3 : 0.22, when + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, when + 2.2);

    const sub = audioContext.createOscillator();
    sub.type = "sine";
    sub.frequency.setValueAtTime(frequency / 2, when);
    const subGain = audioContext.createGain();
    subGain.gain.setValueAtTime(0.12, when);
    subGain.gain.exponentialRampToValueAtTime(0.001, when + 1.8);
    sub.connect(subGain);
    subGain.connect(masterGain);
    sub.start(when);
    sub.stop(when + 1.9);
  } else {
    osc.type = "triangle";
    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(0.22, when + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, when + 1.6);
  }

  osc.frequency.setValueAtTime(frequency, when);
  osc.connect(gain);
  gain.connect(masterGain);
  osc.start(when);
  osc.stop(when + 2.2);
}
