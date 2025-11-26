# VP-Daemon Production Deployment Guide

**Version:** 1.0.3
**Package:** `@wundr.io/vp-daemon`
**Date:** November 26, 2025

## Overview

This guide covers deploying VP-Daemon to 16 production machines for autonomous Virtual Principal
(VP) operation. Each daemon manages one or more VPs that can spawn Claude Code sessions to complete
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

### 1. Install VP-Daemon Package

```bash
# Global installation
npm install -g @wundr.io/vp-daemon

# Or with pnpm
pnpm add -g @wundr.io/vp-daemon
```

### 2. Verify Installation

```bash
vp-daemon --version
# Expected output: 1.0.3
```

### 3. Create Configuration Directory

```bash
mkdir -p /etc/vp-daemon
mkdir -p /var/log/vp-daemon
mkdir -p /var/lib/vp-daemon/memory
```

## Configuration

### Environment Configuration

Create `/etc/vp-daemon/.env`:

```bash
# =============================================================================
# VP-Daemon Production Configuration
# =============================================================================

# Neolith Backend Connection
NEOLITH_API_URL=https://api.neolith.ai
NEOLITH_WS_URL=wss://api.neolith.ai/ws
VP_DAEMON_AUTH_KEY=YOUR_DAEMON_AUTH_KEY

# Machine Identification
MACHINE_ID=vp-machine-01
MACHINE_REGION=us-east-1

# VP Configuration
MAX_VPS_PER_MACHINE=4
VP_POLL_INTERVAL_MS=5000
VP_IDLE_TIMEOUT_MS=300000

# Claude Configuration
ANTHROPIC_API_KEY=YOUR_ANTHROPIC_API_KEY
CLAUDE_MODEL=claude-sonnet-4-20250514
MAX_TOKENS_PER_SESSION=100000

# Memory Configuration
MEMORY_PERSISTENCE_PATH=/var/lib/vp-daemon/memory
MEMORY_BACKUP_INTERVAL_MS=60000

# Logging
LOG_LEVEL=info
LOG_FILE=/var/log/vp-daemon/daemon.log
LOG_MAX_SIZE=100M
LOG_MAX_FILES=10

# Health Monitoring
HEALTH_CHECK_PORT=8080
METRICS_ENABLED=true
```

### Daemon Configuration File

Create `/etc/vp-daemon/config.json`:

```json
{
  "version": "1.0.3",
  "machine": {
    "id": "vp-machine-01",
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
    "persistencePath": "/var/lib/vp-daemon/memory",
    "backupIntervalMs": 60000,
    "maxMemoryMB": 512,
    "compressionEnabled": true
  },
  "logging": {
    "level": "info",
    "file": "/var/log/vp-daemon/daemon.log",
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

Create `/etc/systemd/system/vp-daemon.service`:

```ini
[Unit]
Description=VP-Daemon - Virtual Principal Daemon Service
Documentation=https://github.com/wundr/vp-daemon
After=network.target
Wants=network-online.target

[Service]
Type=simple
User=vp-daemon
Group=vp-daemon
WorkingDirectory=/var/lib/vp-daemon
EnvironmentFile=/etc/vp-daemon/.env
ExecStart=/usr/bin/vp-daemon start --config /etc/vp-daemon/config.json
ExecStop=/usr/bin/vp-daemon stop
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
ReadWritePaths=/var/lib/vp-daemon /var/log/vp-daemon

# Resource limits
LimitNOFILE=65535
LimitNPROC=4096
MemoryMax=4G
CPUQuota=200%

# Logging
StandardOutput=append:/var/log/vp-daemon/stdout.log
StandardError=append:/var/log/vp-daemon/stderr.log
SyslogIdentifier=vp-daemon

[Install]
WantedBy=multi-user.target
```

### Create System User

```bash
# Create vp-daemon user
sudo useradd -r -s /sbin/nologin -d /var/lib/vp-daemon vp-daemon

# Set ownership
sudo chown -R vp-daemon:vp-daemon /var/lib/vp-daemon
sudo chown -R vp-daemon:vp-daemon /var/log/vp-daemon
sudo chown -R vp-daemon:vp-daemon /etc/vp-daemon
```

### Enable and Start Service

```bash
# Reload systemd
sudo systemctl daemon-reload

# Enable service to start on boot
sudo systemctl enable vp-daemon

# Start the service
sudo systemctl start vp-daemon

# Check status
sudo systemctl status vp-daemon
```

## Deployment to 16 Machines

### Machine Naming Convention

| Machine ID      | Region    | Purpose              |
| --------------- | --------- | -------------------- |
| vp-machine-01   | us-east-1 | Primary - Engineering |
| vp-machine-02   | us-east-1 | Primary - Engineering |
| vp-machine-03   | us-east-1 | Primary - Product    |
| vp-machine-04   | us-east-1 | Primary - Operations |
| vp-machine-05   | us-west-2 | Secondary - Engineering |
| vp-machine-06   | us-west-2 | Secondary - Product  |
| vp-machine-07   | us-west-2 | Secondary - Operations |
| vp-machine-08   | us-west-2 | Secondary - General  |
| vp-machine-09   | eu-west-1 | Europe - Engineering |
| vp-machine-10   | eu-west-1 | Europe - Product     |
| vp-machine-11   | eu-west-1 | Europe - Operations  |
| vp-machine-12   | eu-west-1 | Europe - General     |
| vp-machine-13   | ap-northeast-1 | APAC - Engineering |
| vp-machine-14   | ap-northeast-1 | APAC - Product     |
| vp-machine-15   | ap-northeast-1 | APAC - Operations  |
| vp-machine-16   | ap-northeast-1 | APAC - General     |

### Deployment Script

Create `deploy-vp-daemon.sh`:

```bash
#!/bin/bash
set -e

