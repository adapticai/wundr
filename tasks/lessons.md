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
