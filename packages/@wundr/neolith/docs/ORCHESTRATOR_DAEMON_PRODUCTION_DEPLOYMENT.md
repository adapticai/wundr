# Orchestrator-Daemon Production Deployment Guide

**Version:** 1.0.3
**Package:** `@wundr.io/orchestrator-daemon`
**Date:** November 26, 2025

## Overview

This guide covers deploying Orchestrator-Daemon to 16 production machines for autonomous Orchestrator
(Orchestrator) operation. Each daemon manages one or more Orchestrators that can spawn Claude Code sessions to complete
tasks autonomously.

## Prerequisites

### Hardware Requirements (Per Machine)

- **CPU:** 4+ cores recommended
- **RAM:** 8GB minimum, 16GB recommended
- **Storage:** 50GB SSD minimum
- **Network:** Stable internet connection with low latency

### Software Requirements

- Node.js 20+ LTS
- npm 10+ or pnpm 9+
- Git
- Claude CLI (`npm install -g @anthropic-ai/claude-cli`)
- systemd (for daemon management on Linux)

## Installation

### 1. Install Orchestrator-Daemon Package

```bash
# Global installation
npm install -g @wundr.io/orchestrator-daemon

# Or with pnpm
pnpm add -g @wundr.io/orchestrator-daemon
```

### 2. Verify Installation

```bash
orchestrator-daemon --version
# Expected output: 1.0.3
```

### 3. Create Configuration Directory

```bash
mkdir -p /etc/orchestrator-daemon
mkdir -p /var/log/orchestrator-daemon
mkdir -p /var/lib/orchestrator-daemon/memory
```

## Configuration

### Environment Configuration

Create `/etc/orchestrator-daemon/.env`:

```bash
# =============================================================================
# Orchestrator-Daemon Production Configuration
# =============================================================================

# Neolith Backend Connection
NEOLITH_API_URL=https://api.neolith.ai
NEOLITH_WS_URL=wss://api.neolith.ai/ws
VP_DAEMON_AUTH_KEY=YOUR_DAEMON_AUTH_KEY

# Machine Identification
MACHINE_ID=orchestrator-machine-01
MACHINE_REGION=us-east-1

# Orchestrator Configuration
MAX_VPS_PER_MACHINE=4
VP_POLL_INTERVAL_MS=5000
VP_IDLE_TIMEOUT_MS=300000

# Claude Configuration
ANTHROPIC_API_KEY=YOUR_ANTHROPIC_API_KEY
CLAUDE_MODEL=claude-sonnet-4-20250514
MAX_TOKENS_PER_SESSION=100000

# Memory Configuration
MEMORY_PERSISTENCE_PATH=/var/lib/orchestrator-daemon/memory
MEMORY_BACKUP_INTERVAL_MS=60000

# Logging
LOG_LEVEL=info
LOG_FILE=/var/log/orchestrator-daemon/daemon.log
LOG_MAX_SIZE=100M
LOG_MAX_FILES=10

# Health Monitoring
HEALTH_CHECK_PORT=8080
METRICS_ENABLED=true
```

### Daemon Configuration File

Create `/etc/orchestrator-daemon/config.json`:

```json
{
  "version": "1.0.3",
  "machine": {
    "id": "orchestrator-machine-01",
    "region": "us-east-1",
    "tags": ["production", "primary"]
  },
  "connection": {
    "apiUrl": "https://api.neolith.ai",
    "wsUrl": "wss://api.neolith.ai/ws",
    "reconnectIntervalMs": 5000,
    "maxReconnectAttempts": 10,
    "heartbeatIntervalMs": 30000
  },
  "vp": {
    "maxPerMachine": 4,
    "pollIntervalMs": 5000,
    "idleTimeoutMs": 300000,
    "sessionTimeoutMs": 3600000
  },
  "claude": {
    "model": "claude-sonnet-4-20250514",
    "maxTokensPerSession": 100000,
    "temperature": 0.7,
    "maxConcurrentSessions": 2
  },
  "memory": {
    "persistencePath": "/var/lib/orchestrator-daemon/memory",
    "backupIntervalMs": 60000,
    "maxMemoryMB": 512,
    "compressionEnabled": true
  },
  "logging": {
    "level": "info",
    "file": "/var/log/orchestrator-daemon/daemon.log",
    "maxSize": "100M",
    "maxFiles": 10,
    "jsonFormat": true
  },
  "health": {
    "port": 8080,
    "metricsEnabled": true,
    "metricsPath": "/metrics"
  }
}
```

## Systemd Service Setup

### Create Service File

Create `/etc/systemd/system/orchestrator-daemon.service`:

