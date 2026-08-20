# music_tool-nextJS - Architecture Documentation

## 📋 Project Overview

**music_tool-nextJS** (code: `music-tool`) is a Next.js 16 music production platform that provides a comprehensive suite of music creation tools including Song Studio, DAW (Digital Audio Workstation), Tab Studio, Theory Lab, Progressions, Lyrics Library, and Prompt Library. It includes full authentication, email verification, and per-page access control.

**Version:** 0.1.0  
**Deployment:** Vercel

---

## 🏗️ High-Level Architecture

```mermaid
graph TD
    subgraph "User / Browser"
        USER[Musician / Producer]
    end

    subgraph "Next.js 16 App Router (RSC)"
        APP[App Router]
        PAGES[Pages<br/>Song Studio, DAW, Tab Studio,<br/>Theory Lab, Progressions,<br/>Lyrics Library, Prompt Library]
        COMPONENTS[Client Components<br/>music/, auth/, account/]
        RSC[Server Components]
    end

    subgraph "API Layer (Route Handlers)"
        MUSIC_API[MUSIC API<br/>songs, parts, partitures,<br/>templates]
        AUTH_API[AUTH API<br/>register, login, logout,<br/>session, verify, reset]
        ACCOUNT_API[ACCOUNT API<br/>access control]
    end

    subgraph "Core Libraries"
        AUTH[Auth Library<br/>scrypt, JWT, cookies]
        ACCESS[Access Control<br/>per-page management]
        MUSIC_LIB[Music Library<br/>client.ts, db.ts, midi-parser]
        OLLAMA[Ollama Integration<br/>local AI]
        EMAIL[Email Service<br/>Resend]
        API_LIB[API Client]
    end

    subgraph "Data & Persistence"
        TURSO[(Turso / LibSQL<br/>Music DB)]
        AUTH_DB[(Auth DB<br/>users, sessions,<br/>access control)]
    end

    subgraph "External Services"
        OLLAMA_API[Ollama Server<br/>Local LLM]
        RESEND_API[Resend<br/>Transactional Email]
    end

    USER --> APP
    APP --> PAGES
    PAGES --> RSC
    PAGES --> COMPONENTS
    RSC --> AUTH
    COMPONENTS --> MUSIC_LIB
    APP --> MUSIC_API
    APP --> AUTH_API
    APP --> ACCOUNT_API
    MUSIC_API --> MUSIC_LIB
    MUSIC_LIB --> TURSO
    AUTH_API --> AUTH
    AUTH --> AUTH_DB
    ACCOUNT_API --> ACCESS
    ACCESS --> AUTH
    MUSIC_LIB --> OLLAMA
    OLLAMA --> OLLAMA_API
    AUTH --> EMAIL
    EMAIL --> RESEND_API
```

---

## 🗂️ Directory Structure

