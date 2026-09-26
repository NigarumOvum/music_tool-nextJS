<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:bandschamber-docs-sync (applies to ALL AI agents: Copilot, Devin, Cursor, Antigravity, Kiro, OpenCode, TRAE) -->
# BandsChamber Studio — agent rules

1. **Docs are the source of truth.** Before editing code, read `docs/README.md`,
   `docs/ARCHITECTURE.md`, `docs/REQUIREMENTS.md`, `docs/ACCEPTANCE.md`.
2. **Docs-sync is mandatory.** Any change that adds/removes/alters behavior,
   APIs, DB schema, access rules, or flows MUST update `docs/` in the same
   change. Full protocol: `docs/AGENT_PROTOCOL.md`. Never renumber FR/NFRs.
3. **Conventions**: per-page/API auth gating (no middleware — new routes must
   gate too); per-user `mt:<userId>:` localStorage via `src/lib/persist.ts`;
   i18n keys in ALL 5 locales (`src/lib/i18n/`); typed domain libs in
   `src/lib/music/`; Vitest for pure libs.
4. **Verify**: `npx tsc --noEmit` + `npm test`, and `npm run build` for UI/API
   changes. Commit only when the user explicitly asks.
<!-- END:bandschamber-docs-sync -->
