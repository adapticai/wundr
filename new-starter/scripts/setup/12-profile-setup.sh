#!/bin/bash

set -euo pipefail
# Get the directory of this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# Source common utilities
source "${SCRIPT_DIR}/scripts/setup/common.sh"
log() {
    echo -e "[PROFILE] $1" | tee -a "$LOG_FILE"
}

# Generate random values for profile
generate_random_profile() {
    # Random age between 22 and 55
    RANDOM_AGE=$((22 + RANDOM % 34))
    
    # Random location
    LOCATIONS=("San Francisco" "New York" "London" "Sydney" "Singapore")
    RANDOM_LOCATION="${LOCATIONS[$((RANDOM % ${#LOCATIONS[@]}))]}"
    
    log "Generated profile: Age ${RANDOM_AGE}, Location: ${RANDOM_LOCATION}"
    
    # Export for use in other functions
    export PROFILE_AGE="${RANDOM_AGE}"
    export PROFILE_LOCATION="${RANDOM_LOCATION}"
}

# Install Python dependencies for image generation
install_dependencies() {
    log "Installing profile generation dependencies..."
    
    # Ensure pip is installed
    if ! command -v pip3 &> /dev/null; then
        python3 -m ensurepip --upgrade
    fi
    
    # Install required packages
    pip3 install --quiet openai pillow requests google-auth google-auth-oauthlib google-auth-httplib2 google-api-python-client slack-sdk
    
    log "Dependencies installed"
}

# Generate profile photo using OpenAI
generate_profile_photo() {
    log "Generating profile photo using OpenAI..."
    
    # Create profile generation script
    cat > "${SCRIPT_DIR}/scripts/utils/generate_profile.py" << 'EOF'
#!/usr/bin/env python3
import os
import sys
import json
import base64
import requests
from openai import OpenAI
from PIL import Image
from io import BytesIO

def generate_profile_image():
    # Get environment variables
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        print("Error: OPENAI_API_KEY not set")
        sys.exit(1)
    
    name = os.environ.get("SETUP_FULL_NAME", "Developer")
    age = os.environ.get("PROFILE_AGE", "30")
    location = os.environ.get("PROFILE_LOCATION", "San Francisco")
    role = os.environ.get("SETUP_ROLE", "Software Engineer")
    
    # Initialize OpenAI client
    client = OpenAI(api_key=api_key)
    
    # Generate professional headshot prompt
    prompt = f"""Professional headshot portrait of a {age} year old {role} named {name} 
    based in {location}. Professional business attire, friendly smile, modern office background, 
    high quality photography, corporate style, LinkedIn profile photo style. 
    Clean background, well-lit, professional appearance."""
    
    try:
        # Generate image using DALL-E 3
        response = client.images.generate(
            model="dall-e-3",
            prompt=prompt,
            size="1024x1024",
            quality="standard",
            n=1,
        )
        
        # Get image URL
        image_url = response.data[0].url
        
        # Download image
        img_response = requests.get(image_url)
        img = Image.open(BytesIO(img_response.content))
        
        # Save in multiple sizes
        profile_dir = os.path.expanduser("~/.profile_photos")
        os.makedirs(profile_dir, exist_ok=True)
        
        # Original size
        img.save(f"{profile_dir}/profile_original.png")
        
        # Slack size (512x512)
        img_slack = img.resize((512, 512), Image.Resampling.LANCZOS)
        img_slack.save(f"{profile_dir}/profile_slack.png")
        
        # Gmail size (250x250)
        img_gmail = img.resize((250, 250), Image.Resampling.LANCZOS)
        img_gmail.save(f"{profile_dir}/profile_gmail.png")
        
        # Avatar size (128x128)
        img_avatar = img.resize((128, 128), Image.Resampling.LANCZOS)
        img_avatar.save(f"{profile_dir}/profile_avatar.png")
        
        print(f"Profile photos generated successfully in {profile_dir}")
        return True
        
    except Exception as e:
        print(f"Error generating profile photo: {e}")
        return False

if __name__ == "__main__":
    success = generate_profile_image()
    sys.exit(0 if success else 1)
EOF
    
    chmod +x "${SCRIPT_DIR}/scripts/utils/generate_profile.py"
    
    # Check if OpenAI API key is set
    if [[ -z "${OPENAI_API_KEY:-}" ]]; then
        log "Warning: OPENAI_API_KEY not set. Please set it to generate profile photo."
        log "You can set it by running: export OPENAI_API_KEY='your-api-key'"
        return 1
    fi
    
    # Run the profile generation script
    if python3 "${SCRIPT_DIR}/scripts/utils/generate_profile.py"; then
        log "Profile photo generated successfully"
        export PROFILE_PHOTO_PATH="$HOME/.profile_photos/profile_original.png"
        export PROFILE_PHOTO_SLACK="$HOME/.profile_photos/profile_slack.png"
        export PROFILE_PHOTO_GMAIL="$HOME/.profile_photos/profile_gmail.png"
        export PROFILE_PHOTO_AVATAR="$HOME/.profile_photos/profile_avatar.png"
    else
        log "Failed to generate profile photo"
        return 1
    fi
}

