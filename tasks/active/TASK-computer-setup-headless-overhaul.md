# TASK: Computer-Setup End-to-End Hardening, Consolidation & Remote-Setup Incorporation

**Branch:** `fix/computer-setup-headless-xcode-and-consolidation` **Driver:** new Mac machines get
stuck on Xcode during `computer-setup`. **Source of truth:** 7-agent audit (see
`tasks/reviews/REVIEW-computer-setup-audit.md`).

## Decisions (confirmed with user)

1. **Scope:** Full consolidation to ONE orchestrator (+ all P0 safety, maestro de-confliction,
   remote-setup).
2. **Target:** Both headless agent Mac minis and dev laptops — **headless-first**.
3. **Claude config:** Maestro OWNS global `~/.claude`; computer-setup **merges/defers** (never
   clobbers).
4. **Remote-setup:** Runs as a **standard (non-opt-in) phase**, **auto-detects host/master mode**,
   TCC step **degrades gracefully** when headless. `--no-remote-access` escape hatch.
5. **Maestro repo:** edits allowed (runbook xcode guard + init-agent.sh non-interactive). Commit +
   push authorized.

## Root cause of the hang

- `mac-installer.ts:160-189` — `xcode-select --install` (GUI) + unbounded `while(!installed)` poll,
  no timeout.
- `git-installer.ts:182` — 2nd `xcode-select --install` GUI trigger.
- `environment/scripts/install/macos.sh:55` — `read -p "Press Enter..."` blocks non-interactive.
- `setup-toolkit/src/installers/index.ts:446` — 3rd bare `xcode-select --install`.
- `profile-loader.ts:916` — declarative `installCommand: 'xcode-select --install'`.
- maestro `docs/runbooks/mac-mini-bootstrap.md:33` — manual `xcode-select --install`, no guard.

## Plan (phased; each phase builds + verifies before commit)

### P1 — Headless-first Xcode + non-interactive safety (the actual fix)

- [ ] New `src/lib/headless.ts`: `isInteractive()`, `nonInteractiveEnv()`, `runProcess()` (stdin
      ignore + timeout), `installXcodeCommandLineTools()` (softwareupdate-based, bounded, GUI
      fallback only when TTY).
- [ ] `mac-installer.ts`: use shared xcode helper; brew/omz install non-interactive + timeout;
      `chsh` guarded; `killall` guarded; dotfiles append-not-overwrite; `brew shellenv` + PATH
      verify; per-pkg timeout.
- [ ] `git-installer.ts`: macOS fallback uses shared xcode helper (no raw GUI trigger).
- [ ] `node-installer.ts`: NVM/pnpm curl installs bounded + stdin ignore; drop
      `npm config set prefix` under NVM.
- [ ] `homebrew-installer.ts`: NONINTERACTIVE + timeout + stdin ignore.
- [ ] `permissions-installer.ts`: `execSync` sudo → `sudo -n`/skip when no TTY; never block.
- [ ] CLI `computer-setup.ts`: gate all `inquirer.prompt` behind TTY/CI; add
      `--yes/--non-interactive`.
- [ ] `manager/index.ts`: fix inverted skip-logic (already-installed required tools re-installed).
- [ ] `environment/scripts/install/macos.sh`: replace `read -p` with bounded poll + `[ -t 0 ]`
      gating.
- [ ] Verify: build, typecheck, `CI=1` dry-run shows no blocking step. Commit + push.

### P2 — Orchestrator consolidation (3 → 1)

- [ ] Register real installers (InstallerAdapter) into `UnifiedOrchestrator`.
- [ ] Point `wundr computer-setup` and `wundr setup` (alias) at UnifiedOrchestrator.
- [ ] Add per-step + global timeout watchdog.
- [ ] Delete `ComputerSetupManager`, `RealSetupOrchestrator`, unused `ComputerSetupCommands`,
      redundant ProfileManager + topo-sorts.
- [ ] Verify + commit + push.

### P3 — Maestro de-confliction (computer-setup side)

- [ ] `claude-installer.ts`: migrate settings.json to v2 schema (reuse `claude-code-conventions`
      generator); read-merge-write + timestamped backup; detect-maestro-and-defer guard.
- [ ] Additive + namespaced agent/command copy (`~/.claude/agents/wundr/…`).
- [ ] Consolidate hook config (settings.json vs resource-manager `hooks.json`); namespace
      `claude-init` symlink; pin ruflo; don't double-register shared MCP.
- [ ] Verify + commit + push.

### P4 — Remote-setup → first-class TS installer

- [ ] New `src/installers/remote-access-installer.ts` (BaseInstaller, darwin-only,
      `depends:['homebrew']`).
- [ ] `types/index.ts`: `remoteAccess` config; `SetupOptions.remoteAccess` default-on +
      `--no-remote-access`.
- [ ] Port safe logic (argv arrays, no eval): Tailscale daemon, ed25519 SSH key, host-only pmset w/
      real backup, LaunchDaemons from packaged resources; reuse HomebrewInstaller; TCC degrade.
- [ ] Register in InstallerRegistry + UnifiedOrchestrator. Verify + commit + push.

### P5 — Shell convergence + dead-code deletion

- [ ] `macos.sh`/`linux.sh` → thin wrappers over the TS CLI; `dev-computer-setup.sh`
      `set -euo pipefail` + TTY gate.
- [ ] Delete `packages/setup-toolkit`; remove dep from legacy `packages/cli/package.json`.
- [ ] Verify + commit + push.

### P6 — Maestro repo hardening (separate repo)

- [ ] `~/maestro/docs/runbooks/mac-mini-bootstrap.md`: `xcode-select -p` guard, defer CLT to
      computer-setup.
- [ ] `~/maestro/scripts/setup/init-agent.sh`: env-gate the `read` prompt; wrap network installs in
      `timeout`; add trap.
- [ ] Commit + push (bump patch version per maestro convention).

## Verification protocol per phase

`pnpm --filter @wundr.io/computer-setup build` · `… typecheck` (tsc) · `… lint` · `CI=1` dry-run.
