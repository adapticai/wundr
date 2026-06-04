#!/usr/bin/env bash
#
# grant-tcc.sh — grant Parsec (and any extra apps) the Screen Recording +
# Accessibility TCC permissions, doing the MAXIMUM macOS allows.
#
# HARD TRUTH (verified on a real macOS 15 / Sequoia mac):
#   • TCC.db is SIP-protected — even `sudo sqlite3` gets "authorization denied".
#   • `tccutil` can only RESET permissions, never grant.
#   • `profiles install` was REMOVED ("profiles tool no longer supports installs").
#   So on a standard (SIP-on, non-MDM) mac NO script can grant these — by Apple's
#   design (or screen-recording malware would be trivial).
#
# This script therefore:
#   1. If SIP is DISABLED  -> writes the grants straight into TCC.db (fully auto).
#   2. Otherwise           -> opens the exact System Settings panes and launches
#      each app so its native "allow screen recording / accessibility" prompt
#      fires (one click each), and prints the MDM path for zero-touch fleets.
#
# Usage:
#   ./grant-tcc.sh                         # defaults to Parsec
#   ./grant-tcc.sh /Applications/Parsec.app /Applications/RustDesk.app
#
set -euo pipefail

APPS=("$@")
[[ ${#APPS[@]} -eq 0 ]] && APPS=("/Applications/Parsec.app")

SYS_TCC="/Library/Application Support/com.apple.TCC/TCC.db"
SERVICES=(kTCCServiceScreenCapture kTCCServiceAccessibility)
PROFILE="$HOME/.wundr/remote-access/wundr-tcc-pppc.mobileconfig"

log()  { printf '\033[1;34m[grant-tcc]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[grant-tcc]\033[0m %s\n' "$*" >&2; }

sip_enabled() { csrutil status 2>/dev/null | grep -qi 'enabled'; }

bundle_id() { /usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' \
                "$1/Contents/Info.plist" 2>/dev/null || true; }

# Binary code-requirement (csreq) blob for an app, as a hex string. TCC validates
# this against the running app, so a grant without the right csreq is ignored.
csreq_hex() {
  local app="$1" req tmp
  req="$(codesign -dr - "$app" 2>/dev/null | sed -n 's/^designated => //p')"
  [[ -z "$req" ]] && return 1
  tmp="$(mktemp)"
  if printf '%s\n' "$req" | csreq -r- -b "$tmp" 2>/dev/null; then
    xxd -p "$tmp" | tr -d '\n'; rm -f "$tmp"; return 0
  fi
  rm -f "$tmp"; return 1
}

grant_via_sqlite() {            # SIP-off path; returns 0 when every service written
  local app="$1" bid hex svc ok=0
  bid="$(bundle_id "$app")";  [[ -z "$bid" ]] && { warn "no bundle id: $app"; return 1; }
  hex="$(csreq_hex "$app")" || { warn "no csreq: $app"; return 1; }
  for svc in "${SERVICES[@]}"; do
    sudo sqlite3 "$SYS_TCC" \
      "INSERT OR REPLACE INTO access
         (service,client,client_type,auth_value,auth_reason,auth_version,
          csreq,indirect_object_identifier,flags)
       VALUES('$svc','$bid',0,2,4,1,X'$hex','UNUSED',0);" 2>/dev/null || ok=1
  done
  return $ok
}

open_panes_and_prompt() {
  open 'x-apple.systempreferences:com.apple.settings.PrivacySecurity.extension?Privacy_ScreenCapture' 2>/dev/null || true
  sleep 1
  open 'x-apple.systempreferences:com.apple.settings.PrivacySecurity.extension?Privacy_Accessibility'  2>/dev/null || true
  local app
  for app in "${APPS[@]}"; do
    open -a "$(basename "$app" .app)" 2>/dev/null || open "$app" 2>/dev/null || true
  done
}

main() {
  log "Target app(s): ${APPS[*]}"
  sudo -v 2>/dev/null || warn "could not pre-authorise sudo (will prompt as needed)"

  if sip_enabled; then
    warn "SIP is ENABLED — macOS blocks ALL scripted TCC writes (proven: 'authorization denied' even as root)."
    log  "Opening the exact panes + launching the app(s) so the native prompts fire..."
    open_panes_and_prompt
    cat <<EOF

  ── One click per machine (the app stays black/uncontrollable until you do this) ──
   System Settings ▸ Privacy & Security ▸ Screen Recording  ▸ enable Parsec
   System Settings ▸ Privacy & Security ▸ Accessibility     ▸ enable Parsec
   (or just click "Allow" on the prompt the app shows)

  ── Zero-touch for a FLEET (the ONLY way to skip the clicks) ──
   Enroll the macs in MDM and push the generated PPPC profile:
     $PROFILE
   MDM options: Mosyle / Jamf Now (free tiers) or self-hosted nanomdm / micromdm.
   Once enrolled, the profile grants Screen Recording + Accessibility silently & permanently.

  Note: you can already remote in WITHOUT any of this — native Screen Sharing
  (vnc://<tailscale-ip>) + SSH log you in with your username + password. Parsec
  is the redundancy; only it needs the grant above.
EOF
    exit 0
  fi

  log "SIP is DISABLED — granting directly via TCC.db..."
  local all_ok=1 app
  for app in "${APPS[@]}"; do
    if grant_via_sqlite "$app"; then log "granted Screen Recording + Accessibility -> $app";
    else all_ok=0; warn "grant failed -> $app"; fi
  done
  sudo killall tccd 2>/dev/null || true
  if [[ $all_ok -eq 1 ]]; then log "Done — grants written and tccd restarted. ✅";
  else warn "Some grants failed (see above)."; exit 1; fi
}

main "$@"
