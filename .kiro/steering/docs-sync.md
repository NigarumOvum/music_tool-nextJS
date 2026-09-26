# BandsChamber Studio — docs sync (Kiro steering)

This steering file applies to all work in this repo. The full protocol is
`docs/AGENT_PROTOCOL.md`; repo rules are in `AGENTS.md`.

- Source of truth: `docs/README.md`, `docs/ARCHITECTURE.md`,
  `docs/REQUIREMENTS.md`, `docs/ACCEPTANCE.md` — read before editing code.
- Mandatory docs-sync: any behavior, API, DB schema, access-rule, or flow
  change MUST update `docs/` in the same change. Append FR/NFR numbers;
  never renumber.
- UI strings need all 5 i18n locales (`src/lib/i18n/`). New pages/API routes
  must enforce auth/access (no middleware). Per-user localStorage via
  `src/lib/persist.ts` (`mt:<userId>:` keys).
- Verify: `npx tsc --noEmit`, `npm test` (`npm run build` for UI/API).
