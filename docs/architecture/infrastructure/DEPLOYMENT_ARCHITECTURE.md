# Deployment Architecture

## Overview

The Wundr platform deployment architecture is designed for high availability, scalability, and security across multiple environments. This document outlines the complete deployment strategy, infrastructure requirements, and operational procedures.

## Architecture Principles

### Core Principles
- **Cloud-Native**: Containerized applications with Kubernetes orchestration
- **High Availability**: Multi-region deployment with automatic failover
- **Scalability**: Horizontal scaling based on demand
- **Security**: Zero-trust security model with encryption everywhere
- **Observability**: Comprehensive monitoring and logging
- **Cost Optimization**: Efficient resource utilization

### Infrastructure Patterns
- **Microservices Architecture**: Independently deployable services
- **Infrastructure as Code**: Terraform and Helm for reproducible deployments
- **GitOps**: Automated deployment pipelines with ArgoCD
- **Blue-Green Deployments**: Zero-downtime deployments
- **Circuit Breaker Pattern**: Service resilience and fault tolerance

## Environment Strategy

### Development Environment
```yaml
# Local development stack
development:
  infrastructure: Docker Compose
  database: PostgreSQL (local)
  cache: Redis (local)
  storage: Local filesystem
  monitoring: Basic logging
  scaling: Single instance
```

### Staging Environment
```yaml
# Staging environment (GCP)
staging:
  infrastructure: GKE (Google Kubernetes Engine)
  nodes: 3x e2-standard-4 (4 vCPU, 16 GB RAM)
  database: Cloud SQL PostgreSQL
  cache: Cloud Memorystore Redis
  storage: Google Cloud Storage
  monitoring: Cloud Operations Suite
  scaling: Manual scaling
```

### Production Environment
```yaml
# Production environment (Multi-cloud)
production:
  primary_region: us-east-1 (AWS) / us-central1 (GCP)
  secondary_region: us-west-2 (AWS) / us-west1 (GCP)
  infrastructure: EKS + GKE (multi-cloud)
  nodes: Auto-scaling (3-20 nodes per cluster)
  database: RDS PostgreSQL + Cloud SQL (cross-region replication)
  cache: ElastiCache Redis + Cloud Memorystore
  storage: S3 + Cloud Storage (cross-region sync)
  monitoring: DataDog + Cloud Operations
  scaling: Auto-scaling based on metrics
```

## Container Architecture

### Application Containers
```dockerfile
# Multi-stage build for optimal image size
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:18-alpine AS runtime
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --chown=nextjs:nodejs . .
USER nextjs
EXPOSE 3000
CMD ["npm", "start"]
```

### Service Images
```yaml
# Container registry strategy
images:
  api-gateway: 
    registry: gcr.io/wundr-platform/api-gateway
    size: ~200MB
    security: Distroless base image
    
  analysis-engine:
    registry: gcr.io/wundr-platform/analysis-engine  
    size: ~300MB
    security: Distroless base image
    
  setup-toolkit:
    registry: gcr.io/wundr-platform/setup-toolkit
    size: ~250MB
    security: Alpine Linux base
    
  web-client:
    registry: gcr.io/wundr-platform/web-client
    size: ~150MB
    security: Nginx Alpine
```

## Kubernetes Configuration

### Cluster Architecture
```yaml
# GKE cluster configuration
apiVersion: container.v1
kind: Cluster
metadata:
  name: wundr-production
  location: us-central1
spec:
  nodePools:
    - name: system-pool
      nodeCount: 3
      config:
        machineType: e2-standard-4
        diskType: pd-ssd
        labels:
          workload-type: system
          
    - name: compute-pool
      initialNodeCount: 3
      autoscaling:
        enabled: true
        minNodeCount: 3
        maxNodeCount: 20
      config:
        machineType: c2-standard-8
        labels:
          workload-type: compute
          
    - name: memory-pool
      initialNodeCount: 2
      autoscaling:
        enabled: true
        minNodeCount: 2
        maxNodeCount: 10
      config:
        machineType: n2-highmem-4
        labels:
          workload-type: memory-intensive
```

### Service Deployment Manifests

#### API Gateway
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-gateway
  namespace: wundr-platform