MACHINES=(
  "vp-machine-01:us-east-1"
  "vp-machine-02:us-east-1"
  "vp-machine-03:us-east-1"
  "vp-machine-04:us-east-1"
  "vp-machine-05:us-west-2"
  "vp-machine-06:us-west-2"
  "vp-machine-07:us-west-2"
  "vp-machine-08:us-west-2"
  "vp-machine-09:eu-west-1"
  "vp-machine-10:eu-west-1"
  "vp-machine-11:eu-west-1"
  "vp-machine-12:eu-west-1"
  "vp-machine-13:ap-northeast-1"
  "vp-machine-14:ap-northeast-1"
  "vp-machine-15:ap-northeast-1"
  "vp-machine-16:ap-northeast-1"
)

for machine in "${MACHINES[@]}"; do
  IFS=':' read -r machine_id region <<< "$machine"
  echo "Deploying to $machine_id in $region..."

  ssh "vp-admin@$machine_id.neolith.ai" << EOF
    # Update package
    sudo npm update -g @wundr.io/vp-daemon

    # Update config with machine ID
    sudo sed -i "s/MACHINE_ID=.*/MACHINE_ID=$machine_id/" /etc/vp-daemon/.env
    sudo sed -i "s/MACHINE_REGION=.*/MACHINE_REGION=$region/" /etc/vp-daemon/.env

    # Restart service
    sudo systemctl restart vp-daemon

    # Check status
    sudo systemctl status vp-daemon --no-pager
EOF

  echo "✓ $machine_id deployed"
done

echo "All machines deployed successfully!"
```

## Monitoring

### Health Check Endpoint

Each daemon exposes a health check endpoint:

```bash
curl http://vp-machine-01:8080/health
```

Response:

```json
{
  "status": "healthy",
  "version": "1.0.3",
  "machine_id": "vp-machine-01",
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
curl http://vp-machine-01:8080/metrics
```

### Centralized Monitoring

Configure Prometheus to scrape all machines:

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'vp-daemon'
    static_configs:
      - targets:
        - 'vp-machine-01:8080'
        - 'vp-machine-02:8080'
        # ... all 16 machines
    relabel_configs:
      - source_labels: [__address__]
        target_label: machine_id
        regex: '(.+):8080'
        replacement: '$1'
```

### Grafana Dashboard

Import the VP-Daemon dashboard for visualization:

- Active VPs per machine
- Task completion rate
- Session duration distribution
- Memory usage trends
- Error rates

## Troubleshooting

### Common Issues

#### Daemon Won't Start

```bash
# Check logs
sudo journalctl -u vp-daemon -f

# Check config syntax
vp-daemon validate-config --config /etc/vp-daemon/config.json
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
vp-daemon memory-stats

# Force memory cleanup
vp-daemon memory-prune --older-than 7d
```

### Log Locations

| Log File | Description |
| -------- | ----------- |
| `/var/log/vp-daemon/daemon.log` | Main daemon log |
| `/var/log/vp-daemon/stdout.log` | Standard output |
| `/var/log/vp-daemon/stderr.log` | Standard error |
| `/var/lib/vp-daemon/memory/*.json` | VP memory files |

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
  ssh vp-admin@vp-machine-$i.neolith.ai \
    "sudo sed -i 's/VP_DAEMON_AUTH_KEY=.*/VP_DAEMON_AUTH_KEY=NEW_KEY/' /etc/vp-daemon/.env && \
     sudo systemctl restart vp-daemon"
done
```

## Backup & Recovery

### Memory Backup

Memory is automatically backed up to S3:

```bash
# Manual backup
vp-daemon backup --destination s3://neolith-backups/vp-memory/

# Restore from backup
vp-daemon restore --source s3://neolith-backups/vp-memory/2025-11-26/
```

### Disaster Recovery

1. Identify failed machine
2. Provision replacement machine
3. Install VP-Daemon
4. Restore memory from S3
5. Update DNS/load balancer
6. Verify connectivity

## Maintenance

### Rolling Updates

```bash
# Update one machine at a time
for i in {01..16}; do
  echo "Updating vp-machine-$i..."
  ssh vp-admin@vp-machine-$i.neolith.ai \
    "sudo npm update -g @wundr.io/vp-daemon && \
     sudo systemctl restart vp-daemon"

  # Wait for health check
  sleep 30
  curl -f http://vp-machine-$i:8080/health || exit 1
  echo "✓ vp-machine-$i updated"
done
```

### Scheduled Maintenance

```bash
# Drain VPs from machine before maintenance
vp-daemon drain --timeout 300

# Perform maintenance
# ...

# Resume operations
vp-daemon resume
```
