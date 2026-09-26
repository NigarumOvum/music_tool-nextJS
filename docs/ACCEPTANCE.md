# BandsChamber Studio — Acceptance Criteria & MVP

## Acceptance criteria per area

- **Toolkit**: fresh login with zero grants sees Harmony + free banner;
  metronome/tuner/theory/progressions/piano (+QWERTY/MIDI) all sound and
  persist prefs across reload. (FR-012, FR-014–FR-019)
- **Studio**: create song → edit lyrics/metadata/sections/layers/partitures
  → filters find it → modal tabs open → DAW import/play/export → grid↔ASCII
  round-trip → band assign → collaborator sees the shared song.
  (FR-020–FR-028)
- **Prompts**: create template → run on song via Ollama → preview output →
  apply writes the correct field; denied without both page grants.
  (FR-029–FR-030)
- **Membership**: free select works with PayPal unconfigured; with sandbox
  creds, lifetime order + monthly subscription + cancel + history reconcile;
  webhook updates survive restart. (FR-031–FR-036)
- **Account/Auth**: full register → verify → login → forgot → reset →
  change-password → change-email → logout cycle passes; admin toggles
  propagate within a refresh; denied links land on `/account?denied=`.
  (FR-001–FR-011)
- **PWA/i18n**: installable from a production build; offline reload shows
  pill + shell; locale switch translates chrome + music strings and persists
  per user; footer links/CTAs resolve. (FR-037–FR-040)

## MVP definition (agreed)

**MVP = all currently implemented features, monetization free-first.**

MVP is done when every FR-001–FR-040 passes with:

1. PayPal **sandbox or unconfigured** (paid buttons degrade gracefully to
   "not configured"); live payments are Phase 2.
2. Ollama **optional** — prompt-run failure must never break song CRUD.
3. Production-build PWA installable; 5-locale chrome complete; no
   console-blocking errors; per-user drafts intact across sessions.

## Phase 2 (explicitly out of MVP)

Live PayPal verification + webhook signature hardening + plan-gating
enforcement (plans display but don't gate features yet); shared (DB-backed)
comments; DAW audio recording; rhyme suggestions; API/DB/e2e test coverage;
central auth middleware; collaborator-endpoint scoping; song-visibility
tightening; accessibility audit.