```ini
[Unit]
Description=Orchestrator-Daemon - Orchestrator Daemon Service
Documentation=https://github.com/wundr/orchestrator-daemon
After=network.target
Wants=network-online.target

[Service]
Type=simple
User=orchestrator-daemon
Group=orchestrator-daemon
WorkingDirectory=/var/lib/orchestrator-daemon
EnvironmentFile=/etc/orchestrator-daemon/.env
ExecStart=/usr/bin/orchestrator-daemon start --config /etc/orchestrator-daemon/config.json
ExecStop=/usr/bin/orchestrator-daemon stop
ExecReload=/bin/kill -HUP $MAINPID

# Restart configuration
Restart=always
RestartSec=10
StartLimitInterval=300
StartLimitBurst=5

# Security hardening
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
ReadWritePaths=/var/lib/orchestrator-daemon /var/log/orchestrator-daemon

# Resource limits
LimitNOFILE=65535
LimitNPROC=4096
MemoryMax=4G
CPUQuota=200%

# Logging
StandardOutput=append:/var/log/orchestrator-daemon/stdout.log
StandardError=append:/var/log/orchestrator-daemon/stderr.log
SyslogIdentifier=orchestrator-daemon

[Install]
WantedBy=multi-user.target
```

### Create System User

```bash
# Create orchestrator-daemon user
sudo useradd -r -s /sbin/nologin -d /var/lib/orchestrator-daemon orchestrator-daemon

# Set ownership
sudo chown -R orchestrator-daemon:orchestrator-daemon /var/lib/orchestrator-daemon
sudo chown -R orchestrator-daemon:orchestrator-daemon /var/log/orchestrator-daemon
sudo chown -R orchestrator-daemon:orchestrator-daemon /etc/orchestrator-daemon
```

### Enable and Start Service

```bash
# Reload systemd
sudo systemctl daemon-reload

# Enable service to start on boot
sudo systemctl enable orchestrator-daemon

# Start the service
sudo systemctl start orchestrator-daemon

# Check status
sudo systemctl status orchestrator-daemon
```

## Deployment to 16 Machines

### Machine Naming Convention

| Machine ID      | Region    | Purpose              |
| --------------- | --------- | -------------------- |
| orchestrator-machine-01   | us-east-1 | Primary - Engineering |
| orchestrator-machine-02   | us-east-1 | Primary - Engineering |
| orchestrator-machine-03   | us-east-1 | Primary - Product    |
| orchestrator-machine-04   | us-east-1 | Primary - Operations |
| orchestrator-machine-05   | us-west-2 | Secondary - Engineering |
| orchestrator-machine-06   | us-west-2 | Secondary - Product  |
| orchestrator-machine-07   | us-west-2 | Secondary - Operations |
| orchestrator-machine-08   | us-west-2 | Secondary - General  |
| orchestrator-machine-09   | eu-west-1 | Europe - Engineering |
| orchestrator-machine-10   | eu-west-1 | Europe - Product     |
| orchestrator-machine-11   | eu-west-1 | Europe - Operations  |
| orchestrator-machine-12   | eu-west-1 | Europe - General     |
| orchestrator-machine-13   | ap-northeast-1 | APAC - Engineering |
| orchestrator-machine-14   | ap-northeast-1 | APAC - Product     |
| orchestrator-machine-15   | ap-northeast-1 | APAC - Operations  |
| orchestrator-machine-16   | ap-northeast-1 | APAC - General     |

### Deployment Script

Create `deploy-orchestrator-daemon.sh`:

```bash
#!/bin/bash
set -e

MACHINES=(
  "orchestrator-machine-01:us-east-1"
  "orchestrator-machine-02:us-east-1"
  "orchestrator-machine-03:us-east-1"
  "orchestrator-machine-04:us-east-1"
  "orchestrator-machine-05:us-west-2"
  "orchestrator-machine-06:us-west-2"
  "orchestrator-machine-07:us-west-2"
  "orchestrator-machine-08:us-west-2"
  "orchestrator-machine-09:eu-west-1"
  "orchestrator-machine-10:eu-west-1"
  "orchestrator-machine-11:eu-west-1"
  "orchestrator-machine-12:eu-west-1"
  "orchestrator-machine-13:ap-northeast-1"
  "orchestrator-machine-14:ap-northeast-1"
  "orchestrator-machine-15:ap-northeast-1"
  "orchestrator-machine-16:ap-northeast-1"
)

for machine in "${MACHINES[@]}"; do
  IFS=':' read -r machine_id region <<< "$machine"
  echo "Deploying to $machine_id in $region..."

  ssh "orchestrator-admin@$machine_id.neolith.ai" << EOF
    # Update package
    sudo npm update -g @wundr.io/orchestrator-daemon

    # Update config with machine ID
    sudo sed -i "s/MACHINE_ID=.*/MACHINE_ID=$machine_id/" /etc/orchestrator-daemon/.env
    sudo sed -i "s/MACHINE_REGION=.*/MACHINE_REGION=$region/" /etc/orchestrator-daemon/.env

    # Restart service
    sudo systemctl restart orchestrator-daemon

    # Check status
    sudo systemctl status orchestrator-daemon --no-pager
EOF

  echo "✓ $machine_id deployed"
done

echo "All machines deployed successfully!"
```