spec:
  replicas: 3
  selector:
    matchLabels:
      app: api-gateway
  template:
    metadata:
      labels:
        app: api-gateway
        version: v1
    spec:
      containers:
      - name: api-gateway
        image: gcr.io/wundr-platform/api-gateway:latest
        ports:
        - containerPort: 8080
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: database-credentials
              key: url
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: redis-credentials
              key: url
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 8080
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: api-gateway-service
  namespace: wundr-platform
spec:
  selector:
    app: api-gateway
  ports:
  - port: 80
    targetPort: 8080
  type: ClusterIP
```

#### Analysis Engine
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: analysis-engine
  namespace: wundr-platform
spec:
  replicas: 5
  selector:
    matchLabels:
      app: analysis-engine
  template:
    metadata:
      labels:
        app: analysis-engine
    spec:
      nodeSelector:
        workload-type: compute
      containers:
      - name: analysis-engine
        image: gcr.io/wundr-platform/analysis-engine:latest
        ports:
        - containerPort: 8081
        env:
        - name: WORKER_CONCURRENCY
          value: "4"
        - name: MAX_MEMORY
          value: "2Gi"
        resources:
          requests:
            memory: "2Gi"
            cpu: "1"
          limits:
            memory: "4Gi"
            cpu: "2"
        volumeMounts:
        - name: analysis-cache
          mountPath: /tmp/analysis
      volumes:
      - name: analysis-cache
        emptyDir:
          sizeLimit: 5Gi
```

### Horizontal Pod Autoscaling
```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: api-gateway-hpa
  namespace: wundr-platform
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api-gateway
  minReplicas: 3
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
      - type: Percent
        value: 50
        periodSeconds: 60
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 10
        periodSeconds: 60
```

## Database Deployment

### PostgreSQL Configuration
```yaml
# Cloud SQL (GCP) configuration
database:
  instance_type: db-custom-8-32768  # 8 vCPU, 32 GB RAM
  storage:
    type: SSD
    size: 1000 GB
    auto_resize: true
  backup:
    enabled: true
    start_time: "03:00"
    retention_days: 7
    point_in_time_recovery: true
  high_availability:
    enabled: true
    type: REGIONAL
  maintenance:
    window: "sun:04:00"
    update_track: canary
  flags:
    max_connections: "200"
    shared_preload_libraries: "pg_stat_statements"
    log_statement: "all"
```

### Redis Configuration
```yaml
# Cloud Memorystore configuration
redis:
  tier: STANDARD_HA  # High availability
  memory_size: 16    # 16 GB
  version: REDIS_6_X
  connect_mode: DIRECT_PEERING
  auth_enabled: true
  transit_encryption_mode: SERVER_AUTHENTICATION
  persistence:
    rdb_snapshot_period: TWENTY_FOUR_HOURS
    rdb_snapshot_start_time: "02:00"
```

## Load Balancing and Traffic Management

### Ingress Configuration
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: wundr-platform-ingress
  namespace: wundr-platform
  annotations:
    kubernetes.io/ingress.global-static-ip-name: wundr-platform-ip
    networking.gke.io/managed-certificates: wundr-ssl-cert
    kubernetes.io/ingress.class: gce
    nginx.ingress.kubernetes.io/rate-limit: "100"
    nginx.ingress.kubernetes.io/rate-limit-window: "1m"
spec:
  rules:
  - host: api.wundr.io
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: api-gateway-service
            port:
              number: 80
  - host: app.wundr.io
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: web-client-service
            port:
              number: 80
```

### Service Mesh (Istio)
```yaml
apiVersion: networking.istio.io/v1alpha3
kind: VirtualService
metadata:
  name: wundr-platform-vs
spec:
  hosts:
  - api.wundr.io
  http:
  - match:
    - uri:
        prefix: "/v1/analysis"
    route:
    - destination:
        host: analysis-engine-service
        port:
          number: 8081
    timeout: 30s
    retries:
      attempts: 3
      perTryTimeout: 10s
  - match:
    - uri:
        prefix: "/v1"
    route:
    - destination:
        host: api-gateway-service
        port:
          number: 80
    fault:
      delay:
        percentage:
          value: 0.1
        fixedDelay: 5s
