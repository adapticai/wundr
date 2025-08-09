# Profile Setup Guide

## Overview
The new profile setup feature adds personalized profile generation and Mac customization to the new-starter setup process. This creates a fully personalized development environment for each engineer.

## Features Added

### 1. AI-Generated Profile Photo
- Uses OpenAI's DALL-E 3 to generate a professional headshot
- Based on:
  - Developer's name (from input)
  - Random age between 22-55
  - Random location from: San Francisco, New York, London, Sydney, or Singapore
  - Role and job title (from input)
- Creates multiple sizes for different platforms:
  - Original (1024x1024)
  - Slack (512x512)
  - Gmail (250x250)
  - Avatar (128x128)

### 2. Slack Profile Integration
- Automatically updates Slack profile with:
  - Generated profile photo
  - Name
  - Role/Title
  - Job description
  - Company information
- Requires `SLACK_USER_TOKEN` environment variable

### 3. Gmail Profile Setup
- Configures Gmail signature with:
  - Name
  - Role
  - Job title description
- Sets up for future profile photo integration
- Requires Gmail API credentials

### 4. Mac Personalization
- Sets computer name based on user's name
- Creates personalized desktop wallpaper
- Configures Dock with developer tools
- Sets up productivity hot corners
- Creates custom Terminal profile with aliases
- Generates welcome message on terminal startup

### 5. GitHub Username Storage
- Now properly stores GitHub username from user input
- No manual signup required
- Username is used throughout the setup process

## Setup Requirements

### Environment Variables
Set these before running the profile setup:

```bash
# Required for profile photo generation
export OPENAI_API_KEY="your-openai-api-key"

# Required for Slack profile update
export SLACK_USER_TOKEN="xoxp-your-slack-user-token"

# Optional for Gmail setup
# Download credentials from Google Cloud Console
# Save as ~/.gmail_credentials.json
```

### New Input Parameters
The setup now prompts for:
- **Role**: Your position (default: "Software Engineer")
- **Job Title**: Your job description (default: "Building amazing software")

These are passed throughout the setup process and used in profile generation.

## Usage

### Running the Complete Setup
```bash
npm run setup
```

The setup will now include the profile personalization step automatically.

### Running Profile Setup Separately
If you want to run just the profile setup:
```bash
./scripts/setup/12-profile-setup.sh
```

### Excluding Profile Setup
If you want to skip profile setup:
```bash
npm run setup -- --exclude profile
```

## Files Created

The profile setup creates the following files:

### Profile Photos
- `~/.profile_photos/profile_original.png` - Original AI-generated image
- `~/.profile_photos/profile_slack.png` - Slack-sized version
- `~/.profile_photos/profile_gmail.png` - Gmail-sized version
- `~/.profile_photos/profile_avatar.png` - Small avatar version

### Wallpapers
- `~/.wallpapers/personalized_wallpaper.png` - Custom desktop wallpaper

### Configuration Files
- `~/.terminal_profile` - Terminal customizations and aliases
- `~/.welcome` - Welcome script shown on terminal startup

### Python Scripts (created during setup)
- `scripts/utils/generate_profile.py` - Profile photo generation
- `scripts/utils/update_slack_profile.py` - Slack profile updater
- `scripts/utils/update_gmail_profile.py` - Gmail profile updater
- `scripts/utils/create_wallpaper.py` - Wallpaper generator

## Troubleshooting

### OpenAI API Key Not Set
If you see "OPENAI_API_KEY not set", you need to:
1. Get an API key from https://platform.openai.com/api-keys
2. Set it: `export OPENAI_API_KEY='your-key'`
3. Re-run the setup

### Slack Token Not Set
To get a Slack user token:
1. Go to https://api.slack.com/apps
2. Create or select your app
3. Go to "OAuth & Permissions"
4. Copy the "User OAuth Token" (starts with xoxp-)
5. Set it: `export SLACK_USER_TOKEN='your-token'`

### Gmail Setup
For Gmail integration:
1. Enable Gmail API in Google Cloud Console
2. Create credentials (OAuth 2.0)
3. Download credentials as JSON
4. Save as `~/.gmail_credentials.json`
5. Run the setup - it will open a browser for authorization

## Customization

You can customize the profile generation by modifying:
- `scripts/setup/12-profile-setup.sh` - Main setup logic
- Profile photo prompt in `generate_profile.py`
- Wallpaper design in `create_wallpaper.py`
- Terminal aliases in the `setup_terminal_profile` function

## Security Notes

- API keys and tokens are never stored in the repository
- Profile photos are stored locally in your home directory
- Gmail credentials use OAuth 2.0 for secure authentication
- All sensitive data stays on your local machine

## Next Steps

After setup completes:
1. Restart your terminal to see the welcome message
2. Check your Slack profile for the updated photo
3. Open Gmail to see your new signature
4. Enjoy your personalized Mac environment!

For any issues or questions, please refer to the main setup documentation or create an issue in the repository.