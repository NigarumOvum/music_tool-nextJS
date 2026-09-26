# Agent Docs-Sync Protocol (mandatory for ALL AI agents)

> This protocol applies no matter which tool you are: **VS Code GitHub
> Copilot, Devin, Cursor, Antigravity, Kiro, OpenCode, TRAE**, or any other
> assistant editing this repo. Tool-specific pointers live in
> `AGENTS.md`, `.github/copilot-instructions.md`, `.cursor/rules/`,
> `.kiro/steering/`, and (for Devin) its project wiki — all of them point
> back here as the single source of truth.

## The rule

**Every code change that adds, removes, or alters user-facing behavior,
an API route, a DB table/column, an access rule, or a user flow MUST update
`docs/` in the same change.** Code and docs ship together or not at all.

## What to update, by change type

| Change | Update |
|---|---|
| New/changed feature or UI section | `docs/ARCHITECTURE.md` inventory + `docs/REQUIREMENTS.md` FRs |
| New API route / changed contract | `docs/ARCHITECTURE.md` (§2 flows) + FRs |
| New table/column or migration | `docs/ARCHITECTURE.md` (§3 data model) + FRs |
| New access rule, role, gate, redirect | `docs/ARCHITECTURE.md` (§4) + FR-011–FR-013 area |
| New acceptance-relevant behavior | `docs/ACCEPTANCE.md` |
| New user-facing string | i18n dictionaries (all 5 locales) + note it in the change |
| Behavior intentionally deferred | `docs/ACCEPTANCE.md` Phase 2 list |

## How

1. Read `docs/README.md`, `docs/ARCHITECTURE.md`, `docs/REQUIREMENTS.md`,
   `docs/ACCEPTANCE.md` **before** editing code.
2. Keep requirement numbers stable — append new `FR-0xx`/`NFR-0xx`, never
   renumber. Mark removed behavior as ~~struck~~ with a date, don't delete
   history silently.
3. When code and docs disagree, **code wins today and the agent that made
   the change owns the doc fix in the same change**.
4. Verify with `npx tsc --noEmit`, `npm test`, and (for UI/API changes)
   `npm run build` before finishing.

## Checklist (paste into your final summary)

- [ ] Behavior change reflected in `docs/` (or "docs-only"/"no behavior change" stated)
- [ ] FR/NFR numbers appended, none renumbered
- [ ] i18n keys added in all 5 locales (if UI strings changed)
- [ ] `tsc` + `vitest` (+ `build` for UI/API) green
