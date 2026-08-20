# Music Tool — Full Product Implementation Plan (Lyrics Library, DAW, Tab Studio, Musician Helpers, Theory Lab, Progressions)

**Date:** 2026-08-08
**Status:** Research complete — plan ready for review

---

## 0. Access Control Change (already implemented)

**Requirement:** `b.pdrn.rdz@gmail.com` gets access to Prompt Library and Song Studio; default registered users do not.

**What changed:**
- `src/lib/access.ts` — added `ALL_ACCESS_PAGE_MAP` (every page `true`).
- `src/lib/auth.ts` — admins (the bootstrap admin email) now resolve to `ALL_ACCESS_PAGE_MAP` in both `getUserPageAccessMap()` and `listRegisteredUsersWithAccess()`. Non-admin users keep the default map where `song-studio` and `prompt-library` are `false`.

**Resulting matrix:**

| Page | b.pdrn.rdz@gmail.com (admin) | Default registered user |
|---|---|---|
| Prompt Library | ✅ | ❌ |
| Song Studio | ✅ | ❌ |
| Lyrics Library | ✅ | ✅ |
| DAW | ✅ | ✅ |
| Tab Studio | ✅ | ✅ |
| Musician Helpers | ✅ | ✅ |
| Theory Lab | ✅ | ✅ |
| Progressions | ✅ | ✅ |

---

## 1. Lyrics Library

**Current state** (`src/components/music/lyrics-library-client.tsx`):
- Song list from DB (no filters).
- Read-only lyrics + structure textareas.
- Two hard-coded guitar partiture slots with edit/save/delete against `song_partitures`.

**Gaps vs. migration spec** (docs/specs/2026-06-03-music-tool-migration.md):
- ❌ Filter by title, genre, language, emotion (spec requires it).
- ❌ Room for more than two partitures / other instruments (schema supports it, UI is hard-coded to guitar slots 1–2).
- ❌ Edit lyrics/structure in place (currently read-only).
- ❌ No print/export of lyrics + partitures.

**Enhancement plan:**

| # | Feature | Effort | Priority |
|---|---|---|---|
| L1 | Add filter bar (title, genre, language, emotion) backed by `?search=` + new server query params | S | High |
| L2 | Dynamic partiture slots: add/remove instruments (guitar, bass, drums, keys) beyond the default two guitar slots | M | High |
| L3 | Make lyrics & structure editable with a Save action (reuse `updateSong`) | S | High |
| L4 | Print/export view combining lyrics + structure + partitures (ASCII tab / PDF-friendly layout) | M | Medium |
| L5 | Per-song deep-link to Song Studio for full editing | S | Medium |
| L6 | Partiture slot drag-reorder | M | Low |

---

## 2. DAW (Web DAW Lab)

**Current state** (`src/components/music/daw-client.tsx`):
- Browser-local asset import (audio/midi/project/other).
- Asset library list with remove.
- Add audio/MIDI tracks, mute/solo toggles.
- Fake transport: timer-based playhead, no real audio decoding/playback.
- Gain/pan exist in state but have **no UI controls**.
- `Download` icon imported but **no export handler wired**.

**Gaps vs. spec:**
- ❌ Export manifest, session JSON (spec requires it).
- ❌ Real audio playback of imported audio/MIDI files.
- ❌ Mixer controls (gain, pan) not exposed in UI.
- ❌ No persistence (localStorage or backend) for sessions.
- ❌ No timeline region editing (fixed 400px regions).
- ❌ No MIDI note preview/editing.

**Enhancement plan:**

| # | Feature | Effort | Priority |
|---|---|---|---|
| D1 | Wire `downloadBlob()` export for session manifest JSON (layers, asset refs, gain/pan/mute/solo) | S | High |
| D2 | Real Web Audio playback: decode audio assets via `AudioContext.decodeAudioData`, play/stop/pause with playhead sync | M | High |
| D3 | Mixer strip per track: gain slider, pan slider, mute/solo buttons wired to `AudioNode` graph | M | High |
| D4 | Persist sessions to `localStorage` (auto-save + load list) | S | Medium |
| D5 | Timeline region drag/resize (start bar, length bars) | M | Medium |
| D6 | MIDI asset → note clip visual preview + simple piano-roll edit | L | Medium |
| D7 | Effects chain per track (delay, reverb via Web Audio convolver, compressor) toggles | L | Low |