## Monitoring

### Health Check Endpoint

Each daemon exposes a health check endpoint:

```bash
curl http://orchestrator-machine-01:8080/health
```

Response:

```json
{
  "status": "healthy",
  "version": "1.0.3",
  "machine_id": "orchestrator-machine-01",
  "uptime_seconds": 86400,
  "active_vps": 3,
  "active_sessions": 2,
  "memory_usage_mb": 256,
  "last_heartbeat": "2025-11-26T12:00:00Z"
}
```

### Metrics Endpoint

Prometheus-compatible metrics:

```bash
curl http://orchestrator-machine-01:8080/metrics
```

### Centralized Monitoring

Configure Prometheus to scrape all machines:

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'orchestrator-daemon'
    static_configs:
      - targets:
        - 'orchestrator-machine-01:8080'
        - 'orchestrator-machine-02:8080'
        # ... all 16 machines
    relabel_configs:
      - source_labels: [__address__]
        target_label: machine_id
        regex: '(.+):8080'
        replacement: '$1'
```

### Grafana Dashboard

Import the Orchestrator-Daemon dashboard for visualization:

- Active Orchestrators per machine
- Task completion rate
- Session duration distribution
- Memory usage trends
- Error rates

## Troubleshooting

### Common Issues

#### Daemon Won't Start

```bash
# Check logs
sudo journalctl -u orchestrator-daemon -f

# Check config syntax
orchestrator-daemon validate-config --config /etc/orchestrator-daemon/config.json
```

#### Connection Issues

```bash
# Test API connectivity
curl -H "Authorization: Bearer $VP_DAEMON_AUTH_KEY" \
  https://api.neolith.ai/api/vps/status

# Test WebSocket
wscat -c wss://api.neolith.ai/ws
```

#### High Memory Usage

```bash
# Check memory
orchestrator-daemon memory-stats

# Force memory cleanup
orchestrator-daemon memory-prune --older-than 7d
```

### Log Locations

| Log File | Description |
| -------- | ----------- |
| `/var/log/orchestrator-daemon/daemon.log` | Main daemon log |
| `/var/log/orchestrator-daemon/stdout.log` | Standard output |
| `/var/log/orchestrator-daemon/stderr.log` | Standard error |
| `/var/lib/orchestrator-daemon/memory/*.json` | Orchestrator memory files |

## Security

### Firewall Rules

```bash
# Allow health check port (internal only)
sudo ufw allow from 10.0.0.0/8 to any port 8080

# Block external access to health endpoint
sudo ufw deny 8080
```

### Credential Rotation

Rotate API keys monthly:

```bash
# Generate new key via Neolith admin
# Update on all machines
for i in {01..16}; do
  ssh orchestrator-admin@orchestrator-machine-$i.neolith.ai \
    "sudo sed -i 's/VP_DAEMON_AUTH_KEY=.*/VP_DAEMON_AUTH_KEY=NEW_KEY/' /etc/orchestrator-daemon/.env && \
     sudo systemctl restart orchestrator-daemon"
done
```

## Backup & Recovery

### Memory Backup

Memory is automatically backed up to S3:

```bash
# Manual backup
orchestrator-daemon backup --destination s3://neolith-backups/orchestrator-memory/

# Restore from backup
orchestrator-daemon restore --source s3://neolith-backups/orchestrator-memory/2025-11-26/
```

### Disaster Recovery

1. Identify failed machine
2. Provision replacement machine
3. Install Orchestrator-Daemon
4. Restore memory from S3
5. Update DNS/load balancer
6. Verify connectivity

## Maintenance

### Rolling Updates

```bash
# Update one machine at a time
for i in {01..16}; do
  echo "Updating orchestrator-machine-$i..."
  ssh orchestrator-admin@orchestrator-machine-$i.neolith.ai \
    "sudo npm update -g @wundr.io/orchestrator-daemon && \
     sudo systemctl restart orchestrator-daemon"

  # Wait for health check
  sleep 30
  curl -f http://orchestrator-machine-$i:8080/health || exit 1
  echo "✓ orchestrator-machine-$i updated"
done
```

### Scheduled Maintenance

```bash
# Drain Orchestrators from machine before maintenance
orchestrator-daemon drain --timeout 300

# Perform maintenance
# ...

# Resume operations
orchestrator-daemon resume
```
