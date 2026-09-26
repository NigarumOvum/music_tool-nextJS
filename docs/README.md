# BandsChamber Studio — Documentation Index

> Single source of truth for what this project is, what it must do, and what
> "done" means. **Every AI coding agent working in this repo must keep these
> docs in sync with the code** — see [AGENT_PROTOCOL.md](./AGENT_PROTOCOL.md).

| Document | Contents | Audience |
|---|---|---|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Stack, runtime model, routes, data model, auth/access, key flows, repo map | Dev, agents, future team |
| [REQUIREMENTS.md](./REQUIREMENTS.md) | Functional requirements (FR-001…​), non-functionals (NFR-001…​) | Dev, agents, future team |
| [ACCEPTANCE.md](./ACCEPTANCE.md) | Acceptance criteria per area + MVP definition (all current features, free-first) | Dev, agents, future team |
| [AGENT_PROTOCOL.md](./AGENT_PROTOCOL.md) | Mandatory docs-sync protocol for **all** AI agents (Copilot, Devin, Cursor, Antigravity, Kiro, OpenCode, TRAE) | AI agents |
| [../ARCHITECTURE.md](../ARCHITECTURE.md) | Legacy architecture notes (kept for history; `docs/` wins on conflicts) | — |

## Product in one paragraph

BandsChamber Studio is a private, multi-user music production workspace:
a **Toolkit home** (timing/metronome, tuner, harmony/theory, progressions),
a **Production Studio** (song catalog, bands, lyrics, browser DAW, tab
notation, song editor), a **Prompt Library** (local-LLM songwriting prompts),
**Membership + PayPal**, and **Account/Auth** with per-page access control.
Five UI languages, installable PWA, per-user local drafts.

## Doc conventions

- Requirements are numbered (`FR-001`, `NFR-001`) and testable.
- MVP = **all currently implemented features**, monetization **free-first**
  (PayPal code exists; live payments are Phase 2).
- When code and docs disagree, **code wins today, docs must be fixed** —
  the agent that made the change owns the doc update (see AGENT_PROTOCOL.md).