```

## CI/CD Pipeline

### GitHub Actions Workflow
```yaml
name: Deploy to Production

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  GCP_PROJECT_ID: wundr-platform
  GKE_CLUSTER: wundr-production
  GKE_ZONE: us-central1

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run tests
      run: npm run test:ci
    
    - name: Run security audit
      run: npm audit --audit-level high
    
    - name: Build application
      run: npm run build

  build-images:
    needs: build-and-test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Google Cloud SDK
      uses: google-github-actions/setup-gcloud@v1
      with:
        project_id: ${{ env.GCP_PROJECT_ID }}
        service_account_key: ${{ secrets.GCP_SA_KEY }}
    
    - name: Configure Docker
      run: gcloud auth configure-docker
    
    - name: Build and push images
      run: |
        docker build -t gcr.io/$GCP_PROJECT_ID/api-gateway:$GITHUB_SHA ./apps/api-gateway
        docker build -t gcr.io/$GCP_PROJECT_ID/analysis-engine:$GITHUB_SHA ./apps/analysis-engine
        docker build -t gcr.io/$GCP_PROJECT_ID/web-client:$GITHUB_SHA ./apps/web-client
        
        docker push gcr.io/$GCP_PROJECT_ID/api-gateway:$GITHUB_SHA
        docker push gcr.io/$GCP_PROJECT_ID/analysis-engine:$GITHUB_SHA
        docker push gcr.io/$GCP_PROJECT_ID/web-client:$GITHUB_SHA

  deploy-staging:
    needs: build-images
    runs-on: ubuntu-latest
    environment: staging
    steps:
    - name: Deploy to staging
      run: |
        gcloud container clusters get-credentials wundr-staging --zone us-central1
        kubectl set image deployment/api-gateway api-gateway=gcr.io/$GCP_PROJECT_ID/api-gateway:$GITHUB_SHA
        kubectl rollout status deployment/api-gateway
    
    - name: Run integration tests
      run: npm run test:integration

  deploy-production:
    needs: deploy-staging
    runs-on: ubuntu-latest
    environment: production
    if: github.ref == 'refs/heads/main'
    steps:
    - name: Blue-Green Deployment
      run: |
        # Deploy to green environment
        helm upgrade --install wundr-green ./helm/wundr-platform \
          --namespace wundr-platform-green \
          --set image.tag=$GITHUB_SHA \
          --set environment=production-green
        
        # Health checks
        kubectl wait --for=condition=available --timeout=300s deployment/api-gateway -n wundr-platform-green
        
        # Switch traffic
        kubectl patch service wundr-platform-service -p '{"spec":{"selector":{"environment":"production-green"}}}'
        
        # Cleanup old environment after successful deployment
        helm uninstall wundr-blue --namespace wundr-platform-blue || true
```

## Infrastructure as Code

### Terraform Configuration
```hcl
# terraform/main.tf
provider "google" {
  project = var.project_id
  region  = var.region
}

# GKE Cluster
resource "google_container_cluster" "primary" {
  name     = "wundr-platform"
  location = var.region

  remove_default_node_pool = true
  initial_node_count       = 1

  network    = google_compute_network.vpc.name
  subnetwork = google_compute_subnetwork.subnet.name

  addons_config {
    horizontal_pod_autoscaling {
      disabled = false
    }
    http_load_balancing {
      disabled = false
    }
    network_policy_config {
      disabled = false
    }
  }

  workload_identity_config {
    workload_pool = "${var.project_id}.svc.id.goog"
  }

  network_policy {
    enabled = true
  }
}

# Node Pool
resource "google_container_node_pool" "primary_nodes" {
  name       = "primary-pool"
  location   = var.region
  cluster    = google_container_cluster.primary.name
  node_count = 3

  node_config {
    preemptible  = false
    machine_type = "e2-standard-4"

    service_account = google_service_account.kubernetes.email
    oauth_scopes = [
      "https://www.googleapis.com/auth/cloud-platform"
    ]

    labels = {
      env = var.environment
    }

    tags = ["gke-node", "wundr-platform"]

    metadata = {
      disable-legacy-endpoints = "true"
    }
  }

  autoscaling {
    min_node_count = 3
    max_node_count = 20
  }

  management {
    auto_repair  = true
    auto_upgrade = true
  }
}

