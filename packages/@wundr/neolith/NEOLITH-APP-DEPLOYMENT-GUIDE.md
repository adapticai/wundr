# Neolith App Deployment Guide

This guide covers deploying the Neolith app infrastructure and configuring the local
orchestrator-daemon for multi-machine orchestration.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Prerequisites](#prerequisites)
3. [Infrastructure Setup](#infrastructure-setup)
4. [Deploy PostgreSQL Database](#deploy-postgresql-database)
5. [Deploy Redis (Optional)](#deploy-redis-optional)
6. [Deploy Neolith Web App](#deploy-neolith-web-app)
7. [Configure Local Orchestrator-Daemon](#configure-local-orchestrator-daemon)
8. [Environment Variables Reference](#environment-variables-reference)
9. [Post-Deployment Verification](#post-deployment-verification)
10. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

The Neolith ecosystem uses a **hybrid architecture** where the orchestrator-daemon runs locally on
each agent's machine, while shared infrastructure is hosted in the cloud.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLOUD INFRASTRUCTURE                            │
│                         (Railway + Netlify/Vercel)                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────┐     ┌─────────────────────────┐               │
│  │    Neolith Web App      │     │    PostgreSQL Database   │               │
│  │    (Netlify/Vercel)     │────▶│       (Railway)          │               │
│  │    Port: 443 (HTTPS)    │     │       Port: 5432         │               │
│  └─────────────────────────┘     └─────────────────────────┘               │
│              │                               │                              │
│              │                   ┌───────────┴───────────┐                 │
│              │                   ▼                       ▼                 │
│              │       ┌─────────────────────┐  ┌─────────────────────┐      │
│              │       │   Redis (Optional)  │  │  S3 Storage (Opt)   │      │
│              │       │   (Upstash/Railway) │  │  (AWS S3/R2)        │      │
│              │       └─────────────────────┘  └─────────────────────┘      │
│              │                                                              │
└──────────────┼──────────────────────────────────────────────────────────────┘
               │
               │  HTTPS/WSS
               │
┌──────────────┼──────────────────────────────────────────────────────────────┐
│              │           LOCAL ORCHESTRATOR AGENTS                          │
│              │         (Mac Mini / Mac Studio machines)                     │
├──────────────┼──────────────────────────────────────────────────────────────┤
│              │                                                              │
│   ┌──────────▼──────────┐    ┌──────────────────────┐                      │
│   │  Neolith Desktop    │    │  Neolith iOS/Android │                      │
│   │  (Electron App)     │    │  (Capacitor App)     │                      │
│   └──────────┬──────────┘    └──────────┬───────────┘                      │
│              │                          │                                   │
│              │    localhost:8787        │                                   │
│              ▼                          ▼                                   │
│   ┌─────────────────────────────────────────────────┐                      │
│   │           Orchestrator-Daemon                   │                      │
│   │         (Runs locally on each machine)          │                      │
│   │                                                 │                      │
│   │  • AI Agent Orchestration                       │                      │
│   │  • Session Management                           │                      │
│   │  • Local WebSocket Server (ws://localhost:8787) │                      │
│   │  • LLM Integration (OpenAI/Anthropic)           │                      │
│   └─────────────────────────────────────────────────┘                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Component Summary

| Component               | Location        | Purpose                                      | Technology                     |
| ----------------------- | --------------- | -------------------------------------------- | ------------------------------ |
| **Neolith Web**         | Cloud (Netlify) | Web UI served to Electron/Capacitor apps     | Next.js, React, TypeScript     |
| **PostgreSQL**          | Cloud (Railway) | Shared data store, user accounts, workspaces | PostgreSQL 15+                 |
| **Redis**               | Cloud (Upstash) | Session sharing, caching (optional)          | Redis 7+                       |
| **S3 Storage**          | Cloud (AWS/R2)  | File uploads, avatars (optional)             | S3-compatible                  |
| **Orchestrator-Daemon** | **Local**       | AI orchestration, runs on agent's machine    | Node.js, TypeScript, WebSocket |

### Why Local Orchestrator-Daemon?

- **Performance**: Direct local communication with no network latency for AI operations
- **Security**: API keys and sensitive operations stay on the local machine
- **Scalability**: Each agent machine handles its own orchestration load
- **Flexibility**: Users can customize their local daemon configuration
- **Offline capability**: Core AI features work without constant cloud connectivity

---

## Prerequisites

Before deploying, ensure you have:

- [ ] GitHub account with access to the wundr repository
- [ ] Accounts on deployment platforms:
  - [Netlify](https://netlify.com) or [Vercel](https://vercel.com) (for web app)
  - [Railway](https://railway.app) (for database and Redis)
- [ ] API keys for local daemon:
  - OpenAI API key (`sk-...`) for orchestrator-daemon
  - Anthropic API key (`sk-ant-...`) for Neolith AI features (optional)
- [ ] OAuth credentials (optional, for social login):
  - GitHub OAuth app
  - Google OAuth app
- [ ] Local development machine:
  - Mac Mini or Mac Studio with macOS 13+
  - Node.js 20+ installed
  - pnpm package manager

---

## Infrastructure Setup

### Recommended Stack: Railway + Netlify

**Estimated cloud cost:** $5-15/month

| Service                 | Platform  | Tier  | Cost      |
| ----------------------- | --------- | ----- | --------- |
| PostgreSQL              | Railway   | Hobby | ~$5/month |
| Redis                   | Upstash   | Free  | $0        |
| Neolith Web             | Netlify   | Free  | $0        |
| **Orchestrator-Daemon** | **Local** | N/A   | $0        |

### Alternative: Supabase + Vercel

| Service                 | Platform  | Tier  | Cost             |
| ----------------------- | --------- | ----- | ---------------- |
| PostgreSQL              | Supabase  | Free  | $0 (with limits) |
| Neolith Web             | Vercel    | Hobby | $0               |
| **Orchestrator-Daemon** | **Local** | N/A   | $0               |

---

## Deploy PostgreSQL Database

### Using Railway

1. **Create Railway Project**

   ```bash
   # Install Railway CLI
   npm install -g @railway/cli

   # Login to Railway
   railway login

   # Create new project
   railway init --name "neolith-production"
   ```

2. **Add PostgreSQL Service**

   ```bash
   # Deploy PostgreSQL template
   railway deploy --template postgres
   ```

   Or via dashboard:
   - Go to https://railway.app/new
   - Click "New" → "Database" → "PostgreSQL"
   - Wait for provisioning (~30 seconds)

3. **Get Connection String**

   ```bash
   # Link to Postgres service
   railway service Postgres

   # View variables (includes DATABASE_URL)
   railway variables
   ```

   Copy the `DATABASE_PUBLIC_URL` for external access:

   ```
   postgresql://postgres:PASSWORD@HOST.proxy.rlwy.net:PORT/railway
   ```

4. **Run Database Migrations**

   ```bash
   cd packages/@wundr/neolith

   # Set the DATABASE_URL
   export DATABASE_URL="postgresql://postgres:PASSWORD@HOST:PORT/railway"

   # Run Prisma migrations
   pnpm prisma migrate deploy
   ```

### Using Supabase (Alternative)

1. Create project at https://supabase.com
2. Go to Settings → Database → Connection string
3. Copy the connection string (use "Transaction" mode for serverless)

---

## Deploy Redis (Optional)

Redis is optional but recommended for session sharing across multiple app instances.

### Using Upstash (Recommended - Free Tier)

1. Create account at https://upstash.com
2. Create a new Redis database
3. Copy the connection string:
   ```
   redis://default:PASSWORD@HOST.upstash.io:PORT
   ```

### Using Railway

```bash
# Add Redis to your Railway project
railway deploy --template redis

# Get connection URL
railway service Redis
railway variables
```

---

## Deploy Neolith Web App

The web app is deployed to the cloud and loaded by Electron (desktop) and Capacitor (mobile) apps.

### Using Netlify

1. **Install Netlify CLI**

   ```bash
   npm install -g netlify-cli
   netlify login
   ```

2. **Create Site**

   ```bash
   cd packages/@wundr/neolith

   # Create new site
   netlify sites:create --name neolith-app

   # Link to site
   netlify link
   ```

3. **Configure Build Settings**

   The `netlify.toml` is already configured. Key settings:

   ```toml
   [build]
     command = "cd apps/web && pnpm run build"
     publish = "apps/web/out"
     base = "packages/@wundr/neolith"

   [build.environment]
     NODE_VERSION = "20"
   ```

4. **Set Environment Variables**

   ```bash
   # Via CLI
   netlify env:set DATABASE_URL "postgresql://..."
   netlify env:set AUTH_SECRET "$(openssl rand -base64 32)"
   netlify env:set AUTH_URL "https://your-site.netlify.app"
   netlify env:set NEXTAUTH_URL "https://your-site.netlify.app"
   ```

   Or via Netlify Dashboard → Site settings → Environment variables:

   ```env
   # Required
   DATABASE_URL=postgresql://...
   AUTH_SECRET=your-random-32-char-string
   AUTH_URL=https://your-site.netlify.app
   NEXTAUTH_URL=https://your-site.netlify.app

   # Optional AI features (server-side)
   ANTHROPIC_API_KEY=sk-ant-...
   OPENAI_API_KEY=sk-...

   # Optional OAuth
   GITHUB_CLIENT_ID=...
   GITHUB_CLIENT_SECRET=...
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...

   # Optional Redis
   REDIS_URL=redis://...
   ```

   **Important:** The web app does NOT need `NEXT_PUBLIC_DAEMON_URL` since the daemon runs locally!

5. **Deploy**

   ```bash
   netlify deploy --prod
   ```

6. **Custom Domain (Optional)**
   ```bash
   netlify domains:add app.neolith.io
   ```

### Using Vercel

1. **Import Project**

   ```bash
   cd packages/@wundr/neolith
   npx vercel --prod
   ```

2. **Configure Project**

   ```
   Framework Preset: Next.js
   Root Directory: apps/web
   Build Command: pnpm run build
   Output Directory: .next
   ```

3. **Set Environment Variables** Same as Netlify (see above)

---

## Configure Local Orchestrator-Daemon

The orchestrator-daemon runs **locally** on each agent's Mac Mini/Mac Studio. It is automatically
started by the Neolith desktop app.

### Manual Setup (Development/Testing)

1. **Install Dependencies**

   ```bash
   cd packages/@wundr/orchestrator-daemon
   pnpm install
   pnpm build
   ```

2. **Create Environment File**

   ```bash
   cp .env.example .env
   ```

   Edit `.env`:

   ```env
   # Required
   OPENAI_API_KEY=sk-your-openai-key
   OPENAI_MODEL=gpt-4o-mini

   # Server
   DAEMON_HOST=127.0.0.1
   DAEMON_PORT=8787

   # Database (use cloud DATABASE_URL for shared state)
   DATABASE_URL=postgresql://postgres:PASSWORD@HOST:PORT/railway

   # Optional
   DAEMON_MAX_SESSIONS=100
   DAEMON_VERBOSE=true
   DAEMON_JWT_SECRET=your-local-jwt-secret

   # Optional Redis (for multi-session sync)
   REDIS_URL=redis://...
   ```

3. **Start the Daemon**

   ```bash
   # Development mode
   pnpm start:dev

   # Production mode
   pnpm start
   ```

4. **Verify It's Running**
   ```bash
   curl http://localhost:8787/health
   # Expected: {"status":"healthy","timestamp":"..."}
   ```

### Automatic Startup (Production)

The Neolith Electron app automatically manages the orchestrator-daemon lifecycle:

1. **On App Launch**: Daemon starts automatically
2. **On App Close**: Daemon shuts down gracefully
3. **Configuration**: Settings stored in `~/.neolith/daemon.config.json`

To configure the daemon via the desktop app:

1. Open Neolith Desktop
2. Go to Settings → Orchestrator
3. Set your API keys and preferences
4. Daemon restarts automatically with new settings

### Docker Setup (Optional)

For containerized local deployment:

```bash
cd packages/@wundr/orchestrator-daemon

# Build the image
docker build -t orchestrator-daemon:latest .

# Run the container
docker run -d \
  --name orchestrator-daemon \
  -p 8787:8787 \
  -e OPENAI_API_KEY=sk-your-key \
  -e OPENAI_MODEL=gpt-4o-mini \
  -e DAEMON_HOST=0.0.0.0 \
  -e DAEMON_PORT=8787 \
  -e DATABASE_URL=postgresql://... \
  orchestrator-daemon:latest
```

---

## Environment Variables Reference

### Neolith Web App (Cloud - Netlify/Vercel)

| Variable                | Required | Description                    | Example                               |
| ----------------------- | -------- | ------------------------------ | ------------------------------------- |
| `DATABASE_URL`          | Yes      | PostgreSQL connection string   | `postgresql://user:pass@host:5432/db` |
| `AUTH_SECRET`           | Yes      | NextAuth.js secret (32+ chars) | `your-random-secret-string`           |
| `AUTH_URL`              | Yes      | Public URL of your app         | `https://your-app.netlify.app`        |
| `NEXTAUTH_URL`          | Yes      | Same as AUTH_URL               | `https://your-app.netlify.app`        |
| `ANTHROPIC_API_KEY`     | No       | For server-side AI features    | `sk-ant-...`                          |
| `OPENAI_API_KEY`        | No       | Alternative AI provider        | `sk-...`                              |
| `GITHUB_CLIENT_ID`      | No       | GitHub OAuth                   | From GitHub Developer Settings        |
| `GITHUB_CLIENT_SECRET`  | No       | GitHub OAuth                   | From GitHub Developer Settings        |
| `GOOGLE_CLIENT_ID`      | No       | Google OAuth                   | From Google Cloud Console             |
| `GOOGLE_CLIENT_SECRET`  | No       | Google OAuth                   | From Google Cloud Console             |
| `REDIS_URL`             | No       | Redis for caching              | `redis://host:6379`                   |
| `S3_BUCKET`             | No       | File storage bucket            | `my-bucket`                           |
| `S3_REGION`             | No       | S3 region                      | `us-east-1`                           |
| `AWS_ACCESS_KEY_ID`     | No       | S3 credentials                 | From AWS IAM                          |
| `AWS_SECRET_ACCESS_KEY` | No       | S3 credentials                 | From AWS IAM                          |

### Orchestrator-Daemon (Local - Each Agent Machine)

| Variable              | Required | Description                         | Example             |
| --------------------- | -------- | ----------------------------------- | ------------------- |
| `OPENAI_API_KEY`      | Yes      | OpenAI API key for LLM calls        | `sk-...`            |
| `OPENAI_MODEL`        | No       | Model to use (default: gpt-4o-mini) | `gpt-4o-mini`       |
| `DAEMON_HOST`         | No       | Bind address (default: 127.0.0.1)   | `127.0.0.1`         |
| `DAEMON_PORT`         | No       | Port (default: 8787)                | `8787`              |
| `DATABASE_URL`        | Yes      | PostgreSQL for shared state         | `postgresql://...`  |
| `REDIS_URL`           | No       | Redis for session sync              | `redis://host:6379` |
| `DAEMON_MAX_SESSIONS` | No       | Max concurrent sessions             | `100`               |
| `DAEMON_VERBOSE`      | No       | Enable verbose logging              | `true`              |
| `DAEMON_JWT_SECRET`   | No       | JWT signing secret                  | `random-string`     |
| `ANTHROPIC_API_KEY`   | No       | Anthropic API for Claude models     | `sk-ant-...`        |

---

## Post-Deployment Verification

### 1. Check Database Connection

```bash
# From your local machine with DATABASE_URL set
cd packages/@wundr/neolith
export DATABASE_URL="postgresql://..."
pnpm prisma db pull
# Should complete without errors
```

### 2. Verify Neolith Web App

1. Open your deployed URL in a browser (e.g., `https://your-app.netlify.app`)
2. Sign up / Sign in
3. Verify the page loads correctly

### 3. Verify Local Orchestrator-Daemon

```bash
# Health check
curl http://localhost:8787/health
# Expected: {"status":"healthy","timestamp":"..."}

# WebSocket test (using wscat)
npm install -g wscat
wscat -c ws://localhost:8787
> {"type":"ping"}
< {"type":"pong"}
```

### 4. Test End-to-End Integration

1. Open the Neolith Desktop app
2. The app should automatically start the local daemon
3. Create a new workspace
4. Start an AI agent session
5. Verify the agent responds correctly

```javascript
// Browser console test (in Electron app)
const ws = new WebSocket('ws://localhost:8787');
ws.onopen = () => {
  console.log('Connected to local daemon!');
  ws.send(JSON.stringify({ type: 'spawn_session', payload: { task: 'Hello' } }));
};
ws.onmessage = e => console.log('Received:', JSON.parse(e.data));
```

---

## Troubleshooting

### Common Issues

#### Daemon not starting

**Cause:** Port 8787 already in use

**Fix:** Kill existing process or change port:

```bash
# Find process using port 8787
lsof -i :8787

# Kill it
kill -9 <PID>

# Or change port in .env
DAEMON_PORT=8788
```

---

#### "Connection refused" from desktop app

**Cause:** Daemon not running

**Fix:**

1. Check if daemon is running: `curl http://localhost:8787/health`
2. Start manually: `cd packages/@wundr/orchestrator-daemon && pnpm start`
3. Check logs for errors

---

#### Database connection timeout

**Cause:** Using internal Railway URL from local machine

**Fix:** Use the public DATABASE_URL for local daemon:

```env
# Wrong (internal URL - only works inside Railway)
DATABASE_URL=postgresql://postgres:xxx@postgres.railway.internal:5432/railway

# Correct (public URL - works from anywhere)
DATABASE_URL=postgresql://postgres:xxx@HOST.proxy.rlwy.net:PORT/railway
```

---

#### "Model not supported" error

**Cause:** Using a model not supported by @adaptic/lumic-utils

**Fix:** Use one of the supported models:

- `gpt-4o-mini` (recommended)
- `gpt-4o`
- `gpt-4-turbo`
- `gpt-4`
- `o1`, `o1-mini`
- `o3`, `o3-mini`

---

#### Build fails on Netlify/Vercel

**Cause:** Missing dependencies or wrong Node version

**Fix:**

1. Ensure Node 20+ is used:
   ```env
   NODE_VERSION=20
   ```
2. Check build logs for specific errors
3. Verify all environment variables are set

---

### Getting Help

- **Neolith Issues:** Check `/packages/@wundr/neolith/README.md`
- **Orchestrator-Daemon Issues:** Check `/packages/@wundr/orchestrator-daemon/README.md`
- **Railway Support:** https://docs.railway.app
- **Netlify Support:** https://docs.netlify.com

---

## Updating Deployments

### Cloud Services (Automatic)

Both Railway and Netlify support automatic deployments on push to `master`:

1. Push changes to GitHub
2. Deployment triggers automatically
3. Monitor build logs for errors

### Local Orchestrator-Daemon

```bash
cd packages/@wundr/orchestrator-daemon

# Pull latest changes
git pull origin master

# Reinstall dependencies
pnpm install

# Rebuild
pnpm build

# Restart daemon
pnpm start
```

Or restart the Neolith Desktop app, which will automatically update the daemon.

---

## Security Checklist

Before going to production:

- [ ] All cloud secrets are stored in environment variables (not in code)
- [ ] `AUTH_SECRET` is a strong random string (32+ characters)
- [ ] Database uses public URL with SSL enabled
- [ ] HTTPS is enabled for all cloud services
- [ ] Local daemon only binds to `127.0.0.1` (not `0.0.0.0`)
- [ ] CORS is configured to only allow your domains
- [ ] Rate limiting is enabled on cloud services
- [ ] OAuth credentials are from production apps (not development)
- [ ] API keys have appropriate permissions/quotas
- [ ] Local API keys are stored securely (Keychain on macOS)

---

## Cost Optimization Tips

1. **Use free tiers** where possible:
   - Netlify: Free tier for web app
   - Upstash: Free Redis tier
   - Supabase: Free PostgreSQL tier (with limits)

2. **Local daemon = no compute costs:**
   - Orchestration runs on agent machines
   - Only pay for database storage

3. **Monitor usage:**
   - Set up billing alerts on all platforms
   - Monitor LLM API usage (can be expensive)

---

## Next Steps

After successful deployment:

1. **Set up monitoring** - Add error tracking (Sentry) and uptime monitoring
2. **Configure backups** - Enable database backups on Railway/Supabase
3. **Add custom domain** - Configure DNS for your domain
4. **Set up CI/CD** - Add automated testing before deployment
5. **Document for your team** - Share cloud credentials securely (1Password, etc.)
6. **Configure agent machines** - Set up each Mac Mini/Studio with local daemon

---

_Last updated: December 2024_
