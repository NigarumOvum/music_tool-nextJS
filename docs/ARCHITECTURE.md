# BandsChamber Studio — Architecture

## 1. Stack & runtime

- **Next.js 16** (App Router, React 19), TypeScript, Tailwind CSS v4
- **Auth + app data**: single shared **Turso/libSQL** database
  (`MUSIC_TURSO_DATABASE_URL` / `MUSIC_TURSO_AUTH_TOKEN`)
- **UI**: HeroUI components, Framer Motion, lucide-react icons, `sonner` toasts
- **Audio**: raw Web Audio (synth voices, Karplus-Strong plucks, metronome,
  MIDI scheduler) + optional real-sample engine (`src/lib/music/sample-engine.ts`,
  files under `public/samples/`, CDN via `NEXT_PUBLIC_SAMPLE_BASE_URL`)
- **AI prompts**: local Ollama (`OLLAMA_BASE_URL`, default `llama3.1:8b`)
- **Email**: Resend (`src/lib/email.ts`) with fallback-URL surfacing when paused
- **PWA**: `@ducanh2912/next-pwa` (disabled in dev), manifest shortcuts,
  offline pill, install prompt
- **Tests**: Vitest, pure music-theory/sample libs only (`*.test.ts`)

No `middleware.ts` — auth and access are enforced **per page and per API
route**. Any new route must do the same (see §5).

## 2. Hubs & routes

| Route | What renders | Gate |
|---|---|---|
| `/` | Music Toolkit hub (Harmony / Progressions / Tuner tabs, lazy `dynamic(ssr:false)`) | login; **free Harmony fallback** when zero tabs granted |
| `/music-toolkit`, `/theory-lab`, `/progressions`, `/musician-helpers` | Redirect aliases to `/?tab=…` | login |
| `/production-studio?tab=notation\|audio\|lyrics` (+ `song`) | Studio hub shell + song catalog + studio modal | login + ≥1 studio tab |
| `/tab-studio`, `/daw`, `/lyrics-library`, `/song-studio` | Redirect aliases to `/production-studio?tab=…` | login |
| `/prompt-library` | Prompt templates + runner | login + `prompt-library` pageKey |
| `/membership` | Plans, PayPal checkout, history | login |
| `/account` | Profile, security, membership, access (admin tab) | login |
| `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email` | Auth flows | logged-in users redirect to `/` |

## 3. Data model (one Turso DB, tables auto-created + `ensureColumn` migrations)

**Auth** (`src/lib/auth.ts`): `app_user` (scrypt hash, `is_admin`, `email_verified_at`),
`app_session` (30-day, `httpOnly` cookie `music_tool_session`), `app_email_token`
(confirmation 24 h / reset 30 min, sha256, single-use), `app_page_access`
(`(user_id, page_key)`), `app_email_change` (pending new-email confirmations).

**Music** (`src/lib/music/db.ts`): `songs` (+ `user_id`, `project_slug`, full
metadata), `song_sections` / `song_layers` (name/text/JSON per song),
`song_partitures` (instrument × slot × format), `music_task_template`
(prompt templates), `projects` + `project_members` (owner/editor/viewer).

**Membership** (`src/lib/membership.ts`): `membership_plans` (seeded Free /
Pro $9.99 mo / Lifetime $149), `membership_subscriptions`
(pending/active/cancelled/expired/past_due), `membership_payments`
(created/captured/failed/refunded).

## 4. Roles & access

- `is_admin` flag **or** bootstrap email (`BOOTSTRAP_ADMIN_EMAILS`) ⇒ admin
  (full page map, immutable in UI).
- 9 manageable page keys in `src/lib/access.ts`, grouped into Production
  Studio / Music Toolkit / Prompt Library hubs (`HUB_ACCESS_GROUPS`).
- Toolkit tabs map to pageKeys: harmony→`theory-lab`, progressions→`progressions`,
  tuner→`musician-helpers`; Studio tabs: notation→`tab-studio`, audio→`daw`,
  lyrics→`lyrics-library` (+ song editor).
- Server: `requireCurrentUser()` → `/login`; `AppShell({pageKey})` → denied
  redirect; API: `requireApiUser` (401) / `requireAdminApiUser` (403).
- Known scoping quirk (see REQUIREMENTS NFR/security notes): any song with a
  non-empty `project_slug` is readable by every logged-in user; comments live
  only in per-user localStorage.

## 5. Key flows

- **Register → verify → login**: 8-char min, duplicate reject → token email
  (or fallback URL) → verified gate at login → 30-day session.
- **Password/email self-service**: logged-in change (current-password gated,
  rotates other sessions); email change confirms via link to the **new**
  address (`/account?email-change=`); logged-out change via email + current
  password (`/api/auth/change-password`).
- **Songs**: catalog (owned + project-shared) → detail → sections/layers/
  partitures → modal tabs (lyrics / DAW / notation) → band assignment.
- **DAW**: MIDI import → layers (gain/pan/mute/solo) → tempo-ratio playback →
  note edit/quantize → JSON manifest export.
- **Tabs**: fretboard grid ⇄ ASCII (`gridToAscii`/`parseAsciiTab`) ⇄ song
  partitures; step playback with loop/playhead.
- **Prompts**: template (song-field or part-scoped) → run on song via Ollama →
  preview → optional apply to the song field.
- **Membership**: free select (instant) → one-time order/capture → subscription
  create/poll/cancel → webhook fetch-back sync → history.
- **Client persistence**: `usePersistentState` — first paint from legacy key,
  then per-user `mt:<userId>:<key>` with debounced writes
  (`src/lib/persist.ts`); drafts for tabs/lyrics/songs with restore banners.
- **i18n**: typed 5-locale dictionaries (`en/es/de/fr/ru`, English fallback),
  `LanguageProvider` persisted per user, `<html lang>` switch
  (`src/lib/i18n/*`).

## 6. Repo map (where things live)

- `src/app/` — pages + `api/` route handlers (auth, account, music, membership)
- `src/components/music/` — feature clients (toolkit, studio, daw, tabs…)
- `src/components/{auth,account,membership,pwa,ui}/` — cross-cutting UI
- `src/lib/` — `auth.ts`, `access.ts`, `hub-access.ts`, `api.ts`,
  `music/*` (domain libs), `i18n/*`, `persist.ts`, `membership*.ts`
- `src/hooks/use-pwa.ts`, `public/manifest.webmanifest`, `public/sw.js`
- `scripts/add-user.mjs`, `scripts/set-password.mjs` — admin DB ops
- `docs/` — this documentation (source of truth for behavior)