```
music_tool-nextJS/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── page.tsx                  # Landing / home page
│   │   ├── song-studio/              # Song creation & editing
│   │   │   └── page.tsx
│   │   ├── daw/                      # Digital Audio Workstation
│   │   │   └── page.tsx
│   │   ├── tab-studio/               # Tablature editor
│   │   │   └── page.tsx
│   │   ├── theory-lab/               # Music theory learning
│   │   │   └── page.tsx
│   │   ├── progressions/             # Chord progressions
│   │   │   └── page.tsx
│   │   ├── lyrics-library/           # Lyrics management
│   │   │   └── page.tsx
│   │   ├── prompt-library/           # AI prompt templates
│   │   │   └── page.tsx
│   │   ├── musician-helpers/         # Assistant tools
│   │   │   └── page.tsx
│   │   ├── account/                  # User account
│   │   │   └── page.tsx
│   │   ├── login/                    # Auth pages
│   │   ├── register/
│   │   ├── forgot-password/
│   │   ├── reset-password/
│   │   ├── verify-email/
│   │   └── api/                      # Route Handlers
│   │       ├── music/
│   │       │   ├── songs/
│   │       │   │   ├── route.ts      # CRUD songs
│   │       │   │   ├── [id]/         # Single song
│   │       │   │   │   ├── parts/    # Song parts
│   │       │   │   │   └── partitures/ # Song notation
│   │       │   ├── partitures/[id]/  # Partiture management
│   │       │   └── templates/        # Task templates
│   │       ├── auth/                 # Auth endpoints
│   │       │   ├── register/
│   │       │   ├── login/
│   │       │   ├── logout/
│   │       │   ├── session/
│   │       │   ├── verify-email/
│   │       │   ├── resend-confirmation/
│   │       │   ├── forgot-password/
│   │       │   └── reset-password/
│   │       └── account/
│   │           └── access/           # Access control
│   ├── components/
│   │   ├── music/                    # Music tool clients
│   │   │   ├── song-studio-client.tsx
│   │   │   ├── daw-client.tsx
│   │   │   ├── tab-studio-client.tsx
│   │   │   ├── theory-lab-client.tsx
│   │   │   ├── lyrics-library-client.tsx
│   │   │   ├── progression-client.tsx
│   │   │   ├── templates-client.tsx
│   │   │   ├── helpers-client.tsx
│   │   │   ├── piano-keyboard.tsx
│   │   │   └── audio-provider.tsx
│   │   ├── auth/                      # Auth components
│   │   │   ├── auth-screen.tsx
│   │   │   ├── verify-email-client.tsx
│   │   │   ├── forgot-password-form.tsx
│   │   │   ├── reset-password-form.tsx
│   │   │   └── logout-button.tsx
│   │   ├── account/
│   │   │   └── account-client.tsx
│   │   ├── app-shell.tsx              # App layout shell
│   │   ├── dashboard-card.tsx
│   │   ├── theme-provider.tsx
│   │   ├── theme-toggle.tsx
│   │   └── providers.tsx
│   └── lib/
│       ├── music/
│       │   ├── types.ts               # Typed data models
│       │   ├── db.ts                  # Turso DB operations
│       │   ├── client.ts              # Music API client
│       │   ├── ollama.ts              # Ollama LLM integration
│       │   └── midi-parser.ts         # MIDI parsing utilities
│       ├── auth.ts                    # Auth core (scrypt, JWT, sessions)
│       ├── auth-constants.ts
│       ├── access.ts                  # Per-page access control
│       ├── api.ts                     # API helper
│       └── email.ts                   # Resend email service
├── scripts/
│   └── migrate-legacy-music-ownership.mjs
├── public/
├── next.config.ts
└── package.json
```

---

## 🎵 Music Data Model (Turso)

```mermaid
erDiagram
    songs ||--o{ parts : has_sections
    songs ||--o{ parts : has_layers
    songs ||--o{ partitures : notation
    songs {
        text id PK
        text title
        text topic
        text emotion
        text genre
        text language
        text reference_text
        text lyrics_text
        text song_json "Full song structure"
        text melody_json
        text midi_blueprints_json
        text production_json
        text metadata_json
        int bpm
        text musical_key
        text structure_text
        text hook_summary
        text vocal_style
        text instrumentation
        text mood_tags_json
        text project_slug
        text project_dir
        int has_arrangement_midi
        int arrangement_midi_bytes
        text arrangement_midi_sha256
        text enhanced_from_song_id
        text enhanced_from_title
        text backup_run_id
        text synced_at
    }
    parts {
        text name "section or layer"
        text text
        text json
    }
    partitures {
        text id PK
        text songId FK
        text payload
    }
    task_templates {
        text id PK
        text userId FK
        text name
        text category
        text targetType "song-field|part"
        text targetField
        text targetKinds
        text instructions
        timestamp createdAt
        timestamp updatedAt
    }
```

### Song Structure Detail

Each song consists of:
- **Sections**: Named song sections (verse, chorus, bridge, etc.)
- **Layers**: Instrument/voice layers (vocals, guitar, bass, drums, etc.)
- **Partitures**: Notation/sheet music data
- **MIDI**: Optional arrangement MIDI file with SHA-256 checksum

### Support Tables

```mermaid
flowchart LR
    A[music_songs] --> B{Legacy migration}
    B --> C[music_partitures]
    B --> D[music_task_templates]
    C --> E[ALTER TABLE<br/>ensureColumn]
    D --> E
    A --> F[MUSIC_TURSO_DATABASE_URL]
    F --> G[Turso Cloud]
```

Dynamic column additions via `ensureColumn()` using `PRAGMA table_info()` introspection.

