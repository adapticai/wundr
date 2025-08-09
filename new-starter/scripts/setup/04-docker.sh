#!/bin/bash

set -euo pipefail
# Get the directory of this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# Source common utilities
source "${SCRIPT_DIR}/scripts/setup/common.sh"
log() {
    echo -e "[DOCKER] $1" | tee -a "$LOG_FILE"
}

install_docker_desktop() {
    log "Installing Docker Desktop..."
    
    if [[ "$OS" == "macos" ]]; then
        if [[ -d "/Applications/Docker.app" ]]; then
            log "Docker Desktop already installed"
        else
            brew install --cask docker
            
            log "Starting Docker Desktop..."
            open -a Docker
            
            log "Waiting for Docker to start (this may take a minute)..."
            local max_attempts=30
            local attempt=0
            
            while ! docker system info &>/dev/null && [[ $attempt -lt $max_attempts ]]; do
                sleep 2
                ((attempt++))
            done
            
            if docker system info &>/dev/null; then
                log "Docker Desktop started successfully"
            else
                log "Warning: Docker Desktop did not start automatically. Please start it manually."
            fi
        fi
    elif [[ "$OS" == "linux" ]]; then
        log "Installing Docker Engine for Linux..."
        
        sudo apt-get update
        sudo apt-get install -y \
            ca-certificates \
            curl \
            gnupg \
            lsb-release
        
        sudo mkdir -m 0755 -p /etc/apt/keyrings
        curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
        
        echo \
          "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
          $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
        
        sudo apt-get update
        sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
        
        sudo usermod -aG docker "$USER"
        
        log "Docker Engine installed. Please log out and back in for group changes to take effect."
    fi
}

configure_docker() {
    log "Configuring Docker settings..."
    
    mkdir -p "$HOME/.docker"
    
    cat > "$HOME/.docker/config.json" << EOF
{
    "credsStore": "osxkeychain",
    "experimental": "enabled",
    "stackOrchestrator": "swarm",
    "detachKeys": "ctrl-z,z",
    "features": {
        "buildkit": true
    }
}
EOF
    
    if [[ "$OS" == "macos" ]]; then
        cat > "$HOME/.docker/daemon.json" << EOF
{
    "builder": {
        "gc": {
            "defaultKeepStorage": "20GB",
            "enabled": true
        }
    },
    "experimental": true,
    "features": {
        "buildkit": true
    },
    "log-driver": "json-file",
    "log-opts": {
        "max-size": "10m",
        "max-file": "3"
    }
}
EOF
    fi
}

install_docker_compose() {
    log "Installing Docker Compose..."
    
    if command -v docker-compose &> /dev/null; then
        log "Docker Compose already installed"
    else
        if [[ "$OS" == "macos" ]]; then
            brew install docker-compose
        else
            sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
            sudo chmod +x /usr/local/bin/docker-compose
        fi
    fi
    
    log "Docker Compose installed"
}

install_docker_tools() {
    log "Installing Docker development tools..."
    
    local tools=(
        "dive"
        "lazydocker"
        "ctop"
        "docker-slim"
    )
    
    for tool in "${tools[@]}"; do
        if brew list "$tool" &>/dev/null; then
            log "$tool already installed"
        else
            log "Installing $tool..."
            brew install "$tool" || log "Failed to install $tool"
        fi
    done
}

setup_docker_aliases() {
    log "Setting up Docker aliases..."
    
    cat >> "$HOME/.zshrc" << 'EOF'

# Docker aliases
alias d='docker'
alias dc='docker-compose'
alias dps='docker ps'
alias dpsa='docker ps -a'
alias di='docker images'
alias dex='docker exec -it'
alias dl='docker logs'
alias dlf='docker logs -f'
alias dcp='docker cp'
alias drm='docker rm'
alias drmi='docker rmi'
alias dprune='docker system prune -a'
alias dstop='docker stop $(docker ps -q)'
alias dkill='docker kill $(docker ps -q)'
alias drmall='docker rm $(docker ps -aq)'
alias drmiall='docker rmi $(docker images -q)'

# Docker Compose aliases
alias dcup='docker-compose up'
alias dcupd='docker-compose up -d'
alias dcdown='docker-compose down'
alias dcdownv='docker-compose down -v'
alias dcps='docker-compose ps'
alias dclogs='docker-compose logs'
alias dclogsf='docker-compose logs -f'
alias dcrestart='docker-compose restart'
alias dcbuild='docker-compose build'
alias dcpull='docker-compose pull'

# Docker functions
dsh() {
    docker exec -it "$1" /bin/sh
}

dbash() {
    docker exec -it "$1" /bin/bash
}

dclean() {
    docker system prune -af --volumes
}

docker-ip() {
    docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' "$1"
}
EOF
    
    cp "$HOME/.zshrc" "$HOME/.bashrc"
}

create_docker_templates() {
    log "Creating Docker templates..."
    
    mkdir -p "${SCRIPT_DIR}/templates/docker"
    
    cat > "${SCRIPT_DIR}/templates/docker/Dockerfile.node" << 'EOF'
FROM node:lts-alpine AS base

RUN apk add --no-cache libc6-compat
WORKDIR /app

FROM base AS deps
COPY package*.json ./
RUN npm ci --only=production

FROM base AS build
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM base AS runtime
ENV NODE_ENV production
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

COPY --from=deps --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=nodejs:nodejs /app/dist ./dist
COPY --chown=nodejs:nodejs package*.json ./

USER nodejs
EXPOSE 3000
CMD ["node", "dist/index.js"]
EOF
    
    cat > "${SCRIPT_DIR}/templates/docker/docker-compose.yml" << 'EOF'
version: '3'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
    volumes:
      - .:/app
      - /app/node_modules
    networks:
      - app-network

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: dev
      POSTGRES_PASSWORD: devpass
      POSTGRES_DB: devdb
    ports:
      - "5432:5432"
    volumes:
      - postgres-data:/var/lib/postgresql/data
    networks:
      - app-network

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    networks:
      - app-network

volumes:
  postgres-data:

networks:
  app-network:
    driver: bridge
EOF
    
    cat > "${SCRIPT_DIR}/templates/docker/.dockerignore" << 'EOF'
node_modules
npm-debug.log
.env
.env.*
!.env.example
.git
.gitignore
README.md
.vscode
.idea
coverage
.nyc_output
dist
build
*.log
.DS_Store
EOF
}

main() {
    log "Starting Docker setup..."
    
    install_docker_desktop
    
    if command -v docker &> /dev/null || [[ "$OS" == "linux" ]]; then
        configure_docker
        install_docker_compose
        install_docker_tools
        setup_docker_aliases
        create_docker_templates
        
        log "Docker setup completed"
    else
        log "Warning: Docker installation requires manual start. Please start Docker Desktop and re-run this script."
    fi
}

main