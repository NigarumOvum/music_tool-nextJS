# Realistic instrument samples

The app plays **real recordings** whenever sample files are present, and
automatically falls back to synthesis (Karplus-Strong strings, classic
oscillators) when they are missing. Nothing breaks with an empty folder.

## Folder layout

```
public/samples/<instrument>/<NOTE>.mp3
```

| Instrument folder | Anchor notes to provide |
|---|---|
| `piano` | C1 C2 C3 C4 C5 C6 C7 |
| `electric-piano` | C2 C3 C4 C5 C6 |
| `organ` | C2 C3 C4 C5 |
| `strings` | C2 C3 C4 C5 |
| `synth` | C2 C3 C4 C5 |
| `guitar-steel` | E2 A2 D3 G3 B3 E4 |
| `guitar-nylon` | E2 A2 D3 G3 B3 E4 |
| `bass` | E1 A1 D2 G2 |
| `bass-pick` | E1 A1 D2 G2 |

Notes between anchors are pitch-shifted from the nearest anchor, so one
sample per anchor is enough. Prefer dry, normalized recordings ~2–4 s long.

## Free sources

- **Salamander Grand Piano** (Alexander Holm, CC-BY) — `C1..C8` mp3/ogg,
  perfect for `piano/`.
- **FluidR3_GM / GeneralUser GS** (SoundFont) — render any GM program
  (nylon guitar, fingered bass, strings, organ, e-piano) with
  [Polyphone](https://www.polyphone.io/) or
  `fluidsynth -F out.wav soundfont.sf2 midifile.mid`.
- **VS Chambers / Philharmonia** — free single-note orchestral samples.
- **Tone.js audio CDN** — quick start without hosting files yourself
  (needs internet; breaks offline PWA).

Convert with ffmpeg, one file per note:

```bash
ffmpeg -i C4.wav -b:a 128k -ar 44100 public/samples/piano/C4.mp3
```

## CDN instead of local files

Set the base URL (no trailing slash) and skip `public/samples` entirely:

```bash
NEXT_PUBLIC_SAMPLE_BASE_URL=https://cdn.example.com/my-samples
```

## How it works in code

- `src/lib/music/sample-engine.ts` — lazy fetch + decode cache (per
  `AudioContext`), nearest-anchor pitch shifting, velocity envelopes.
- `preloadVoice()` / `preloadPluck()` are called when the user picks a
  voice; playback functions (`playKeyboardNote`, `playReferencePluck`,
  tab grid) play the sample when cached, otherwise synthesize.
- Drum one-shots and DAW per-layer voices are the planned next step:
  the engine already exposes everything they need.
