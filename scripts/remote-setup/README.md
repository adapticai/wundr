# macOS Remote Access Setup

Production-grade automation for configuring headless or semi-headless **macOS 12–15** hosts (Apple Silicon or Intel) for low-latency remote access with video and keyboard/mouse support.

## Features

- ✅ **Tailscale VPN** - Secure mesh networking with unattended auth
- 🖥️ **Remote Desktop** - Parsec (default) or RustDesk support
- 🚀 **Auto-start** - LaunchDaemons ensure services run at boot
- ⚡ **Headless optimized** - Wake-on-LAN, no sleep, auto-restart
- 🔒 **TCC handling** - Guided permission setup for Screen Recording & Accessibility
- 🔄 **Idempotent** - Safe to re-run; detects existing installations
- ✨ **Verifiable** - Built-in verification and troubleshooting

## Prerequisites

- macOS 12.0 or newer (Monterey, Ventura, Sonoma, Sequoia)
- Apple Silicon (M1/M2/M3) or Intel Mac
- Internet connectivity
- Administrator (sudo) access
- For Tailscale: Active Tailscale account and auth key (optional for interactive setup)

## Quick Start

### 1. Download the Setup Script

```bash
# Clone this repository or download the scripts
cd /path/to/wundr/scripts/remote-setup

# Make scripts executable
chmod +x setup_remote_mac.sh uninstall_remote_mac.sh
```

### 2. Run Installation

#### Option A: Interactive Setup (Recommended for first-time)

```bash
sudo ./setup_remote_mac.sh \
  --stack=parsec \
  --device-name=studio-01
```

This will:
- Prompt you to sign in to Tailscale in your browser
- Guide you through TCC permission approval
- Ask you to sign in to Parsec/RustDesk

#### Option B: Unattended Setup (Requires auth key)

```bash
export TAILSCALE_AUTH_KEY="tskey-auth-XXXXXXXXXXXXXXXXXXXX"

sudo ./setup_remote_mac.sh \
  --stack=parsec \
  --tailscale-auth-key="${TAILSCALE_AUTH_KEY}" \
  --device-name=studio-01 \
  --ts-tags=tag:remote,tag:studio \
  --unattended
```

**Note:** Unattended mode will fail if TCC permissions or remote desktop sign-in is required. Use interactive mode for first-time setup.

### 3. Verify Installation

```bash
# Run verification checks
sudo ./setup_remote_mac.sh --verify-only

# Check service status
sudo launchctl list | grep com.adaptic
tailscale status
```

## Configuration Options

### Command-Line Flags

| Flag | Description | Default |
|------|-------------|---------|
| `--stack=[parsec\|rustdesk]` | Remote desktop stack | `parsec` |
| `--tailscale-auth-key=<KEY>` | Tailscale auth key (unattended) | Interactive login |
| `--device-name=<NAME>` | Hostname for Tailscale | System hostname |
| `--ts-tags=<TAGS>` | Tailscale ACL tags | None |
| `--rustdesk-id-server=<HOST>` | Custom RustDesk ID server | Official relay |
| `--rustdesk-relay-server=<HOST>` | Custom RustDesk relay | Official relay |
| `--prevent-sleep=[true\|false]` | Disable system sleep | `true` |
| `--display-sleep-mins=<N>` | Display sleep timeout | `10` |
| `--verify-only` | Run checks without changes | `false` |
| `--unattended` | Non-interactive mode | `false` |

### Environment Variables

You can set defaults via environment variables (CLI flags override these):

```bash
export TAILSCALE_AUTH_KEY="tskey-auth-..."
export DEVICE_NAME="studio-01"
export TS_TAGS="tag:remote,tag:studio"
export RUSTDESK_ID_SERVER="id.example.com"
export RUSTDESK_RELAY_SERVER="relay.example.com"
```

## Remote Desktop Stacks

### Parsec (Default)

Best for: Gaming, low-latency work, macOS → macOS/Windows/Linux

**Features:**
- Ultra-low latency (< 10ms on LAN)
- 4K 60fps support
- Hardware-accelerated encoding
- Free for personal use

**Setup:**
1. Script installs Parsec
2. Opens Parsec for sign-in (first run)
3. Enable **Host** in Settings → Host
4. Enable **Unattended Access** for headless operation
5. TCC permissions guided setup

### RustDesk

Best for: Open-source preference, self-hosted infrastructure

**Features:**
- Fully open-source
- Self-hosted relay support
- Cross-platform
- Free and privacy-focused

**Setup:**
1. Script installs RustDesk
2. TCC permissions guided setup
3. Optionally configure custom ID/Relay servers
4. Note the connection ID displayed

**Self-Hosted Servers:**

```bash
sudo ./setup_remote_mac.sh \
  --stack=rustdesk \
  --rustdesk-id-server=id.mydomain.com \
  --rustdesk-relay-server=relay.mydomain.com
```

## TCC Permissions (Important!)

