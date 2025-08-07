# Windows Installation Script for Wundr Environment
# Run with: Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser; .\windows.ps1

param(
    [string]$FullName = "",
    [string]$Email = "",
    [string]$Company = "",
    [switch]$SkipPrompts = $false
)

# Colors for output
$ErrorColor = "Red"
$SuccessColor = "Green"
$WarningColor = "Yellow"
$InfoColor = "Cyan"

# Logging functions
function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $coloredMessage = switch ($Level) {
        "ERROR" { Write-Host "[$timestamp] [ERROR] $Message" -ForegroundColor $ErrorColor }
        "SUCCESS" { Write-Host "[$timestamp] [SUCCESS] $Message" -ForegroundColor $SuccessColor }
        "WARNING" { Write-Host "[$timestamp] [WARNING] $Message" -ForegroundColor $WarningColor }
        default { Write-Host "[$timestamp] [INFO] $Message" -ForegroundColor $InfoColor }
    }
}

function Test-Administrator {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

# Check if running as administrator
if (-not (Test-Administrator)) {
    Write-Log "This script requires administrator privileges. Please run PowerShell as Administrator." "ERROR"
    exit 1
}

# Install Chocolatey
function Install-Chocolatey {
    Write-Log "Installing Chocolatey package manager..."
    
    if (Get-Command choco -ErrorAction SilentlyContinue) {
        Write-Log "Chocolatey already installed" "SUCCESS"
        choco upgrade chocolatey -y
        return
    }
    
    Set-ExecutionPolicy Bypass -Scope Process -Force
    [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
    Invoke-Expression ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
    
    # Add Chocolatey to PATH for current session
    $env:PATH += ";C:\ProgramData\chocolatey\bin"
    
    Write-Log "Chocolatey installed successfully" "SUCCESS"
}

# Install Winget (Windows Package Manager)
function Install-Winget {
    Write-Log "Checking Windows Package Manager (winget)..."
    
    if (Get-Command winget -ErrorAction SilentlyContinue) {
        Write-Log "Winget already available" "SUCCESS"
        return
    }
    
    Write-Log "Installing Windows Package Manager..."
    try {
        # Install from Microsoft Store
        $progressPreference = 'silentlyContinue'
        Invoke-WebRequest -Uri https://aka.ms/getwinget -OutFile winget.appxbundle
        Add-AppxPackage winget.appxbundle
        Remove-Item winget.appxbundle
        Write-Log "Winget installed successfully" "SUCCESS"
    }
    catch {
        Write-Log "Failed to install winget: $_" "WARNING"
    }
}

# Install core development tools
function Install-CoreTools {
    Write-Log "Installing core development tools..."
    
    $tools = @(
        "git",
        "gh",
        "curl",
        "wget",
        "jq",
        "ripgrep",
        "fd",
        "bat",
        "fzf"
    )
    
    foreach ($tool in $tools) {
        Write-Log "Installing $tool..."
        try {
            choco install $tool -y --no-progress
        }
        catch {
            Write-Log "Failed to install $tool via Chocolatey, trying winget..." "WARNING"
            try {
                winget install $tool --silent --accept-package-agreements --accept-source-agreements
            }
            catch {
                Write-Log "Failed to install $tool" "ERROR"
            }
        }
    }
}

# Install Node.js and package managers
function Install-NodeJS {
    Write-Log "Installing Node.js..."
    
    if (Get-Command node -ErrorAction SilentlyContinue) {
        Write-Log "Node.js already installed: $(node --version)" "SUCCESS"
    }
    else {
        choco install nodejs-lts -y --no-progress
        # Refresh environment variables
        $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("PATH", "User")
    }
    
    Write-Log "Installing package managers..."
    
    # Install pnpm
    if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
        npm install -g pnpm
    }
    
    # Install yarn
    if (-not (Get-Command yarn -ErrorAction SilentlyContinue)) {
        npm install -g yarn
    }
    
    Write-Log "Node.js and package managers installed" "SUCCESS"
}

# Install development applications
function Install-DevApps {
    Write-Log "Installing development applications..."
    
    $apps = @(
        "vscode",
        "docker-desktop",
        "postman",
        "slack",
        "zoom",
        "googlechrome",
        "firefox"
    )
    
    foreach ($app in $apps) {
        Write-Log "Installing $app..."
        try {
            choco install $app -y --no-progress
        }
        catch {
            Write-Log "Failed to install $app via Chocolatey, trying winget..." "WARNING"
            try {
                winget install $app --silent --accept-package-agreements --accept-source-agreements
            }
            catch {
                Write-Log "Failed to install $app" "ERROR"
            }
        }
    }
}

# Install Windows Terminal
function Install-WindowsTerminal {
    Write-Log "Installing Windows Terminal..."
    
    try {
        winget install Microsoft.WindowsTerminal --silent --accept-package-agreements --accept-source-agreements
        Write-Log "Windows Terminal installed" "SUCCESS"
    }
    catch {
        Write-Log "Failed to install Windows Terminal" "WARNING"
    }
}

# Install WSL2 (Windows Subsystem for Linux)
function Install-WSL2 {
    Write-Log "Installing WSL2..."
    
    try {
        # Enable WSL feature
        dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart
        
        # Enable Virtual Machine Platform
        dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart
        
        # Download and install WSL2 kernel update
        $wslUpdateUrl = "https://wslstorestorage.blob.core.windows.net/wslblob/wsl_update_x64.msi"
        Invoke-WebRequest -Uri $wslUpdateUrl -OutFile wsl_update_x64.msi
        Start-Process msiexec.exe -Wait -ArgumentList '/i wsl_update_x64.msi /quiet'
        Remove-Item wsl_update_x64.msi
        
        # Set WSL2 as default
        wsl --set-default-version 2
        
        # Install Ubuntu
        winget install Canonical.Ubuntu --silent --accept-package-agreements --accept-source-agreements
        
        Write-Log "WSL2 installed successfully. Please restart your computer and run 'wsl' to complete Ubuntu setup." "SUCCESS"
    }
    catch {
        Write-Log "Failed to install WSL2: $_" "ERROR"
    }
}

# Install Claude Code
function Install-ClaudeCode {
    Write-Log "Installing Claude Code..."
    
    if (Get-Command claude -ErrorAction SilentlyContinue) {
        Write-Log "Claude Code already installed" "SUCCESS"
        return
    }
    
    try {
        npm install -g @anthropic-ai/claude-code
        Write-Log "Claude Code installed successfully" "SUCCESS"
    }
    catch {
        Write-Log "Failed to install Claude Code via npm" "WARNING"
        try {
            # Try alternative installation method
            Invoke-WebRequest -Uri "https://claude.ai/install.ps1" -OutFile "claude-install.ps1"
            .\claude-install.ps1
            Remove-Item "claude-install.ps1"
        }
        catch {
            Write-Log "Failed to install Claude Code" "ERROR"
        }
    }
}

# Configure Git
function Configure-Git {
    Write-Log "Configuring Git..."
    
    if (-not $SkipPrompts) {
        if ([string]::IsNullOrEmpty($FullName)) {
            $FullName = Read-Host "Enter your full name for Git"
        }
        
        if ([string]::IsNullOrEmpty($Email)) {
            $Email = Read-Host "Enter your email for Git"
        }
    }
    
    if (![string]::IsNullOrEmpty($FullName)) {
        git config --global user.name "$FullName"
    }
    
    if (![string]::IsNullOrEmpty($Email)) {
        git config --global user.email "$Email"
    }
    
    git config --global init.defaultBranch main
    git config --global pull.rebase false
    git config --global core.autocrlf true
    git config --global core.editor "code --wait"
    
    Write-Log "Git configured" "SUCCESS"
}

# Setup PowerShell Profile
function Setup-PowerShellProfile {
    Write-Log "Setting up PowerShell profile..."
    
    # Create PowerShell profile if it doesn't exist
    if (!(Test-Path $PROFILE)) {
        New-Item -Path $PROFILE -Type File -Force
    }
    
    # Add aliases and functions to profile
    $profileContent = @'

# Development aliases
Set-Alias ll Get-ChildItem
Set-Alias la Get-ChildItem
function .. { Set-Location .. }
function ... { Set-Location ../.. }
function cls { Clear-Host }

# Git aliases
function g { git @args }
function gs { git status @args }
function ga { git add @args }
function gc { git commit @args }
function gp { git push @args }
function gl { git pull @args }
function gd { git diff @args }
function gb { git branch @args }
function gco { git checkout @args }

# Node aliases
function ni { npm install @args }
function nr { npm run @args }
function ns { npm start @args }
function nt { npm test @args }
function nb { npm run build @args }

# pnpm aliases
function pi { pnpm install @args }
function pr { pnpm run @args }
function ps { pnpm start @args }
function pt { pnpm test @args }
function pb { pnpm build @args }

# Docker aliases
function d { docker @args }
function dc { docker-compose @args }
function dps { docker ps @args }
function di { docker images @args }

# Set up prompt
function prompt {
    $currentPath = (Get-Location).Path.Replace($env:USERPROFILE, "~")
    $gitBranch = ""
    
    if (Get-Command git -ErrorAction SilentlyContinue) {
        try {
            $gitBranch = git rev-parse --abbrev-ref HEAD 2>$null
            if ($gitBranch) {
                $gitBranch = " [$gitBranch]"
            }
        }
        catch {
            $gitBranch = ""
        }
    }
    
    return "PS $currentPath$gitBranch> "
}
'@
    
    Add-Content -Path $PROFILE -Value $profileContent
    
    Write-Log "PowerShell profile configured" "SUCCESS"
}

# Configure Windows Terminal
function Configure-WindowsTerminal {
    Write-Log "Configuring Windows Terminal..."
    
    $terminalSettingsPath = "$env:LOCALAPPDATA\Packages\Microsoft.WindowsTerminal_8wekyb3d8bbwe\LocalState\settings.json"
    
    if (Test-Path $terminalSettingsPath) {
        $settingsTemplate = @{
            '$schema' = "https://aka.ms/terminal-profiles-schema"
            'defaultProfile' = "{61c54bbd-c2c6-5271-96e7-009a87ff44bf}"
            'profiles' = @{
                'defaults' = @{
                    'fontFace' = "Cascadia Code"
                    'fontSize' = 10
                    'colorScheme' = "Campbell Powershell"
                }
            }
            'schemes' = @()
            'keybindings' = @()
        }
        
        try {
            $settingsTemplate | ConvertTo-Json -Depth 10 | Set-Content $terminalSettingsPath
            Write-Log "Windows Terminal configured" "SUCCESS"
        }
        catch {
            Write-Log "Failed to configure Windows Terminal" "WARNING"
        }
    }
}

# Install development fonts
function Install-Fonts {
    Write-Log "Installing development fonts..."
    
    try {
        choco install cascadiacodepl -y --no-progress
        choco install firacode -y --no-progress
        Write-Log "Development fonts installed" "SUCCESS"
    }
    catch {
        Write-Log "Failed to install fonts" "WARNING"
    }
}

# Main installation function
function Main {
    Write-Log "Starting Windows environment installation..." "SUCCESS"
    Write-Log "This process may take several minutes..." "INFO"
    
    try {
        Install-Chocolatey
        Install-Winget
        Install-CoreTools
        Install-NodeJS
        Install-DevApps
        Install-WindowsTerminal
        Install-WSL2
        Install-ClaudeCode
        Configure-Git
        Setup-PowerShellProfile
        Configure-WindowsTerminal
        Install-Fonts
        
        Write-Log "Windows environment installation completed successfully!" "SUCCESS"
        Write-Log "Please restart your computer to ensure all changes take effect." "INFO"
        Write-Log "After restart, run Windows Terminal and execute 'wsl' to complete Ubuntu setup." "INFO"
    }
    catch {
        Write-Log "Installation failed: $_" "ERROR"
        exit 1
    }
}

# Run main function
Main