# Cloud SQL
resource "google_sql_database_instance" "postgres" {
  name             = "wundr-postgres"
  database_version = "POSTGRES_15"
  region           = var.region

  settings {
    tier = "db-custom-8-32768"
    
    disk_size       = 100
    disk_type       = "PD_SSD"
    disk_autoresize = true

    backup_configuration {
      enabled                        = true
      start_time                     = "03:00"
      point_in_time_recovery_enabled = true
      
      backup_retention_settings {
        retained_backups = 7
        retention_unit   = "COUNT"
      }
    }

    ip_configuration {
      ipv4_enabled       = false
      private_network    = google_compute_network.vpc.id
      require_ssl        = true
      allocated_ip_range = "google-managed-services-default"
    }

    database_flags {
      name  = "max_connections"
      value = "200"
    }

    database_flags {
      name  = "shared_preload_libraries"
      value = "pg_stat_statements"
    }
  }

  deletion_protection = true
}
```

## Monitoring and Observability

### Prometheus Configuration
```yaml
# prometheus/values.yaml
prometheus:
  prometheusSpec:
    retention: 30d
    resources:
      requests:
        memory: "4Gi"
        cpu: "2"
      limits:
        memory: "8Gi"
        cpu: "4"
    
    storageSpec:
      volumeClaimTemplate:
        spec:
          storageClassName: fast-ssd
          accessModes: ["ReadWriteOnce"]
          resources:
            requests:
              storage: 100Gi

grafana:
  adminPassword: ${grafana_admin_password}
  persistence:
    enabled: true
    size: 10Gi
  
  datasources:
    datasources.yaml:
      datasources:
      - name: Prometheus
        type: prometheus
        url: http://prometheus-server:80
        access: proxy
        isDefault: true
```

### Application Metrics
```yaml
# ServiceMonitor for application metrics
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: wundr-platform-metrics
spec:
  selector:
    matchLabels:
      app: api-gateway
  endpoints:
  - port: metrics
    path: /metrics
    interval: 30s
```

### Alerting Rules
```yaml
# prometheus-rules.yaml
groups:
- name: wundr-platform
  rules:
  - alert: HighErrorRate
    expr: |
      (
        sum(rate(http_requests_total{status=~"5.."}[5m])) by (service)
        /
        sum(rate(http_requests_total[5m])) by (service)
      ) > 0.05
    for: 5m
    labels:
      severity: critical
    annotations:
      summary: "High error rate detected"
      description: "Service {{ $labels.service }} has error rate above 5%"

  - alert: HighLatency
    expr: |
      histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (service, le)) > 1
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "High latency detected"
      description: "Service {{ $labels.service }} has 95th percentile latency above 1s"
```

## Security Configuration

### Network Policies
```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: api-gateway-netpol
  namespace: wundr-platform
spec:
  podSelector:
    matchLabels:
      app: api-gateway
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: ingress-nginx
    ports:
    - protocol: TCP
      port: 8080
  egress:
  - to:
    - podSelector:
        matchLabels:
          app: analysis-engine
    ports:
    - protocol: TCP
      port: 8081
  - to:
    - podSelector:
        matchLabels:
          app: postgres
    ports:
    - protocol: TCP
      port: 5432
```

### Pod Security Standards
```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: wundr-platform
  labels:
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/audit: restricted
    pod-security.kubernetes.io/warn: restricted
```

## Disaster Recovery

### Backup Strategy
```yaml
# Velero backup configuration
apiVersion: velero.io/v1
kind: Schedule
metadata:
  name: daily-backup
spec:
  schedule: "0 2 * * *"  # Daily at 2 AM
  template:
    includedNamespaces:
    - wundr-platform
    storageLocation: default
    volumeSnapshotLocations:
    - default
    ttl: "168h"  # 7 days retention
```

### Recovery Procedures
```bash
#!/bin/bash
# disaster-recovery.sh

# 1. Restore from backup
velero restore create --from-backup daily-backup-20241201-020000

# 2. Verify database connectivity
kubectl exec -it deployment/api-gateway -- curl -f http://localhost:8080/health

# 3. Run database migrations if needed
kubectl exec -it deployment/api-gateway -- npm run db:migrate

# 4. Validate application functionality
kubectl exec -it deployment/api-gateway -- npm run test:smoke
```

This deployment architecture provides a robust, scalable, and secure foundation for the Wundr platform with comprehensive operational procedures and monitoring capabilities.