---

## 3. Tab Studio

**Current state** (`src/components/music/tab-studio-client.tsx`):
- MIDI import → fret grid (fixed 64 steps, naive string/fret mapping).
- Text-tab import is only a toast stub.
- 4 instruments (Steel, Nylon, Bass, Overdrive) with synthesized pluck sounds + overdrive curves.
- 16-cell grid editing, BPM, playback with playhead.
- `files` state and `Download` icon exist but are **not persisted or exported**.

**Gaps vs. spec:**
- ❌ Export tab text + MIDI score metadata (spec requires it).
- ❌ `files` import list is transient only.
- ❌ Granularity: no measures, no time signature, no tempo math in import.
- ❌ No integration with `song_partitures` (Lyrics Library).
- ❌ `.gp5` binary format rejected (accepted per non-goal, but a `.gp5 → text` guide is missing).

**Enhancement plan:**

| # | Feature | Effort | Priority |
|---|---|---|---|
| T1 | Export current fret grid as ASCII tab text via `downloadBlob()` | S | High |
| T2 | Save fret grid as a partiture (reuse `createPartiture`/`updatePartiture` with `instrument`, `slot`) so tabs appear in Lyrics Library | M | High |
| T3 | Measure-based grid: bar count control, time signature, rebar; import tempo/time from MIDI header | M | High |
| T4 | Multi-track support (add bass/other instrument rows in parallel) | M | Medium |
| T5 | Markers/annotations (chorus, verse) stored per cell range | M | Medium |
| T6 | Chord diagram mini-palette insertable at cells | L | Low |
| T7 | Improved MIDI→fret mapping (MuseScore-style string placement with fret ≤ 15 preference) | M | Medium |

---

## 4. Musician Helpers

**Current state** (`src/components/music/helpers-client.tsx`):
- Pro metronome: BPM slider (40–240), start/stop click via Web Audio.
- Intelligent tuner: mic visualizer (frequency spectrum bars) + reference pitch playback (6 pitches). **No actual pitch detection.**

**Gaps:**
- ❌ Tuner does not detect the played note/frequency (no autocorrelation / zero-crossing analysis).
- ❌ No beat subdivision, accents, or time-signature metronome.
- ❌ No drum patterns / practice partner.

**Enhancement plan:**

| # | Feature | Effort | Priority |
|---|---|---|---|
| M1 | Real pitch detection: autocorrelation on mic buffer via `AnalyserNode`/`ScriptProcessor` or AudioWorklet; display detected note + cents deviation + tuning needle | M | High |
| M2 | Metronome time signatures (2/4, 3/4, 4/4, 6/8) + accent on beat 1 + subdivision (8ths/16ths) | S | High |
| M3 | Tap tempo input synced to the metronome | S | Medium |
| M4 | Drum machine: 16-step pattern grid (kick, snare, hats) playing through Web Audio synthesis, BPM-linked | M | Medium |
| M5 | Chord dictionary MVP: chord → note list + basic diagram renderer | M | Low |
| M6 | Transposition wheel / transpose calculator for practice across keys | S | Low |

---

## 5. Theory Lab

**Current state** (`src/components/music/theory-lab-client.tsx`):
- Scale explorer (Major/Minor + 6 modes).
- Chord constructor (7 triad/7th qualities).
- Interactive `PianoKeyboard` highlight (scale/chord mode) + note/arpeggio playback.
- Labeled "Inversion Ready" but **no inversion UI**.

**Gaps:**
- ❌ No inversions despite the label.
- ❌ No circle of fifths.
- ❌ No interval trainer.
- ❌ No key signatures / note spelling (uses naive 12-TET names only).
- ❌ Shared `root` state between scale and chord panels — picking a root in one changes the other (UX bug).
- ❌ No Roman numeral contextual analysis.

**Enhancement plan:**