---

## 🔐 Authentication & Access Control

### Auth System

```mermaid
sequenceDiagram
    User->>Register Page: Email + password
    Register->>POST /api/auth/register: Submit
    POST /api/auth/register->>Auth Libre: Hash password (scrypt)
    Auth Libre->>Turso DB: Store user + verification code
    Auth Libre->>Email Service: Send verification email
    User->>Verify Email: Click link
    Verify->>POST /api/auth/verify-email: Confirm code
    POST /api/auth/verify-email->>Turso DB: Mark email verified
    User->>Login: Credentials
    Login->>POST /api/auth/login: Authenticate
    POST /api/auth/login->>Auth Libre: scrypt verify
    Auth Libre->>User: Session cookie (JWT, 30 days)
    User->>Protected Page: Request with session
```

- **Password**: scrypt with timing-safe comparison
- **Sessions**: 30-day JWT cookie sessions
- **Email Verification**: 24-hour confirmation tokens
- **Password Reset**: 30-minute secure tokens
- **Admin Bootstrapping**: Specific emails pre-authorized as admins

### Per-Page Access Control

```
MANAGEABLE_PAGES:
  ├── prompt-library
  ├── lyrics-library
  ├── song-studio
  ├── daw
  ├── tab-studio
  ├── musician-helpers
  ├── theory-lab
  └── progressions
```

```mermaid
flowchart TD
    USER[User Request] --> AUTH_CHECK{Auth Library<br/>session valid?}
    AUTH_CHECK -->|No| REDIRECT[Redirect to /login]
    AUTH_CHECK -->|Yes| ADMIN{isAdmin?}
    ADMIN -->|Yes| ALL[ALL_ACCESS_PAGE_MAP<br/>Access to everything]
    ADMIN -->|No| ACCESS_DB[Check user's<br/>pageAccess map]
    ACCESS_DB -->|Allowed| PAGE[Page loads]
    ACCESS_DB -->|Denied| DENIED[Access denied]
```

---

## 🤖 Ollama Integration

The platform integrates with **Ollama** for local AI-powered music generation and enhancement.

```mermaid
flowchart LR
    subgraph "Local Environment"
        APP[Next.js App]
        CLIENT[music/client.ts]
        OLLAMA[Ollama Integration<br/>music/ollama.ts]
        SERVER[Ollama Server<br/>localhost]
    end

    APP --> CLIENT
    CLIENT --> OLLAMA
    OLLAMA --> SERVER
    SERVER --> MODELS[Local LLM Models]
```

---

## 🎹 Feature Modules

### Song Studio
- Full song creation: title, topic, emotion, genre, language
- Reference text, lyrics, structure, hook summary
- Melody JSON, MIDI blueprints, production notes
- Sections & layers management
- AI enhancement via Ollama

### DAW
- Client-side digital audio workstation
- Audio provider for playback

### Tab Studio
- Tablature editor and notation
- Partitures binding to songs

### Theory Lab
- Music theory learning materials
- Piano keyboard interaction

### Progressions
- Chord progression builder

### Lyrics Library
- Lyrics management and search

### Prompt Library
- AI prompt templates with categories
- Task templates for AI agents

---

## 🛠️ Build & Deployment

```mermaid
graph TD
    A[Source] --> B[next build]
    B --> C[Static Pages<br/>Pre-rendered]
    B --> D[Server Components<br/>RSC]
    B --> E[Route Handlers<br/>API]
    C --> F[Deploy to Vercel]
    D --> F
    E --> F
    F --> G[Serverless Functions]
```

---

## 📦 Tech Stack Summary

| Category | Technology |
|----------|-----------|
| **Framework** | Next.js 16 (App Router, RSC) |
| **Language** | TypeScript 5 |
| **UI** | HeroUI (Next UI) + TailwindCSS 4 |
| **Database** | Turso (LibSQL) |
| **Auth** | Custom (scrypt + JWT cookies) |
| **AI** | Ollama (local LLM), MIDI parser |
| **Email** | Resend |
| **State** | Framer Motion + Zustand |
| **Icons** | Lucide React |
| **Toasts** | Sonner |
| **Linting** | ESLint |
| **Deploy** | Vercel |