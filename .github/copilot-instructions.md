# Copilot instructions — BandsChamber Studio

Apply the repo's agent rules in `AGENTS.md` (docs-sync section) on every change.

- Source of truth: `docs/README.md`, `docs/ARCHITECTURE.md`,
  `docs/REQUIREMENTS.md`, `docs/ACCEPTANCE.md`. Protocol: `docs/AGENT_PROTOCOL.md`.
- Any behavior/API/schema/access change MUST update `docs/` in the same change.
  Append FR/NFR numbers; never renumber. UI strings need all 5 i18n locales.
- Conventions: per-page + per-API auth gating, per-user `mt:<userId>:`
  localStorage (`src/lib/persist.ts`), typed libs in `src/lib/music/`.
- Verify: `npx tsc --noEmit`, `npm test` (`npm run build` for UI/API).
