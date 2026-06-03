# Music Tool Migration Spec

## Summary

Create a standalone music production application in `Music-tool` using React, Tailwind CSS, and HeroUI.

The app replaces the music production surface currently embedded in `devtools` and expands it into a clearer multi-page experience with a dashboard home page.

## Goals

- Move the music production UI, server logic, and music-specific data access out of `devtools` and into `Music-tool`.
- Require authentication for the full application surface.
- Add register and login pages for end users.
- Preserve the existing core capabilities:
  - song library browsing
  - song detail editing
  - song sections and layers editing
  - AI generation and enhancement
  - snapshot creation and restore
  - task templates
  - Web DAW asset and layer workflows
  - Tab Studio intake and browser editing
- Introduce a new home page with cards that route to the major tools.
- Add a dedicated lyrics library workflow that supports storing multiple partitures per song, with the primary use case being two guitars.
- Point the app at the provided Turso database configuration via environment variables.

## Non-Goals

- Rebuild the entire `devtools` auth system.
- Add full DAW timeline editing or audio rendering.
- Parse proprietary Guitar Pro binary formats on the server in this iteration.

## Product Surfaces

### Home

Route: `/`

Access: authenticated only

The home page must present a card-based dashboard with links to:

- Prompt Library
- Lyrics Library
- Song Studio
- AI Studio
- Web DAW Lab
- Guitar Pro Like App
- Snapshots
- Templates

### Lyrics Library

Route: `/lyrics-library`

Access: authenticated only

Capabilities:

- list songs from the music database
- filter songs by title, genre, language, and emotion
- inspect lyrics and structure
- attach multiple partitures to each song
- support at least two guitar partitures per song in the UI model
- preserve room for additional instruments later

### Song Studio

Route: `/song-studio`

Access: authenticated only

Capabilities:

- browse song summaries
- inspect a selected song in detail
- edit song metadata and JSON fields
- edit sections and layers
- save and delete parts

### AI Studio

Route: `/ai-studio`

Access: authenticated only

Capabilities:

- generate structured song drafts
- preview field enhancements
- preview section and layer enhancements
- apply accepted AI changes to the selected song

### Web DAW Lab

Route: `/daw`

Access: authenticated only

Capabilities:

- import browser-local audio, MIDI, and JSON assets
- manage asset library selections
- create and reorder DAW layers
- assign assets, gain, pan, mute, solo, and arm states
- export manifest, selected package metadata, and session JSON

### Guitar Pro Like App

Route: `/tab-studio`

Access: authenticated only

Capabilities:

- import supported notation and tab files
- inspect extracted metadata and previews
- edit a structured fret grid
- preview browser playback
- export tab text and MIDI score metadata

### Snapshots

Route: `/snapshots`

Access: authenticated only

Capabilities:

- list snapshots for the current song
- create manual snapshots
- restore a snapshot

### Templates

Route: `/templates`

Access: authenticated only

Capabilities:

- list music task templates
- create templates
- edit templates
- delete templates

### Login

Route: `/login`

Capabilities:

- email and password login
- redirect authenticated users into the app

### Register

Route: `/register`

Capabilities:

- create a user account with email, name, and password
- create an authenticated session after registration

## Architecture

- Framework: Next.js App Router with TypeScript
- UI: React client components, Tailwind CSS, HeroUI
- Notifications: Sonner
- Icons: Lucide React
- Animation: Framer Motion where needed
- Data access: server-side LibSQL/Turso client
- API: Next.js route handlers under `src/app/api`
- Auth: custom cookie session auth backed by Turso tables

## Data Model

### Existing tables to preserve

- `songs`
- `song_sections`
- `song_layers`

Ownership note:

- `songs` must now be scoped by authenticated user via `user_id`
- `song_sections` and `song_layers` remain linked through the owned parent song
- `music_song_snapshot`
- `music_task_template`

### New table required

`app_user`

Columns:

- `id` text primary key
- `email` text unique not null
- `name` text null
- `password_hash` text not null
- `created_at` text not null
- `updated_at` text not null

`app_session`

Columns:

- `id` text primary key
- `user_id` text not null
- `expires_at` text not null
- `created_at` text not null

### New table required

`song_partitures`

Columns:

- `id` text primary key
- `song_id` text not null
- `instrument` text not null
- `slot` integer not null
- `user_id` text not null
- `title` text not null
- `content` text not null
- `format` text null
- `created_at` text not null
- `updated_at` text not null

Rules:

- each song can have multiple partitures
- the UI must default to showing two guitar slots
- the schema must allow more than two entries for future instruments

### User scoping rules

- `songs` records must be scoped by authenticated user
- `song_sections` and `song_layers` access must be gated by the owning song record
- `music_song_snapshot` records must be scoped by authenticated user
- `music_task_template` records must be scoped by authenticated user
- `song_partitures` records must be scoped by authenticated user
- protected routes and music APIs must reject unauthenticated access
- route entry must be rejected early through Next.js proxy checks, with DB validation still enforced inside auth-aware server code

## API Contracts

- `GET /api/music/songs`
- `POST /api/music/songs`
- `GET /api/music/songs/:id`
- `PATCH /api/music/songs/:id`
- `POST /api/music/songs/:id/parts`
- `DELETE /api/music/songs/:id/parts`
- `GET /api/music/songs/:id/snapshots`
- `POST /api/music/songs/:id/snapshots`
- `POST /api/music/snapshots/:snapshotId/restore`
- `GET /api/music/templates`
- `POST /api/music/templates`
- `PATCH /api/music/templates/:id`
- `DELETE /api/music/templates/:id`
- `POST /api/music/ai/generate`
- `POST /api/music/ai/enhance`
- `GET /api/music/songs/:id/partitures`
- `POST /api/music/songs/:id/partitures`
- `PATCH /api/music/partitures/:id`
- `DELETE /api/music/partitures/:id`
- `POST /api/auth/login`
- `POST /api/auth/register`
- `POST /api/auth/logout`
- `GET /api/auth/session`

## Environment

Required environment variables:

- `MUSIC_TURSO_DATABASE_URL`
- `MUSIC_TURSO_AUTH_TOKEN`
- `OLLAMA_BASE_URL`
- `OLLAMA_MODEL`
- `AUTH_SESSION_SECRET`

## UX Direction

- Replace the old single-screen workspace with route-level tools and a stronger dashboard information scent.
- Keep dense editing surfaces where needed, but use card summaries and sectional navigation on entry routes.
- Use a warm studio-inspired palette and avoid generic white-card defaults.

## Acceptance Criteria

1. `Music-tool` runs as a standalone React application with Tailwind and HeroUI.
2. Unauthenticated users are redirected to login for protected routes.
3. Users can register, log in, and log out.
4. The home page exposes cards for every major music tool route.
5. Song browsing, detail loading, editing, and saving work against the Turso database.
6. Snapshot creation and restore work from the new app.
7. Template CRUD works from the new app.
8. AI generation and enhancement endpoints are reachable from the new app.
9. Lyrics Library supports viewing and editing at least two guitar partitures per song.
10. Web DAW Lab and Tab Studio are available as standalone routes.
11. User-owned records are scoped to the authenticated user, including the song catalog.
12. The project builds successfully.

## Validation Plan

- scaffold and build the app before migration
- build after server migration
- build after UI migration
- manually verify home navigation and feature routes