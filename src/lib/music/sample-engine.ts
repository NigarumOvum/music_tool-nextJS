import { CHROMATIC } from "@/lib/music/notes";

/**
 * Central sample engine: plays real recorded instrument samples when they are
 * available, and reports "not ready" so callers fall back to synthesis.
 *
 * Drop mp3s under `public/samples/<instrument>/<NOTE>.mp3` (e.g.
 * `public/samples/piano/C4.mp3`) or point NEXT_PUBLIC_SAMPLE_BASE_URL at a
 * CDN. Missing files never break playback — everything falls back to the
 * built-in synth. See public/samples/README.md for sources and layout.
 */

export type SampleInstrumentId =
  | "piano"
  | "electric-piano"
  | "organ"
  | "strings"
  | "synth"
  | "guitar-steel"
  | "guitar-nylon"
  | "bass"
  | "bass-pick";

/** Anchor notes to record / provide per instrument (nearest anchor is pitch-shifted). */
export const SAMPLE_ANCHORS: Record<SampleInstrumentId, string[]> = {
  piano: ["C1", "C2", "C3", "C4", "C5", "C6", "C7"],
  "electric-piano": ["C2", "C3", "C4", "C5", "C6"],
  organ: ["C2", "C3", "C4", "C5"],
  strings: ["C2", "C3", "C4", "C5"],
  synth: ["C2", "C3", "C4", "C5"],
  "guitar-steel": ["E2", "A2", "D3", "G3", "B3", "E4"],
  "guitar-nylon": ["E2", "A2", "D3", "G3", "B3", "E4"],
  bass: ["E1", "A1", "D2", "G2"],
  "bass-pick": ["E1", "A1", "D2", "G2"],
};

/** Long-release instruments (pads/keys) vs plucked/percussive ones. */
const SUSTAINED: ReadonlySet<SampleInstrumentId> = new Set([
  "organ",
  "strings",
  "synth",
  "electric-piano",
]);

export function sampleBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SAMPLE_BASE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  return "/samples";
}

export function anchorToMidi(anchor: string): number {
  const match = anchor.match(/^([A-G]#?)(-?\d+)$/);
  if (!match) return -1;
  const [, pitch, octaveStr] = match;
  const index = CHROMATIC.indexOf(pitch as (typeof CHROMATIC)[number]);
  if (index === -1) return -1;
  return index + (Number(octaveStr) + 1) * 12;
}

export function midiToAnchorName(midi: number): string {
  const clamped = Math.max(0, Math.min(127, Math.round(midi)));
  const pitch = CHROMATIC[clamped % 12];
  const octave = Math.floor(clamped / 12) - 1;
  return `${pitch}${octave}`;
}

export function nearestAnchor(instrument: SampleInstrumentId, midi: number): { anchor: string; anchorMidi: number } {
  const anchors = SAMPLE_ANCHORS[instrument];
  let best = anchors[0];
  let bestMidi = anchorToMidi(best);
  let bestDist = Math.abs(midi - bestMidi);
  for (const anchor of anchors.slice(1)) {
    const midiValue = anchorToMidi(anchor);
    const dist = Math.abs(midi - midiValue);
    if (dist < bestDist) {
      best = anchor;
      bestMidi = midiValue;
      bestDist = dist;
    }
  }
  return { anchor: best, anchorMidi: bestMidi };
}

export function sampleUrl(instrument: SampleInstrumentId, anchor: string): string {
  return `${sampleBaseUrl()}/${instrument}/${anchor}.mp3`;
}

const bufferCache = new WeakMap<AudioContext, Map<string, AudioBuffer>>();
const inflight = new WeakMap<AudioContext, Map<string, Promise<AudioBuffer | null>>>();

function cacheFor(ctx: AudioContext): Map<string, AudioBuffer> {
  let map = bufferCache.get(ctx);
  if (!map) {
    map = new Map();
    bufferCache.set(ctx, map);
  }
  return map;
}

async function loadAnchor(ctx: AudioContext, instrument: SampleInstrumentId, anchor: string): Promise<AudioBuffer | null> {
  const key = `${instrument}/${anchor}`;
  const cached = cacheFor(ctx).get(key);
  if (cached) return cached;

  let pending = inflight.get(ctx)?.get(key);
  if (!pending) {
    pending = (async () => {
      try {
        const response = await fetch(sampleUrl(instrument, anchor), { cache: "force-cache" });
        if (!response.ok) return null;
        const data = await response.arrayBuffer();
        const buffer = await ctx.decodeAudioData(data);
        cacheFor(ctx).set(key, buffer);
        return buffer;
      } catch {
        return null;
      } finally {
        inflight.get(ctx)?.delete(key);
      }
    })();
    let map = inflight.get(ctx);
    if (!map) {
      map = new Map();
      inflight.set(ctx, map);
    }
    map.set(key, pending);
  }
  return pending;
}

/** Fetch + decode every anchor for an instrument. Resolves false if any are missing. */
export async function preloadInstrument(ctx: AudioContext, instrument: SampleInstrumentId): Promise<boolean> {
  const results = await Promise.all(
    SAMPLE_ANCHORS[instrument].map((anchor) => loadAnchor(ctx, instrument, anchor)),
  );
  return results.every(Boolean);
}

export function isInstrumentReady(ctx: AudioContext, instrument: SampleInstrumentId): boolean {
  return SAMPLE_ANCHORS[instrument].every((anchor) => cacheFor(ctx).has(`${instrument}/${anchor}`));
}

export type SampledNoteOptions = {
  when?: number;
  /** 0..1 */
  velocity?: number;
  /** Seconds the note should ring (sustained instruments hold + release). */
  duration?: number;
};

/**
 * Play a sampled note. Returns false when samples are not loaded —
 * the caller must then play its synthesized fallback.
 */
export function playSampledNote(
  ctx: AudioContext,
  destination: AudioNode,
  instrument: SampleInstrumentId,
  midi: number,
  options: SampledNoteOptions = {},
): boolean {
  const when = options.when ?? ctx.currentTime;
  const velocity = Math.max(0, Math.min(1, options.velocity ?? 0.8));
  const duration = Math.max(0.1, options.duration ?? 1.5);

  const { anchor, anchorMidi } = nearestAnchor(instrument, midi);
  const buffer = cacheFor(ctx).get(`${instrument}/${anchor}`);
  if (!buffer) return false;

  const rate = Math.max(0.25, Math.min(4, 2 ** ((midi - anchorMidi) / 12)));
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.playbackRate.setValueAtTime(rate, when);

  const sustained = SUSTAINED.has(instrument);
  const peak = 0.04 + velocity * 0.3;
  const ring = sustained ? duration + 0.6 : Math.min(duration + 0.4, 3.5);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, when);
  gain.gain.linearRampToValueAtTime(peak, when + (sustained ? 0.06 : 0.004));
  gain.gain.exponentialRampToValueAtTime(0.001, when + ring);

  source.connect(gain);
  gain.connect(destination);
  source.start(when);
  source.stop(when + ring + 0.1);
  return true;
}