macOS requires explicit user approval for:
- **Screen Recording** - Capture screen content
- **Accessibility** - Control keyboard/mouse

### What Happens

1. Script detects missing permissions
2. Opens **System Settings → Privacy & Security**
3. Guides you to enable permissions
4. Auto-detects when approved and continues

### Manual Approval

If needed, manually approve:

1. Open **System Settings**
2. Go to **Privacy & Security**
3. Click **Screen Recording** → Enable Parsec/RustDesk
4. Click **Accessibility** → Enable Parsec/RustDesk
5. Restart the app if needed

**Note:** These permissions CANNOT be scripted without MDM/PPPC profiles. This is a macOS security requirement.

## Connecting from Client Mac

### Setup Client (One-time)

```bash
# Install Tailscale
brew install --cask tailscale
# Sign in to same tailnet

# Install remote desktop client
brew install --cask parsec   # For Parsec
# OR
brew install --cask rustdesk  # For RustDesk
```

### Connect via Parsec

1. Launch Parsec
2. Sign in with same account
3. See your Mac listed under **Computers**
4. Click to connect

### Connect via RustDesk

1. Launch RustDesk
2. Enter connection ID or Tailscale IP
3. Accept connection (first time)
4. Save credentials for unattended access

## Headless Operation

### HDMI Dummy Plug (Recommended)

For truly headless Macs (no display connected):

- Purchase an HDMI dummy plug (~$10)
- Enables display resolution configuration
- Prevents rendering issues in remote sessions
- Recommended: 4K 60Hz dummy plug

Without a dummy plug, macOS may:
- Default to low resolution (1024x768)
- Disable hardware acceleration
- Cause black screens in remote sessions

### Power Settings

The script configures:
- ✅ Wake-on-LAN enabled
- ✅ Auto-restart after power failure
- ✅ System sleep disabled (configurable)
- ✅ Display sleep after N minutes (configurable)
- ✅ Disk sleep disabled

Revert with: `--revert-pmset` during uninstall

## Troubleshooting

### Issue: Black screen or low resolution

**Solution:**
- Use an HDMI dummy plug
- In remote session, set display resolution via System Settings
- Reboot after connecting dummy plug

### Issue: Can't connect via Tailscale

**Solution:**
```bash
# Check Tailscale status
tailscale status

# Test connectivity
tailscale ping <device-name>

# Check firewall
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate

# Restart Tailscale
sudo launchctl unload /Library/LaunchDaemons/com.tailscale.tailscaled.plist
sudo launchctl load -w /Library/LaunchDaemons/com.tailscale.tailscaled.plist
```

### Issue: Parsec/RustDesk not starting

**Solution:**
```bash
# Check LaunchDaemon status
sudo launchctl list | grep com.adaptic

# Check logs
tail -f /var/log/remote-setup/parsec.log
tail -f /var/log/remote-setup/parsec.error.log

# Manually load
sudo launchctl load -w /Library/LaunchDaemons/com.adaptic.parsec.plist

# Verify TCC permissions
sudo sqlite3 /Library/Application\ Support/com.apple.TCC/TCC.db \
  "SELECT * FROM access WHERE service='kTCCServiceScreenCapture';"
```

### Issue: Permission denied errors

**Solution:**
- Ensure running with `sudo`
- Check file permissions: `ls -la /Library/LaunchDaemons/com.adaptic.*`
- Verify log directory exists: `ls -la /var/log/remote-setup/`

### Issue: High latency or lag

**Solution:**
- Ensure both Macs on same Tailscale network (check with `tailscale status`)
- Use wired Ethernet instead of Wi-Fi
- Check for network congestion
- For Parsec: Lower bitrate in settings if needed
- For RustDesk: Check relay server location

## Logs & Diagnostics

### Log Files

All logs stored in `/var/log/remote-setup/`:

```bash
# Installation log
/var/log/remote-setup/install.log

# Parsec logs
/var/log/remote-setup/parsec.log
/var/log/remote-setup/parsec.error.log

# RustDesk logs
/var/log/remote-setup/rustdesk.log
/var/log/remote-setup/rustdesk.error.log

# Uninstall log
/var/log/remote-setup/uninstall.log
```

### View Logs

```bash
# Installation log
less /var/log/remote-setup/install.log

# Live tail service logs
tail -f /var/log/remote-setup/parsec.log

# Search for errors
grep -i error /var/log/remote-setup/*.log
```

## Uninstallation

### Keep Apps, Remove LaunchDaemons (Default)

```bash
sudo ./uninstall_remote_mac.sh
```

### Full Removal

```bash
sudo ./uninstall_remote_mac.sh \
  --remove-apps \
  --revert-pmset \
  --remove-logs \
  --yes
```

### Selective Removal

```bash
# Remove only Parsec
sudo ./uninstall_remote_mac.sh --stack=parsec --remove-apps

# Remove only RustDesk
sudo ./uninstall_remote_mac.sh --stack=rustdesk --remove-apps

# Keep everything but disable auto-start
sudo ./uninstall_remote_mac.sh --keep-apps
```