| # | Feature | Effort | Priority |
|---|---|---|---|
| TH1 | Inversions 0/1/2/3 per chord with correct bass note highlight + playback | S | High |
| TH2 | Decouple `root`/`scaleType` and `root`/`chordType` state per panel (fix shared-root bug) | S | High |
| TH3 | Circle of fifths interactive wheel (major/minor keys, relative keys) | M | High |
| TH4 | Interval trainer: quiz mode (play interval, guess name) with score | M | Medium |
| TH5 | Expand scales: pentatonic, blues, harmonic minor, melodic minor; more chords: 9/11/13, add9, 6, sus2 | S | Medium |
| TH6 | Key signature + note-spelling-aware labels (F♯ vs G♭) with togglable enharmonic preference | M | Medium |
| TH7 | Roman numeral + function (T/S/D) annotation for the selected chord in a key | M | Medium |
| TH8 | "Send chord to Progressions" action (copy current chord into the progression builder) | S | Low |

---

## 6. Progressions

**Current state** (`src/components/music/progression-client.tsx`):
- Chord sequence builder: add/remove/play chords, 7 qualities.
- Piano keyboard preview (tap sets root + plays chord).
- Smart suggestion card (dominant/subdominant quick-add).
- Voice-leading card is **"Coming Soon"**; no Roman numeral analysis implemented.

**Gaps:**
- ❌ No Roman numeral / functional analysis.
- ❌ No save/export of progressions.
- ❌ No tempo control for sequence playback (hard-coded 1s per chord).
- ❌ No key selection (suggestions don't know the key).
- ❌ Voice leading unimplemented.

**Enhancement plan:**

| # | Feature | Effort | Priority |
|---|---|---|---|
| P1 | Key selector + Roman numeral + function (T/S/D) analysis rendered under each chord | M | High |
| P2 | Playback tempo control (BPM slider) with 8th/16th strum patterns | S | High |
| P3 | Save/export progression as JSON (`downloadBlob`) + "save as song section" option into a selected song | M | High |
| P4 | Voice leading engine: choose nearest inversion between consecutive chords (minimal semitone movement) and preview | L | Medium |
| P5 | Common progression presets: I–IV–V, ii–V–I, vi–IV–I–V, 12-bar blues, doo-wop | S | Medium |
| P6 | Swing/straight rhythm toggle for playback | S | Low |
| P7 | Preview tempo-synced with the Musician Helpers metronome BPM | S | Low |

---

## 7. Shared / Cross-cutting Enhancements

| # | Feature | Tools affected | Priority |
|---|---|---|---|
| X1 | Sync a shared BPM/transport store (React context) so DAW, Tab Studio, Metronome and Progressions stay in tempo | DAW, Tab, Helpers, Progressions | Medium |
| X2 | Unify audio-engine helpers (pluck synth, master gain, scheduling) into `src/lib/music/audio-engine.ts` | Tab, Helpers, Theory, Progressions | High (refactor) |
| X3 | Backend persistence for DAW sessions & saved progressions (new tables or JSON fields on `songs`) | DAW, Progressions | Medium |
| X4 | Keyboard accessibility + ARIA labels pass across all canvas/visual UIs | All | Medium |

---

## 8. Suggested Sequencing

**Phase 1 — Stabilize & export (quick wins, ~1 sprint)**
- L1, L3, D1, D3, T1, T2, M1, M2, TH1, TH2, P2

**Phase 2 — Core creative flow (1–2 sprints)**
- L2, L4, T3, T7, M3, M4, TH3, TH5, P1, P3

**Phase 3 — Advanced features (2+ sprints)**
- D2, D4, T4, T5, TH4, TH6, P4, P6, X1–X4

**Phase 4 — Polish**
- D5, D6, D7, L6, M5, M6, TH7, TH8, P5, P7

---

## 9. Related Bug Found During Research

**`src/components/music/templates-client.tsx`** (Prompt Library):
- `TemplateDraft` type lacks `targetType`/`targetField`/`targetKinds`, but the Edit handler sets those fields (line ~154) — TypeScript error and lost metadata on save. When implementing Prompt Library enhancements (or before), the draft type + `persistTemplate` payload should include `targetType`, `targetField`, and `targetKinds` so editing existing templates round-trips correctly.