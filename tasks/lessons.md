# Lessons Learned

## Purpose

This file captures mistake patterns discovered during development. Claude should review this at the
start of each session and update it after any correction from the user.

## Template

```markdown
### [Date] - Brief title

**Mistake:** What went wrong

**Root cause:** Why it happened

**Preventative rule:** What to do differently next time
```

## Entries

### 2026-05-31 - "End-to-end success" claimed on a machine where the broken path was skipped

**Mistake:** I reported `wundr computer-setup --profile fullstack` as a verified end-to-end success
("exit 0, 0 failed") for a fresh-Mac provisioning fix. On a genuinely fresh Mac it still failed at
"Install Homebrew" with Homebrew's "Don't run this as root!" guard.

**Root cause:** My verification ran on an already-provisioned machine with `--skip-existing`, so
Homebrew (and most install steps) short-circuited as "already installed" and the actual
fresh-machine install path — the one that was reported broken — never executed. A green run that
skipped the failing step is not a verification of the fix.

**Preventative rule:** When verifying an installer / setup / migration tool, exercise the
_reported-broken state_, not a convenient pre-provisioned one. Specifically: do not rely on a run
where `--skip-existing` (or equivalent) short-circuits the steps under test; confirm the target step
actually executed (check the log for "Executing/Installing", not "already installed/Skipping"). If
the true state can't be reproduced locally (e.g. needs root/sudo or a clean box), say so explicitly
and verify the underlying logic + components instead of claiming full end-to-end success.

### 2026-06-02 - "Reports the failure" mistaken for "fixes the failure"; and check which VERSION the user ran

**Mistake:** For the Parsec/Tailscale install bug I (a) shipped 1.0.27 that replaced false-success
logging with honest "did NOT install" reporting and told the user it was fixed — but honest
reporting does not INSTALL anything, so the user still had no Parsec/Tailscale; and (b) the user's
next failing run was actually still on the OLD published version (1.0.26 in the banner), run minutes
after my push before the publish finished, so none of my fixes were even in effect.

**Root cause:** Two conflated assumptions. (1) I treated "stop lying about success" as equivalent to
"make it work." The real defect was deeper: `tailscale-app` and `parsec` are **pkg-based** Homebrew
casks — brew tracks only the Caskroom receipt, not the `/Applications/*.app` bundle — so when a
prior run left a receipt but no app, `brew install --cask` is a ~0.5s **no-op** that never re-lays
the app. The repair is `brew reinstall --cask --force`. Honest reporting surfaced the symptom; only
force-reinstall fixes it. (2) I assumed the user was running my just-pushed build without checking
the version banner in their log.

**Preventative rule:** (1) For any "it didn't actually do X" bug, the fix must make X _happen_, not
just report that it didn't — verify the tool reaches the success state, not merely that it logs
truthfully. (2) Know the package manager's semantics: pkg casks need sudo (`installer -pkg`) and are
not repaired by `install`; verify by the real artifact on disk (`/Applications/*.app`, the bin
shim), never by `brew install` exit code. (3) Before claiming a published fix applies to a user's
run, confirm the version they actually executed (banner / `--version`), and remember CI publish lags
the push by minutes.