# Update Slack profile with photo and details
update_slack_profile() {
    log "Updating Slack profile..."
    
    cat > "${SCRIPT_DIR}/scripts/utils/update_slack_profile.py" << 'EOF'
#!/usr/bin/env python3
import os
import sys
from slack_sdk import WebClient
from slack_sdk.errors import SlackApiError

def update_slack_profile():
    # Get Slack token
    slack_token = os.environ.get("SLACK_USER_TOKEN")
    if not slack_token:
        print("Warning: SLACK_USER_TOKEN not set. Skipping Slack profile update.")
        return False
    
    client = WebClient(token=slack_token)
    
    try:
        # Get user info
        name = os.environ.get("SETUP_FULL_NAME", "")
        role = os.environ.get("SETUP_ROLE", "Software Engineer")
        job_title = os.environ.get("SETUP_JOB_TITLE", "Building amazing software")
        company = os.environ.get("SETUP_COMPANY", "")
        photo_path = os.environ.get("PROFILE_PHOTO_SLACK", "")
        
        # Update profile fields
        profile = {
            "real_name": name,
            "title": role,
            "status_text": job_title,
            "status_emoji": ":computer:"
        }
        
        if company:
            profile["fields"] = {
                "Xf0COMPANY": {
                    "value": company,
                    "alt": ""
                }
            }
        
        # Update profile
        response = client.users_profile_set(profile=profile)
        
        # Upload profile photo if available
        if photo_path and os.path.exists(photo_path):
            with open(photo_path, "rb") as f:
                client.users_setPhoto(image=f.read())
            print("Slack profile photo updated")
        
        print("Slack profile updated successfully")
        return True
        
    except SlackApiError as e:
        print(f"Error updating Slack profile: {e.response['error']}")
        return False

if __name__ == "__main__":
    update_slack_profile()
EOF
    
    chmod +x "${SCRIPT_DIR}/scripts/utils/update_slack_profile.py"
    python3 "${SCRIPT_DIR}/scripts/utils/update_slack_profile.py"
}

