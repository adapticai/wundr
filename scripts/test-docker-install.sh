#!/bin/bash

# Test Docker installation script

set -e

echo "Testing Docker installation..."

# Check if Docker Desktop is already installed
if [[ -d "/Applications/Docker.app" ]]; then
    echo "✅ Docker Desktop already installed"
    docker --version || echo "Docker CLI not available"
else
    echo "Docker Desktop not found. Installing..."
    
    # Install Docker Desktop via Homebrew
    if command -v brew &> /dev/null; then
        echo "Installing Docker Desktop via Homebrew..."
        brew install --cask docker
        
        echo "Starting Docker Desktop..."
        open -a Docker
        
        echo "Waiting for Docker daemon to start..."
        max_attempts=30
        attempt=0
        
        while ! docker system info &>/dev/null && [[ $attempt -lt $max_attempts ]]; do
            echo -n "."
            sleep 2
            ((attempt++))
        done
        
        echo ""
        
        if docker system info &>/dev/null; then
            echo "✅ Docker Desktop installed and running!"
            docker --version
        else
            echo "⚠️ Docker Desktop installed but not running. Please start it manually."
        fi
    else
        echo "❌ Homebrew not found. Please install Homebrew first."
        exit 1
    fi
fi

echo "Done!"