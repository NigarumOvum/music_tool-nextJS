export type MetronomeSoundType = "digital" | "woodblock" | "cowbell" | "mechanical" | "rimshot";

export function playMetronomeSound(
  ctx: AudioContext,
  sound: MetronomeSoundType,
  isAccent: boolean,
  volume = 1,
  time?: number,
  isSubdivision = false
) {
  const when = time ?? ctx.currentTime;
  const masterGain = ctx.createGain();
  const adjustedVol = Math.max(0, Math.min(1, volume)) * (isAccent ? 1.0 : isSubdivision ? 0.45 : 0.75);
  masterGain.gain.setValueAtTime(adjustedVol, when);
  masterGain.connect(ctx.destination);

  switch (sound) {
    case "woodblock": {
      // Woodblock: high Q bandpass resonant burst
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(isAccent ? 1400 : isSubdivision ? 900 : 1050, when);
      filter.Q.setValueAtTime(14, when);

      osc.type = "triangle";
      osc.frequency.setValueAtTime(isAccent ? 1400 : isSubdivision ? 900 : 1050, when);

      gain.gain.setValueAtTime(0.9, when);
      gain.gain.exponentialRampToValueAtTime(0.001, when + 0.04);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(masterGain);

      osc.start(when);
      osc.stop(when + 0.05);
      break;
    }

    case "cowbell": {
      // 808-style Cowbell: two square oscillators through bandpass filter
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      const f1 = isAccent ? 840 : 587;
      const f2 = isAccent ? 1260 : 845;

      osc1.type = "square";
      osc2.type = "square";
      osc1.frequency.setValueAtTime(f1, when);
      osc2.frequency.setValueAtTime(f2, when);

      filter.type = "bandpass";
      filter.frequency.setValueAtTime(isAccent ? 1000 : 800, when);
      filter.Q.setValueAtTime(4, when);

      gain.gain.setValueAtTime(0.7, when);
      gain.gain.exponentialRampToValueAtTime(0.001, when + 0.07);

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);
      gain.connect(masterGain);

      osc1.start(when);
      osc2.start(when);
      osc1.stop(when + 0.08);
      osc2.stop(when + 0.08);
      break;
    }

    case "mechanical": {
      // Mechanical acoustic tick: transient noise burst + low wood body
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(isAccent ? 450 : 320, when);
      osc.frequency.exponentialRampToValueAtTime(60, when + 0.03);

      gain.gain.setValueAtTime(0.8, when);
      gain.gain.exponentialRampToValueAtTime(0.001, when + 0.035);

      osc.connect(gain);
      gain.connect(masterGain);

      osc.start(when);
      osc.stop(when + 0.04);
      break;
    }

    case "rimshot": {
      // Snappy rimshot click
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(isAccent ? 2100 : 1600, when);
      osc.frequency.exponentialRampToValueAtTime(300, when + 0.025);

      gain.gain.setValueAtTime(0.85, when);
      gain.gain.exponentialRampToValueAtTime(0.001, when + 0.03);

      osc.connect(gain);
      gain.connect(masterGain);

      osc.start(when);
      osc.stop(when + 0.035);
      break;
    }

    case "digital":
    default: {
      // Pure digital beep
      const osc = ctx.createOscillator();
      const envelope = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(isAccent ? 1900 : isSubdivision ? 1000 : 1300, when);
      envelope.gain.setValueAtTime(0.65, when);
      envelope.gain.exponentialRampToValueAtTime(0.001, when + 0.05);
      osc.connect(envelope);
      envelope.connect(masterGain);
      osc.start(when);
      osc.stop(when + 0.06);
      break;
    }
  }
}