# Update Gmail profile
update_gmail_profile() {
    log "Setting up Gmail profile update..."
    
    cat > "${SCRIPT_DIR}/scripts/utils/update_gmail_profile.py" << 'EOF'
#!/usr/bin/env python3
import os
import sys
import pickle
import base64
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

SCOPES = ['https://www.googleapis.com/auth/gmail.settings.basic',
          'https://www.googleapis.com/auth/userinfo.profile']

def update_gmail_profile():
    creds = None
    token_path = os.path.expanduser("~/.gmail_token.pickle")
    
    # Token file stores the user's access and refresh tokens
    if os.path.exists(token_path):
        with open(token_path, 'rb') as token:
            creds = pickle.load(token)
    
    # If there are no (valid) credentials available, let the user log in
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            # Check if credentials file exists
            creds_file = os.path.expanduser("~/.gmail_credentials.json")
            if not os.path.exists(creds_file):
                print("Gmail credentials file not found.")
                print("Please download credentials from Google Cloud Console and save as ~/.gmail_credentials.json")
                return False
            
            flow = InstalledAppFlow.from_client_secrets_file(creds_file, SCOPES)
            creds = flow.run_local_server(port=0)
        
        # Save the credentials for the next run
        with open(token_path, 'wb') as token:
            pickle.dump(creds, token)
    
    try:
        # Build Gmail API service
        service = build('gmail', 'v1', credentials=creds)
        
        # Get user info
        name = os.environ.get("SETUP_FULL_NAME", "")
        role = os.environ.get("SETUP_ROLE", "Software Engineer")
        job_title = os.environ.get("SETUP_JOB_TITLE", "")
        
        # Create signature
        signature = f"""
<div style="font-family: Arial, sans-serif;">
    <p style="margin: 0; font-weight: bold; color: #333;">{name}</p>
    <p style="margin: 0; color: #666;">{role}</p>
    <p style="margin: 0; font-style: italic; color: #888; font-size: 0.9em;">{job_title}</p>
</div>
"""
        
        # Update signature
        signature_encoded = base64.urlsafe_b64encode(signature.encode()).decode()
        
        send_as_email = os.environ.get("SETUP_GITHUB_EMAIL", "")
        if send_as_email:
            try:
                service.users().settings().sendAs().update(
                    userId='me',
                    sendAsEmail=send_as_email,
                    body={'signature': signature}
                ).execute()
                print("Gmail signature updated successfully")
            except Exception as e:
                print(f"Note: Could not update signature for {send_as_email}: {e}")
        
        return True
        
    except Exception as e:
        print(f"Error updating Gmail profile: {e}")
        return False

if __name__ == "__main__":
    update_gmail_profile()
EOF
    
    chmod +x "${SCRIPT_DIR}/scripts/utils/update_gmail_profile.py"
    
    log "Gmail profile update script created"
    log "Note: You'll need to set up Gmail API credentials to use this feature"
    
    # Try to run the update
    if python3 "${SCRIPT_DIR}/scripts/utils/update_gmail_profile.py"; then
        log "Gmail profile updated"
    else
        log "Gmail profile update skipped (credentials may be needed)"
    fi
}

# Set up personalized Mac settings
personalize_mac() {
    log "Personalizing Mac settings..."
    
    if [[ "$OS" != "macos" ]]; then
        log "Skipping Mac personalization (not on macOS)"
        return
    fi
    
    # Set computer name
    if [[ -n "${SETUP_FULL_NAME:-}" ]]; then
        COMPUTER_NAME="${SETUP_FULL_NAME}'s Mac"
        sudo scutil --set ComputerName "$COMPUTER_NAME"
        sudo scutil --set HostName "${SETUP_GITHUB_USERNAME:-mac}"
        sudo scutil --set LocalHostName "${SETUP_GITHUB_USERNAME:-mac}"
        sudo defaults write /Library/Preferences/SystemConfiguration/com.apple.smb.server NetBIOSName -string "${SETUP_GITHUB_USERNAME:-MAC}"
        log "Computer name set to: $COMPUTER_NAME"
    fi
    
    # Set user profile picture if generated
    if [[ -f "${PROFILE_PHOTO_AVATAR:-}" ]]; then
        log "Setting user account picture..."
        # This requires admin privileges and is system-specific
        dscl . -delete /Users/"$USER" JPEGPhoto 2>/dev/null || true
        dscl . -delete /Users/"$USER" Picture 2>/dev/null || true
        dscl . -create /Users/"$USER" Picture "$PROFILE_PHOTO_AVATAR"
        log "User account picture updated"
    fi
    
    # Set desktop wallpaper (create a personalized one)
    create_wallpaper
    
    # Configure Dock with developer tools
    configure_dock
    
    # Set up hot corners for productivity
    setup_hot_corners
    
    # Configure Terminal/iTerm2 profile
    setup_terminal_profile
    
    log "Mac personalization completed"
}

