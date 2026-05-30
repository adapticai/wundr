# REVIEW: Computer-Setup Headless Overhaul

**Branch (wundr):** `fix/computer-setup-headless-xcode-and-consolidation` **Branch (maestro):**
`fix/headless-setup-xcode-guard` **Driver:** new Mac machines hung on the Xcode step during
`computer-setup`.

## Root cause (the hang)

`mac-installer.ts` fired the interactive `xcode-select --install` GUI dialog then polled
`xcode-select -p` in an **unbounded `while (!installed)` loop with no timeout**. On a
headless/CI/SSH machine the dialog never completes → infinite hang. It is the first required step,
so the whole run stalled. Secondary hangs: `macos.sh` blocked on `read -p "Press Enter…"`;
`git-installer` fired a 2nd GUI trigger; Homebrew/OMZ/NVM/pnpm curl installs had no
NONINTERACTIVE/timeout; the CLI confirm prompt wasn't TTY-gated; sudo `execSync` could prompt-block.

## What was delivered (all verified: tsc clean, 20/20 unit tests, builds pass)

| Phase                                                | Outcome                                                                                                                                                                                                                                                                                               | Commit            |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| **P1** Headless-first Xcode + non-interactive safety | `lib/headless.ts` (softwareupdate-based CLT install, bounded, GUI fallback only on TTY; `isInteractive`/`nonInteractiveEnv`/`runProcess`). Refactored mac/git/node/homebrew installers; TTY-gated CLI prompts + `--yes/--non-interactive`; fixed `macos.sh`. Fixed the broken jest ESM `test` script. | `de722312`        |
| **P3** Maestro de-confliction                        | `lib/claude-config.ts` (detect-maestro-and-defer, v2 schema, deep-merge, backup). `claude-installer` no longer clobbers `~/.claude/settings.json`; defers to maestro when present, else merges+backs up.                                                                                              | `2f179aec`        |
| **P4** Remote-setup incorporation                    | `RemoteAccessInstaller` (TS port of `setup_remote_mac.sh`): Tailscale + SSH + host pmset (real backup) + desktop-sharing, auto host/master mode, `sudo -n` (never prompts), TCC degrades gracefully. `RemoteAccessConfig` type, registry wiring, `--no-remote-access`.                                | `128567e8`        |
| **P2 (safety subset)**                               | Backstop step timeout (`max(estTime*4, 45min)`) + fixed inverted `--skip-existing` logic on the live `ComputerSetupManager`.                                                                                                                                                                          | `c0423afb`        |
| **P5 (subset)**                                      | `dev-computer-setup.sh` hardened (`set -euo pipefail`, TTY-gated prompt). `macos.sh` fixed in P1.                                                                                                                                                                                                     | `c0423afb`        |
| **P6** Maestro repo                                  | runbook xcode `-p` guard + defer-to-computer-setup note; `init-agent.sh` TTY-gated `read` + ERR trap.                                                                                                                                                                                                 | maestro `9c140a7` |

## Deferred (recommended as a dedicated follow-up PR)

- **P2 full orchestrator consolidation (3 → 1):** retire `ComputerSetupManager`
  - `RealSetupOrchestrator`, wire `UnifiedOrchestrator` (register real installers via
    `InstallerAdapter`, reconcile the two ProfileManagers/4 topo-sorts, repoint both `wundr setup`
    and `wundr computer-setup`). Large, touches the live command; **not urgent now** because the
    backstop timeout (P2 subset) already makes every orchestrator hang-proof. Best done in isolation
    with its own verification.
- **`packages/setup-toolkit` deletion:** dead duplicate (`@wundr.io/setup-toolkit-simple`, imported
  nowhere) containing a 3rd bare `xcode-select --install`. Safe to delete
  - drop the dep in legacy `packages/cli/package.json`; deferred to avoid a lockfile/build rabbit
    hole mid-session. It is dead code, so it cannot cause the reported hang.
- `macos.sh`/`linux.sh` → thin wrappers over the TS CLI (currently fixed in place).

## Known pre-existing issues (not introduced here)

- Repo-level **eslint OOMs** on a single file (4GB heap) — eslint config/infra problem, independent
  of these changes.
- The package's jest `test` script could not run any test (missing ESM flag); **fixed** in P1.

## Verification commands

```
cd packages/@wundr/computer-setup
npx tsc --noEmit                                   # clean
NODE_OPTIONS=--experimental-vm-modules npx jest src/lib src/installers/__tests__/remote-access-installer.test.ts  # 20/20
pnpm build                                         # passes (run by pre-commit hook)
```