## Security Considerations

### Tailscale Auth Keys

- Auth keys are sensitive credentials
- Use **ephemeral** and **reusable** keys for automation
- Set expiration (e.g., 7 days) for temporary deployments
- Rotate keys regularly
- Never commit keys to version control

**Create secure auth key:**
1. Go to [Tailscale Admin Console](https://login.tailscale.com/admin/settings/keys)
2. Generate Auth Key
3. Enable: **Reusable**, **Ephemeral**, set **Expiry**
4. Tag with ACLs for restricted access

### Remote Access Security

- Use Tailscale ACLs to restrict which devices can connect
- Enable MFA on remote desktop accounts
- Regularly review connected devices
- Use unattended access passwords/PINs
- Keep software updated

### Network Security

- Tailscale provides end-to-end encryption
- All traffic goes through encrypted WireGuard tunnel
- No open ports on public internet required
- Use Tailscale SSH instead of exposing port 22

## Advanced Configuration

### Custom LaunchDaemon Options

Edit plists in `launchd/` before running installer:

```bash
# Modify startup delay
<key>StartInterval</key>
<integer>60</integer>

# Add environment variables
<key>EnvironmentVariables</key>
<dict>
    <key>CUSTOM_VAR</key>
    <string>value</string>
</dict>
```

### Multiple Remote Stacks

To run both Parsec AND RustDesk:

```bash
# Install Parsec first
sudo ./setup_remote_mac.sh --stack=parsec

# Then install RustDesk (won't conflict)
sudo ./setup_remote_mac.sh --stack=rustdesk
```

### Caffeinate for Extra Wake Assurance

Create custom LaunchDaemon with caffeinate:

```xml
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.adaptic.keepawake</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/bin/caffeinate</string>
        <string>-d</string>
        <string>-i</string>
        <string>-m</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
</dict>
</plist>
```

## Example Workflows

### Home Lab Mac Studio

```bash
#!/bin/bash

export TAILSCALE_AUTH_KEY="tskey-auth-..."

sudo ./setup_remote_mac.sh \
  --stack=parsec \
  --tailscale-auth-key="${TAILSCALE_AUTH_KEY}" \
  --device-name=home-studio \
  --ts-tags=tag:homelab,tag:studio \
  --prevent-sleep=true \
  --display-sleep-mins=5
```

### Office Mac Mini Fleet

```bash
#!/bin/bash

# Array of device names
devices=("mini-01" "mini-02" "mini-03")

for device in "${devices[@]}"; do
    sudo ./setup_remote_mac.sh \
      --stack=rustdesk \
      --device-name="$device" \
      --ts-tags=tag:office,tag:mini \
      --rustdesk-id-server=id.company.com \
      --rustdesk-relay-server=relay.company.com
done
```

### Developer Workstation (Keep Display Active)

```bash
sudo ./setup_remote_mac.sh \
  --stack=parsec \
  --device-name=dev-mac \
  --prevent-sleep=false \
  --display-sleep-mins=30
```

## Testing

### Verify Script Syntax

```bash
# Check Bash syntax
bash -n setup_remote_mac.sh
bash -n uninstall_remote_mac.sh

# Run shellcheck (if installed)
shellcheck setup_remote_mac.sh
shellcheck uninstall_remote_mac.sh
```

### Dry Run (Verify-Only Mode)

```bash
# Test without making changes
sudo ./setup_remote_mac.sh \
  --verify-only \
  --stack=parsec \
  --device-name=test-mac
```

## File Structure

```
scripts/remote-setup/
├── setup_remote_mac.sh           # Main installer
├── uninstall_remote_mac.sh       # Uninstaller
├── README.md                     # This file
└── launchd/
    ├── com.adaptic.parsec.plist  # Parsec LaunchDaemon
    └── com.adaptic.rustdesk.plist # RustDesk LaunchDaemon
```

## Support & Contributions

### Getting Help

1. Check [Troubleshooting](#troubleshooting) section
2. Review logs in `/var/log/remote-setup/`
3. Run with `--verify-only` to diagnose
4. Check service status: `sudo launchctl list | grep com.adaptic`

### Known Limitations

- TCC permissions require manual approval (macOS restriction)
- First-time sign-in required for Parsec/RustDesk
- Some settings require GUI interaction (cannot be fully scripted)
- MDM/PPPC profiles needed for zero-touch deployment

### Future Enhancements

- [ ] PPPC profile generation for MDM deployments
- [ ] Automated testing with GitHub Actions
- [ ] Support for VNC as alternative stack
- [ ] Integration with Apple Remote Desktop
- [ ] Monitoring/alerting integration

## License

MIT License - See repository root for details

## Credits

- **Tailscale**: https://tailscale.com
- **Parsec**: https://parsec.app
- **RustDesk**: https://rustdesk.com

---

**Version:** 1.0.0
**Last Updated:** 2025-10-24
**Maintained by:** Adaptic Development Team
