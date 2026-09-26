# BandsChamber Studio — Requirements

> Numbered, testable requirements derived from the implemented code.
> `FR-*` = functional, `NFR-*` = non-functional. MVP = all of these,
> monetization **free-first** (PayPal present, live payments = Phase 2).

## Functional requirements

### Auth & account
- FR-001 Register rejects invalid email, `<8`-char passwords, and duplicate
  email; creates an unverified user and sends confirmation (or returns a
  fallback URL when delivery is paused).
- FR-002 Login fails generically on bad credentials and blocks unverified
  email with a confirm-email message.
- FR-003 Email-confirm tokens (24 h, single-use, hashed) verify the user;
  invalid/consumed/expired tokens error.
- FR-004 Password-reset requests are enumeration-safe; reset tokens (30 min,
  single-use) set a `≥8`-char password and revoke all sessions.
- FR-005 Logged-in password change requires the current password and rotates
  all other sessions while keeping the current one.
- FR-006 Email change requires the password, rejects same/taken addresses,
  and swaps the login email only after new-address confirmation.
- FR-007 Logged-out password change (login screen) requires email + current
  password and rotates all sessions.
- FR-008 Sessions expire after 30 days; logout deletes the server session and
  clears the cookie.
- FR-009 Admins list users (email/name/verified/admin + page map), rename
  non-admins, and set per-page access; admin rows are immutable in UI.
- FR-010 Bootstrap admin emails are always treated as admin.

### Access
- FR-011 Every page except auth requires login (`/login` redirect); gated
  pages redirect to `/account?denied=<key>` with an explanatory banner.
- FR-012 Root `/` always renders the Harmony tab for any logged-in user
  (free access + banner); disallowed `?tab=` normalizes to harmony.
- FR-013 Tab resolvers fall back to the first allowed tab for missing/invalid
  params; hub APIs reject unauthenticated (401) and non-admin (403) callers.

### Toolkit home
- FR-014 Metronome plays accented clicks per time signature (2/4–12/8),
  subdivision, voice, volume, and count-in; BPM/tap-tempo persist per user.
- FR-015 Tuner captures mic audio, shows detected pitch + cents offset, and
  plays reference plucks across guitar/bass presets.
- FR-016 Theory Lab renders ≥13 scales and ≥17 chord types with inversions
  and diatonic triads, and audibly plays scales/chords in the selected voice.
- FR-017 Piano responds to mouse, QWERTY rows (Z–M / Q–U, arrows shift
  octave), and WebMIDI note-on/off where supported.
- FR-018 Chord How-to-Play shows per-instrument voicing for the active chord
  from the shared 13-instrument catalog.
- FR-019 Progressions builder supports add/remove, preset load, transpose,
  Roman-numeral + function analysis, playback, and export.

### Production studio
- FR-020 Song catalog lists owned + project-shared songs with counts,
  search, genre/key/emotion/mood/project/instrument filters, and saved
  presets.
- FR-021 Song CRUD plus section/layer part upsert/delete persist and reload
  correctly.
- FR-022 Band CRUD (slug/color/shared flag/members) works; member songs
  appear in the catalog with accurate per-project counts.
- FR-023 Lyrics editor saves lyrics + structure per song, shows
  lines/words/syllables/est-duration, and restores per-user drafts.
- FR-024 Song Studio persists all metadata fields plus per-instrument
  partitures (auto slot, 5 formats) via API.
- FR-025 DAW imports MIDI (notes + BPM), maps tracks to layers, plays with
  gain/pan/mute/solo and tempo-ratio, edits/quantizes notes, and exports a
  JSON session manifest.
- FR-026 Tab Studio grid edits generate valid ASCII tab; ASCII paste parses
  back; tuning switches preserve string mapping; playback steps with
  loop + playhead jumps.
- FR-027 Studio modal opens any allowed tab for the selected song with
  split-view, pinned tabs, fullscreen, and exit-save confirmation.
- FR-028 Song comments create/delete per user in localStorage namespaced per
  user.

### Prompts
- FR-029 Templates validate (name, instructions, valid song-field or ≥1 part
  kind) and are strictly per-user.
- FR-030 Prompt runs require `prompt-library` + `song-studio` access, call
  Ollama, return `{output,targetLabel,applied}`, and apply writes only to the
  template's song-field.

### Membership & PayPal
- FR-031 Plans endpoint lists only active plans in order; config endpoint
  reports PayPal mode/configured state.
- FR-032 Free plan selection activates instantly; paid plans via `select`
  are rejected.
- FR-033 One-time checkout creates → captures the order, activates the
  subscription, and records payment idempotently by order id.
- FR-034 Recurring flow creates the billing plan once, creates a pending
  subscription, and status-poll transitions it to `active` with period dates.
- FR-035 Cancel marks the subscription `cancelled` even if remote PayPal
  cancel fails (warning logged).
- FR-036 Webhook fetch-back verification syncs subscription/payment states
  for captures, activations, cancellations, and payment failures.

### PWA, i18n, persistence, shell
- FR-037 App installs (native prompt + iOS guide), runs standalone from `/`,
  serves cached shell offline with a visible offline pill.
- FR-038 All UI chrome strings resolve in 5 locales with English fallback;
  locale persists per user.
- FR-039 Per-user `mt:<userId>:<key>` state migrates legacy keys once and
  stays namespaced across users on one browser.
- FR-040 Footer always shows tagline, PayPal note, Studio/Account links,
  © year, and Go Pro CTA.

## Non-functional requirements

- NFR-001 **Performance**: lazy tab loads (`dynamic(ssr:false)`); PWA
  precache + NetworkFirst/CacheFirst splits; localStorage writes debounced
  ~600 ms; no full-list pagination (acceptable at current scale).
- NFR-002 **Security**: scrypt + `timingSafeEqual`; hashed single-use email
  tokens; `httpOnly`/`SameSite=Lax`/prod-`Secure` cookies; parameterized
  queries; PayPal secret server-side only. Gaps to harden: rate-limiting,
  lockout, CSP headers, webhook signature verification.
- NFR-003 **Privacy**: per-user storage namespaces; song ownership + project
  scoping; email-change double opt-in. Known breadth: any non-empty
  `project_slug` song is readable by all logged-in users.
- NFR-004 **Reliability**: best-effort drafts (storage-full tolerated); PWA
  offline shell; tolerant PayPal cancel; email fallback links. Ollama is a
  hard local dependency with no queue/retry.
- NFR-005 **Accessibility**: semantic landmarks, labeled controls, modal
  patterns via HeroUI. Gaps: piano/fretboard/DAW-timeline ARIA roles and a
  contrast/keyboard audit.
- NFR-006 **i18n**: typed dictionary keys across 5 locales; server emails
  remain English-only (accepted).
- NFR-007 **Maintainability**: schema auto-migrate (`CREATE TABLE IF NOT
  EXISTS` + `ensureColumn`); typed domain libs; Vitest on pure libs.
  Gaps: no e2e, no API/DB tests, gating duplicated per route (no middleware).
