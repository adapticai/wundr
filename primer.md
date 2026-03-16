# Project Primer

## Current Project State

Wundr is a TypeScript/Node.js monorepo managed with pnpm and Turborepo. It contains 45+ packages
under `packages/@wundr/` and `packages/@neolith/` covering AI orchestration, agent frameworks,
security, governance, MCP servers, CLI tools, and a Next.js web client. The project uses SPARC
methodology with Claude-Flow for development coordination.

## What Was Completed This Session

- Implemented persistent project memory system (four-layer architecture)
- Created `primer.md` for session-to-session context handoff
- Created `project_memory.log` as append-only commit history
- Created `memory.sh` for live git context injection at session start
- Integrated post-commit hook with existing husky setup
- Added session memory protocol to `CLAUDE.md`

## Current Working Area

Project-level configuration and Claude Code integration (`CLAUDE.md`, `primer.md`, `memory.sh`,
`.husky/post-commit`, `project_memory.log`).

## Next Immediate Step

Continue with whatever the user requests next. The memory system is now operational and will
auto-maintain itself via the post-commit hook and session-end regeneration protocol.

## Open Blockers

- None currently.

## Key Files Touched

- `CLAUDE.md` - Added session memory protocol section
- `primer.md` - Created (this file)
- `project_memory.log` - Created with seed entries from recent commits
- `memory.sh` - Created live context injection script
- `.husky/post-commit` - Extended with project memory logging
- `.gitignore` - Added exception for `project_memory.log`

## Notes For Future Claude Sessions

- Run `sh memory.sh` at session start for live repo context.
- Read this file (`primer.md`) to understand what happened in the last session.
- At session end, fully regenerate this file with updated state.
- The `project_memory.log` is append-only -- never rewrite it, only append.
- The post-commit hook automatically appends to `project_memory.log` on every commit.
- Hooks run via husky (`.husky/_/` shim -> `.husky/post-commit`), not `.git/hooks/`.
