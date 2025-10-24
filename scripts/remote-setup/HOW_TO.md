# Remote Mac Setup - Quick Start Guide

This guide will help you set up remote access between your Macs using Tailscale and Parsec/RustDesk.

## Prerequisites

- macOS 12.0 or newer
- Administrator (sudo) access
- Internet connectivity
- A Tailscale account (free at https://tailscale.com)

---

## 🎯 Two Setup Modes

This script supports two modes:

### **Master Mode** (Your laptop/daily driver)

- The machine you USE to connect to remote machines
- Installs: Tailscale client + Parsec/RustDesk client apps
- No auto-start services or power management changes
- **Use this on your MacBook Pro, iMac, or primary workstation**

### **Remote/Host Mode** (Your Mac Studio, Mac mini, build machines)

- The machine you CONNECT TO remotely
- Installs: Tailscale + Parsec/RustDesk + auto-start services + headless optimization
- **Use this on Mac Studios, Mac minis, or any machine you want to access remotely**

---

## 📋 Before You Start: Get Your Tailscale Auth Key

1. Go to https://login.tailscale.com/admin/settings/keys
2. Click **"Generate auth key"**
3. Configure the key:
   - ✅ Enable **Reusable** (use on multiple devices)
   - ✅ Enable **Ephemeral** (optional - removes device when offline)
   - Set **Expiry** (e.g., 90 days)
   - Add **Tags** if needed (e.g., `tag:remote`)
4. Click **"Generate key"**
5. Copy the key (starts with `tskey-auth-`)
6. Keep it safe - you'll need it below!

---

## 💻 MASTER SETUP (Your Main Computer)

**Use this if you want to CONNECT TO other machines remotely.**

This is typically your MacBook Pro, iMac, or primary workstation. This setup is quick and simple!

### Step 1: Navigate to the Script Directory

```bash
cd /Users/eli/wundr/scripts/remote-setup
```

### Step 2: Make the Script Executable

```bash
chmod +x setup_remote_mac.sh
```

### Step 3: Run Master Setup

```bash
sudo ./setup_remote_mac.sh --master
```

**That's it!** The script will:

- Install Tailscale client
- Install Parsec client
- Install RustDesk client
- Set up SSH keys
- Prompt you to sign in to Tailscale in your browser

### Step 4: Sign Into Your Remote Desktop Apps

#### For Parsec:

1. Open Parsec from Applications
2. Sign in with your Parsec account
3. Your remote machines will appear automatically

#### For RustDesk:

1. Open RustDesk from Applications
2. You're ready to connect using device IPs or connection IDs

### Step 5: Connect to Your Remote Machines

Once your remote machines are set up (see below), you can:

**Via Parsec:**

- Open Parsec → Click on your remote machine → Connect

**Via RustDesk:**

- Open RustDesk → Enter Tailscale IP or connection ID → Connect

**Via SSH:**

```bash
ssh user@<remote-machine-name>
# Example: ssh eli@studio-01
```

✅ **Your master machine is ready!** Now set up your remote machines below.

---

## 🖥️ REMOTE/HOST SETUP (Machines You Want to Access Remotely)

**Use this for Mac Studios, Mac minis, build servers, or any machine you want to access FROM your
master.**

Choose one of the methods below:

---

## 🚀 Setup Method 1: One-Time Installation (Recommended for Single Device)

### Step 1: Navigate to the Script Directory

```bash
cd /Users/eli/wundr/scripts/remote-setup
```

### Step 2: Make the Script Executable

```bash
chmod +x setup_remote_mac.sh
```

### Step 3: Fill in Your Variables

Before running, have these ready:

- **TAILSCALE_AUTH_KEY**: `tskey-XXXXXXXXXXXXXXXXXXXXXXXXXXXX` (from step above)
- **DEVICE_NAME**: `studio-01` (or whatever you want to call this Mac)
- **TS_TAGS**: `tag:remote,tag:studio` (optional - for Tailscale ACL organization)

### Step 4: Run the Installation

Replace the values below with your actual information:

```bash
sudo ./setup_remote_mac.sh \
  --stack=parsec \
  --tailscale-auth-key="tskey-XXXXXXXXXXXXXXXXXXXXXXXXXXXX" \
  --device-name=studio-01 \
  --ts-tags="tag:remote,tag:studio" \
  --unattended
```

**Using RustDesk instead?** Change `--stack=parsec` to `--stack=rustdesk`

### Step 5: Follow On-Screen Prompts

The script will guide you through:

- Installing Tailscale and Parsec/RustDesk
- Approving TCC permissions (Screen Recording & Accessibility)
- Configuring auto-start services

### Step 6: Verify Installation

```bash
# Check that services are running
sudo launchctl list | grep com.adaptic
tailscale status

# View installation logs
less /var/log/remote-setup/install.log
```

✅ **Done!** Your Mac is now configured for remote access.

---

## 🔄 Setup Method 2: Reusable Configuration (Recommended for Multiple Devices)

This method is better if you're setting up multiple Macs or want to save your configuration.

### Step 1: Navigate to the Script Directory

```bash
cd /Users/eli/wundr/scripts/remote-setup
```

### Step 2: Make the Script Executable

```bash
chmod +x setup_remote_mac.sh
```

### Step 3: Create Your Configuration File

```bash
# Copy the example template
cp .env.example .env.local

# Open it in your editor
nano .env.local
# Or use: code .env.local (VS Code)
# Or use: open -e .env.local (TextEdit)
```

### Step 4: Fill in Your Values

Edit `.env.local` to look like this (replace with your actual values):

```bash
# Tailscale Configuration (Required for unattended setup)
export TAILSCALE_AUTH_KEY="tskey-auth-XXXXXXXXXXXXXXXXXXXXXXXXXXXX"
export DEVICE_NAME="studio-01"
export TS_TAGS="tag:remote,tag:studio"

# RustDesk Configuration (Optional - only if using RustDesk with custom servers)
# export RUSTDESK_ID_SERVER="id.example.com"
# export RUSTDESK_RELAY_SERVER="relay.example.com"

# Power Settings (Optional - these are the defaults)
export PREVENT_SLEEP="true"
export DISPLAY_SLEEP_MINS="10"

# Stack Selection (Optional - default is parsec)
export STACK="parsec"  # or "rustdesk"
```

### Step 5: Secure Your Configuration File

```bash
# Make it readable only by you
chmod 600 .env.local

# Verify it won't be committed to git
cat .gitignore | grep .env.local
```

### Step 6: Run the Installation

```bash
# Load your configuration
source .env.local

# Run the setup (preserving environment variables with -E)
sudo -E ./setup_remote_mac.sh --unattended
```

### Step 7: Verify Installation

```bash
# Check that services are running
sudo launchctl list | grep com.adaptic
tailscale status

# View installation logs
less /var/log/remote-setup/install.log
```

✅ **Done!** Your Mac is now configured for remote access.

### For Additional Devices

When setting up another Mac, just update the `DEVICE_NAME` in `.env.local`:

```bash
# Edit the config
nano .env.local

# Change DEVICE_NAME to something unique
export DEVICE_NAME="studio-02"  # or "mini-01", etc.

# Run setup again
source .env.local
sudo -E ./setup_remote_mac.sh --unattended
```

---

## 🔍 Interactive Setup (No Auth Key Required)

If you prefer to sign in manually instead of using an auth key:

```bash
cd /Users/eli/wundr/scripts/remote-setup

sudo ./setup_remote_mac.sh \
  --stack=parsec \
  --device-name=studio-01
```

The script will:

1. Install Tailscale and open your browser for sign-in
2. Install Parsec and guide you through first-time setup
3. Prompt you to approve TCC permissions manually

---

## 🛠️ Common Options

### Choose Your Remote Desktop Stack

**Parsec (Default - Best for low latency)**

```bash
--stack=parsec
```

**RustDesk (Open-source alternative)**

```bash
--stack=rustdesk
```

### Prevent System Sleep

```bash
--prevent-sleep=true          # Keep Mac awake (default)
--prevent-sleep=false         # Allow sleep
--display-sleep-mins=10       # Display sleeps after 10 min (default)
```

### Verify Before Installing

Test what would be installed without making changes:

```bash
sudo ./setup_remote_mac.sh \
  --stack=parsec \
  --device-name=studio-01 \
  --verify-only
```

---

## ✅ Post-Installation: Approve TCC Permissions

macOS requires manual approval for remote desktop apps:

### For Parsec:

1. The script will open **System Settings → Privacy & Security**
2. Click **Screen Recording** → Enable **Parsec**
3. Click **Accessibility** → Enable **Parsec**
4. Restart Parsec if prompted

### For RustDesk:

1. The script will open **System Settings → Privacy & Security**
2. Click **Screen Recording** → Enable **RustDesk**
3. Click **Accessibility** → Enable **RustDesk**
4. Restart RustDesk if prompted

**Note:** This manual step is required by macOS security and cannot be automated without MDM.

---

## 🖥️ Connecting from Your Client Mac

### One-Time Client Setup

```bash
# Install Tailscale
brew install --cask tailscale
# Sign in to the same Tailscale account

# Install Parsec (if using Parsec)
brew install --cask parsec

# OR install RustDesk (if using RustDesk)
brew install --cask rustdesk
```

### Connect via Parsec

1. Launch Parsec on your client Mac
2. Sign in with the same account
3. Your remote Mac appears under **Computers**
4. Click to connect

### Connect via RustDesk

1. Launch RustDesk on your client Mac
2. Enter the connection ID or Tailscale IP
3. Accept the connection (first time)
4. Save credentials for unattended access

---

## 🔧 Troubleshooting

### Check Service Status

```bash
# Check LaunchDaemons
sudo launchctl list | grep com.adaptic

# Check Tailscale
tailscale status

# View logs
tail -f /var/log/remote-setup/parsec.log
tail -f /var/log/remote-setup/install.log
```

### Restart Services

```bash
# Restart Parsec
sudo launchctl unload /Library/LaunchDaemons/com.adaptic.parsec.plist
sudo launchctl load -w /Library/LaunchDaemons/com.adaptic.parsec.plist

# Restart Tailscale
sudo launchctl unload /Library/LaunchDaemons/com.tailscale.tailscaled.plist
sudo launchctl load -w /Library/LaunchDaemons/com.tailscale.tailscaled.plist
```

### Black Screen or Low Resolution

**Solution:** Use an HDMI dummy plug (~$10 on Amazon)

- Enables proper display resolution for headless Macs
- Prevents black screen issues
- Recommended: 4K 60Hz dummy plug

### Can't Connect via Tailscale

```bash
# Check connectivity
tailscale ping <device-name>

# Check if Tailscale is up
tailscale status

# Re-authenticate if needed
sudo tailscale up
```

---

## 🗑️ Uninstallation

### Keep Apps, Remove Auto-Start

```bash
sudo ./uninstall_remote_mac.sh
```

### Complete Removal

```bash
sudo ./uninstall_remote_mac.sh \
  --remove-apps \
  --revert-pmset \
  --remove-logs \
  --yes
```

---

## 📚 Additional Resources

- **Full Documentation:** See [README.md](README.md) for advanced configuration
- **Tailscale Docs:** https://tailscale.com/kb
- **Parsec Docs:** https://support.parsec.app
- **RustDesk Docs:** https://rustdesk.com/docs

---

## 🆘 Getting Help

1. Check troubleshooting section above
2. Review logs in `/var/log/remote-setup/`
3. Run verification: `sudo ./setup_remote_mac.sh --verify-only`
4. Check service status: `sudo launchctl list | grep com.adaptic`

---

## 🔒 Security Notes

- **Never commit `.env.local`** - It contains your auth key
- Use **ephemeral + reusable** auth keys for better security
- Set **expiration dates** on auth keys (e.g., 90 days)
- Use **Tailscale ACL tags** to restrict access
- Enable **MFA** on your Parsec/RustDesk account
- Keep **software updated** regularly

---

**Questions?** Check the [full README.md](README.md) or review installation logs.

**Version:** 1.0.0 **Last Updated:** 2025-10-24