# Create personalized wallpaper
create_wallpaper() {
    log "Creating personalized wallpaper..."
    
    cat > "${SCRIPT_DIR}/scripts/utils/create_wallpaper.py" << 'EOF'
#!/usr/bin/env python3
import os
from PIL import Image, ImageDraw, ImageFont
import colorsys
import random

def create_wallpaper():
    # Get screen resolution (default to common size)
    width, height = 2880, 1800  # MacBook Pro 15" resolution
    
    # Create gradient background
    img = Image.new('RGB', (width, height))
    draw = ImageDraw.Draw(img)
    
    # Generate personalized color scheme based on name
    name = os.environ.get("SETUP_FULL_NAME", "Developer")
    name_hash = sum(ord(c) for c in name)
    hue = (name_hash % 360) / 360
    
    # Create gradient
    for y in range(height):
        progress = y / height
        # Adjust saturation and lightness for gradient
        r, g, b = colorsys.hsv_to_rgb(hue, 0.4 - progress * 0.2, 0.3 + progress * 0.3)
        color = (int(r * 255), int(g * 255), int(b * 255))
        draw.rectangle([(0, y), (width, y + 1)], fill=color)
    
    # Add subtle pattern
    for _ in range(50):
        x = random.randint(0, width)
        y = random.randint(0, height)
        size = random.randint(50, 200)
        opacity = random.randint(5, 20)
        overlay = Image.new('RGBA', (width, height), (255, 255, 255, 0))
        overlay_draw = ImageDraw.Draw(overlay)
        overlay_draw.ellipse([(x - size, y - size), (x + size, y + size)], 
                            fill=(255, 255, 255, opacity))
        img = Image.alpha_composite(img.convert('RGBA'), overlay).convert('RGB')
    
    # Add personalized text
    try:
        # Try to use a nice font if available
        font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 120)
        small_font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 40)
    except:
        font = ImageFont.load_default()
        small_font = font
    
    # Add welcome message
    text = f"Welcome, {name.split()[0]}!"
    text_width = draw.textlength(text, font=font)
    draw.text(((width - text_width) // 2, height // 2 - 100), 
              text, fill=(255, 255, 255, 200), font=font)
    
    # Add role
    role = os.environ.get("SETUP_ROLE", "Software Engineer")
    role_width = draw.textlength(role, font=small_font)
    draw.text(((width - role_width) // 2, height // 2 + 50), 
              role, fill=(255, 255, 255, 150), font=small_font)
    
    # Save wallpaper
    wallpaper_path = os.path.expanduser("~/.wallpapers")
    os.makedirs(wallpaper_path, exist_ok=True)
    img.save(f"{wallpaper_path}/personalized_wallpaper.png")
    
    print(f"Wallpaper created at {wallpaper_path}/personalized_wallpaper.png")
    return f"{wallpaper_path}/personalized_wallpaper.png"

if __name__ == "__main__":
    wallpaper_path = create_wallpaper()
    print(wallpaper_path)
EOF
    
    chmod +x "${SCRIPT_DIR}/scripts/utils/create_wallpaper.py"
    
    # Create wallpaper
    if WALLPAPER_PATH=$(python3 "${SCRIPT_DIR}/scripts/utils/create_wallpaper.py"); then
        # Set as desktop wallpaper
        osascript -e "tell application \"Finder\" to set desktop picture to POSIX file \"$WALLPAPER_PATH\""
        log "Desktop wallpaper set"
    fi
}

# Configure Dock with developer tools
configure_dock() {
    log "Configuring Dock..."
    
    # Set Dock preferences
    defaults write com.apple.dock tilesize -int 48
    defaults write com.apple.dock orientation -string "left"
    defaults write com.apple.dock minimize-to-application -bool true
    defaults write com.apple.dock show-recents -bool false
    defaults write com.apple.dock autohide -bool true
    defaults write com.apple.dock autohide-delay -float 0
    defaults write com.apple.dock autohide-time-modifier -float 0.5
    
    # Add developer apps to Dock (if they exist)
    APPS_TO_ADD=(
        "/Applications/Visual Studio Code.app"
        "/Applications/iTerm.app"
        "/Applications/Terminal.app"
        "/Applications/Docker.app"
        "/Applications/Slack.app"
        "/Applications/Google Chrome.app"
        "/Applications/Safari.app"
    )
    
    for app in "${APPS_TO_ADD[@]}"; do
        if [[ -e "$app" ]]; then
            defaults write com.apple.dock persistent-apps -array-add "<dict><key>tile-data</key><dict><key>file-data</key><dict><key>_CFURLString</key><string>$app</string><key>_CFURLStringType</key><integer>0</integer></dict></dict></dict>"
        fi
    done
    
    # Restart Dock
    killall Dock
    
    log "Dock configured"
}

# Set up hot corners
setup_hot_corners() {
    log "Setting up hot corners..."
    
    # Top left: Mission Control
    defaults write com.apple.dock wvous-tl-corner -int 2
    defaults write com.apple.dock wvous-tl-modifier -int 0
    
    # Top right: Desktop
    defaults write com.apple.dock wvous-tr-corner -int 4
    defaults write com.apple.dock wvous-tr-modifier -int 0
    
    # Bottom left: Application Windows
    defaults write com.apple.dock wvous-bl-corner -int 3
    defaults write com.apple.dock wvous-bl-modifier -int 0
    
    # Bottom right: Lock Screen
    defaults write com.apple.dock wvous-br-corner -int 13
    defaults write com.apple.dock wvous-br-modifier -int 0
    
    log "Hot corners configured"
}

# Setup Terminal profile
setup_terminal_profile() {
    log "Setting up Terminal profile..."
    
    # Create a custom Terminal profile
    cat > "$HOME/.terminal_profile" << 'EOF'
# Custom Terminal Profile
export PS1="\[\033[36m\]\u\[\033[m\]@\[\033[32m\]\h:\[\033[33;1m\]\w\[\033[m\]\$ "
export CLICOLOR=1
export LSCOLORS=ExFxBxDxCxegedabagacad

# Aliases
alias ll='ls -alF'
alias la='ls -A'
alias l='ls -CF'
alias ..='cd ..'
alias ...='cd ../..'
alias g='git'
alias gs='git status'
alias gd='git diff'
alias gc='git commit'
alias gp='git push'
alias gl='git log --oneline --graph'

# Functions
mkcd() { mkdir -p "$1" && cd "$1"; }
extract() {
    if [ -f $1 ]; then
        case $1 in
            *.tar.bz2)   tar xjf $1     ;;
            *.tar.gz)    tar xzf $1     ;;
            *.bz2)       bunzip2 $1     ;;
            *.rar)       unrar e $1     ;;
            *.gz)        gunzip $1      ;;
            *.tar)       tar xf $1      ;;
            *.tbz2)      tar xjf $1     ;;
            *.tgz)       tar xzf $1     ;;
            *.zip)       unzip $1       ;;
            *.Z)         uncompress $1  ;;
            *.7z)        7z x $1        ;;
            *)     echo "'$1' cannot be extracted" ;;
        esac
    else
        echo "'$1' is not a valid file"
    fi
}
EOF
    
    # Add to shell profile
    if [[ -f "$HOME/.zshrc" ]]; then
        echo "source $HOME/.terminal_profile" >> "$HOME/.zshrc"
    fi
    if [[ -f "$HOME/.bash_profile" ]]; then
        echo "source $HOME/.terminal_profile" >> "$HOME/.bash_profile"
    fi
    
    log "Terminal profile configured"
}

# Create welcome script
create_welcome_script() {
    log "Creating welcome script..."
    
    cat > "$HOME/.welcome" << EOF
#!/bin/bash
echo ""
echo "👋 Welcome back, ${SETUP_FULL_NAME}!"
echo "📍 Location: ${PROFILE_LOCATION}"
echo "💼 Role: ${SETUP_ROLE:-Software Engineer}"
echo ""
echo "Quick Commands:"
echo "  📂 cd ~/Development    - Go to your development directory"
echo "  🔧 new-starter validate - Check your setup"
echo "  💻 code .              - Open VS Code in current directory"
echo "  🐳 docker ps           - Check running containers"
echo ""
EOF
    
    chmod +x "$HOME/.welcome"
    
    # Add to shell profile
    if [[ -f "$HOME/.zshrc" ]]; then
        echo "$HOME/.welcome" >> "$HOME/.zshrc"
    fi
    
    log "Welcome script created"
}

main() {
    log "Starting profile setup..."
    
    # Generate random profile data
    generate_random_profile
    
    # Install dependencies
    install_dependencies
    
    # Generate profile photo if API key is available
    if [[ -n "${OPENAI_API_KEY:-}" ]]; then
        generate_profile_photo
    else
        log "Skipping profile photo generation (OPENAI_API_KEY not set)"
    fi
    
    # Update Slack profile
    update_slack_profile
    
    # Update Gmail profile
    update_gmail_profile
    
    # Personalize Mac settings
    personalize_mac
    
    # Create welcome script
    create_welcome_script
    
    log "Profile setup completed"
}

main