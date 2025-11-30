# Neolith App Deployment Guide

This guide covers deploying the Neolith app for multi-machine access, including the web frontend, orchestrator-daemon, and required infrastructure.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Prerequisites](#prerequisites)
3. [Infrastructure Setup](#infrastructure-setup)
4. [Deploy PostgreSQL Database](#deploy-postgresql-database)
5. [Deploy Orchestrator-Daemon](#deploy-orchestrator-daemon)
6. [Deploy Neolith Web App](#deploy-neolith-web-app)
7. [Environment Variables Reference](#environment-variables-reference)
8. [Post-Deployment Verification](#post-deployment-verification)
9. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         INTERNET                                │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
┌─────────────────────────┐     ┌─────────────────────────┐
│    Neolith Web App      │     │  Orchestrator-Daemon    │
│    (Netlify/Vercel)     │     │     (Railway)           │
│    Port: 443 (HTTPS)    │     │    Port: 8787 (WSS)     │
└─────────────────────────┘     └─────────────────────────┘
              │                               │
              └───────────────┬───────────────┘
                              ▼
              ┌─────────────────────────────────┐
              │      PostgreSQL Database        │
              │    (Railway/Supabase/RDS)       │
              │         Port: 5432              │
              └─────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
┌─────────────────────────┐     ┌─────────────────────────┐
│    Redis (Optional)     │     │   S3 Storage (Optional) │
│    (Upstash/Railway)    │     │   (AWS S3/Cloudflare R2)│
└─────────────────────────┘     └─────────────────────────┘
```

### Components

| Component | Purpose | Technology |
|-----------|---------|------------|
| **Neolith Web** | User interface, API routes | Next.js 16, React, TypeScript |
| **Orchestrator-Daemon** | AI agent orchestration, WebSocket server | Node.js, TypeScript, WebSocket |
| **PostgreSQL** | Primary data store | PostgreSQL 15+ |
| **Redis** | Session sharing, caching (optional) | Redis 7+ |
| **S3 Storage** | File uploads, avatars (optional) | S3-compatible |

---

## Prerequisites

Before deploying, ensure you have:

- [ ] GitHub account with access to the wundr repository
- [ ] Accounts on deployment platforms:
  - [Netlify](https://netlify.com) or [Vercel](https://vercel.com) (for web app)
  - [Railway](https://railway.app) (for daemon and database)
- [ ] API keys:
  - OpenAI API key (`sk-...`) for orchestrator-daemon
  - Anthropic API key (`sk-ant-...`) for Neolith AI features (optional)
- [ ] OAuth credentials (optional, for social login):
  - GitHub OAuth app
  - Google OAuth app

---

## Infrastructure Setup

### Option A: Railway + Netlify (Recommended)

**Estimated cost:** $20-50/month

| Service | Platform | Tier |
|---------|----------|------|
| PostgreSQL | Railway | Hobby ($5/month) |
| Orchestrator-Daemon | Railway | Hobby ($5/month) |
| Redis | Upstash | Free tier |
| Neolith Web | Netlify | Free tier |

### Option B: All-in-One Railway

**Estimated cost:** $15-40/month

All services on Railway with internal networking.

### Option C: Self-Hosted Docker

**Estimated cost:** $5-20/month (VPS)

Single Docker Compose deployment on a VPS (DigitalOcean, Linode, etc.).

---

## Deploy PostgreSQL Database

### Using Railway

1. **Create Railway Project**
   ```
   https://railway.app/new
   ```

2. **Add PostgreSQL Service**
   - Click "New" → "Database" → "PostgreSQL"
   - Wait for provisioning (~30 seconds)

3. **Get Connection String**
   - Click on the PostgreSQL service
   - Go to "Variables" tab
   - Copy `DATABASE_URL`

   Format:
   ```
   postgresql://postgres:PASSWORD@HOST:PORT/railway
   ```

4. **Run Database Migrations**
   ```bash
   cd /Users/maya/wundr/packages/@wundr/neolith

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

## Deploy Orchestrator-Daemon

### Using Railway

1. **Create New Service**
   - In your Railway project, click "New" → "GitHub Repo"
   - Select the `wundr` repository
   - Set root directory: `packages/@wundr/orchestrator-daemon`

2. **Configure Build Settings**
   ```
   Build Command: pnpm install && pnpm build
   Start Command: node dist/bin/cli.js --port $PORT
   ```

3. **Set Environment Variables**

   Go to "Variables" tab and add:
   ```env
   # Required
   OPENAI_API_KEY=sk-your-openai-key
   OPENAI_MODEL=gpt-5-mini

   # Server (Railway sets PORT automatically)
   DAEMON_HOST=0.0.0.0

   # Database (use Railway's internal URL if same project)
   DATABASE_URL=${{Postgres.DATABASE_URL}}

   # Optional
   DAEMON_MAX_SESSIONS=100
   DAEMON_VERBOSE=true
   ```

4. **Configure Networking**
   - Go to "Settings" → "Networking"
   - Click "Generate Domain" to get a public URL
   - Note the URL: `https://your-daemon.up.railway.app`

5. **Verify Deployment**
   ```bash
   curl https://your-daemon.up.railway.app/health
   # Should return: {"status":"healthy","timestamp":"..."}
   ```

### Using Docker (Self-Hosted)

1. **Build the Image**
   ```bash
   cd /Users/maya/wundr/packages/@wundr/orchestrator-daemon
   docker build -t orchestrator-daemon:latest .
   ```

2. **Run the Container**
   ```bash
   docker run -d \
     --name orchestrator-daemon \
     -p 8787:8787 \
     -e OPENAI_API_KEY=sk-your-key \
     -e OPENAI_MODEL=gpt-5-mini \
     -e DAEMON_HOST=0.0.0.0 \
     -e DAEMON_PORT=8787 \
     -e DATABASE_URL=postgresql://... \
     orchestrator-daemon:latest
   ```

---

## Deploy Neolith Web App

### Using Netlify

1. **Connect Repository**
   - Go to https://app.netlify.com/start
   - Click "Import from Git" → Select GitHub
   - Choose the `wundr` repository

2. **Configure Build Settings**
   ```
   Base directory: packages/@wundr/neolith/apps/web
   Build command: pnpm run build
   Publish directory: packages/@wundr/neolith/apps/web/.next
   ```

3. **Set Environment Variables**

   Go to "Site settings" → "Environment variables":
   ```env
   # Database
   DATABASE_URL=postgresql://...

   # Auth
   AUTH_SECRET=generate-a-random-32-char-string
   AUTH_URL=https://your-site.netlify.app
   NEXTAUTH_URL=https://your-site.netlify.app

   # AI (optional)
   ANTHROPIC_API_KEY=sk-ant-...
   OPENAI_API_KEY=sk-...

   # Orchestrator-Daemon Connection
   NEXT_PUBLIC_DAEMON_URL=wss://your-daemon.up.railway.app
   NEXT_PUBLIC_DAEMON_WS_URL=wss://your-daemon.up.railway.app

   # OAuth (optional)
   GITHUB_CLIENT_ID=...
   GITHUB_CLIENT_SECRET=...
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   ```

4. **Deploy**
   - Click "Deploy site"
   - Wait for build to complete (~3-5 minutes)

5. **Custom Domain (Optional)**
   - Go to "Domain settings"
   - Add your custom domain
   - Configure DNS as instructed

### Using Vercel

1. **Import Project**
   ```bash
   cd /Users/maya/wundr
   npx vercel --prod
   ```

   Or via dashboard: https://vercel.com/import

2. **Configure Project**
   ```
   Framework Preset: Next.js
   Root Directory: packages/@wundr/neolith/apps/web
   Build Command: pnpm run build
   Output Directory: .next
   ```

3. **Set Environment Variables**
   Same as Netlify (see above)

---

## Environment Variables Reference

### Neolith Web App

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `DATABASE_URL` | Yes | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |
| `AUTH_SECRET` | Yes | NextAuth.js secret (32+ chars) | `your-random-secret-string` |
| `AUTH_URL` | Yes | Public URL of your app | `https://your-app.netlify.app` |
| `NEXT_PUBLIC_DAEMON_URL` | Yes | Orchestrator-daemon WebSocket URL | `wss://daemon.railway.app` |
| `ANTHROPIC_API_KEY` | No | For AI features in Neolith | `sk-ant-...` |
| `OPENAI_API_KEY` | No | Alternative AI provider | `sk-...` |
| `GITHUB_CLIENT_ID` | No | GitHub OAuth | From GitHub Developer Settings |
| `GITHUB_CLIENT_SECRET` | No | GitHub OAuth | From GitHub Developer Settings |
| `GOOGLE_CLIENT_ID` | No | Google OAuth | From Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | No | Google OAuth | From Google Cloud Console |
| `REDIS_URL` | No | Redis for caching | `redis://host:6379` |
| `S3_BUCKET` | No | File storage bucket | `my-bucket` |
| `S3_REGION` | No | S3 region | `us-east-1` |
| `AWS_ACCESS_KEY_ID` | No | S3 credentials | From AWS IAM |
| `AWS_SECRET_ACCESS_KEY` | No | S3 credentials | From AWS IAM |

### Orchestrator-Daemon

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `OPENAI_API_KEY` | Yes | OpenAI API key for LLM calls | `sk-...` |
| `OPENAI_MODEL` | No | Model to use (default: gpt-5-mini) | `gpt-5-mini` |
| `DAEMON_HOST` | Yes | Bind address | `0.0.0.0` |
| `DAEMON_PORT` | No | Port (Railway sets automatically) | `8787` |
| `DATABASE_URL` | No | PostgreSQL for persistence | `postgresql://...` |
| `REDIS_URL` | No | Redis for distributed sessions | `redis://host:6379` |
| `DAEMON_MAX_SESSIONS` | No | Max concurrent sessions | `100` |
| `DAEMON_VERBOSE` | No | Enable verbose logging | `true` |
| `DAEMON_JWT_SECRET` | No | JWT signing secret | `random-string` |

---

## Post-Deployment Verification

### 1. Check Database Connection

```bash
# From your local machine with DATABASE_URL set
cd /Users/maya/wundr/packages/@wundr/neolith
pnpm prisma db pull
# Should complete without errors
```

### 2. Verify Orchestrator-Daemon

```bash
# Health check
curl https://your-daemon.railway.app/health
# Expected: {"status":"healthy","timestamp":"..."}

# WebSocket test (using wscat)
npm install -g wscat
wscat -c wss://your-daemon.railway.app
> {"type":"ping"}
< {"type":"pong"}
```

### 3. Test Neolith Web App

1. Open your deployed URL in a browser
2. Sign up / Sign in
3. Create a test workspace
4. Verify AI features work (if configured)

### 4. Test End-to-End Integration

```javascript
// Browser console test
const ws = new WebSocket('wss://your-daemon.railway.app');
ws.onopen = () => {
  console.log('Connected!');
  ws.send(JSON.stringify({ type: 'spawn_session', payload: { task: 'Hello' } }));
};
ws.onmessage = (e) => console.log('Received:', JSON.parse(e.data));
```

---

## Troubleshooting

### Common Issues

#### "Connection refused" to Orchestrator-Daemon

**Cause:** Daemon not binding to `0.0.0.0`

**Fix:** Ensure `DAEMON_HOST=0.0.0.0` is set (not `127.0.0.1`)

---

#### "WebSocket connection failed"

**Cause:** Using `ws://` instead of `wss://` for HTTPS sites

**Fix:** Use `wss://` for secure WebSocket connections:
```env
NEXT_PUBLIC_DAEMON_URL=wss://your-daemon.railway.app
```

---

#### Database connection timeout

**Cause:** Connection string using external URL for internal service

**Fix on Railway:** Use internal URLs when services are in the same project:
```env
DATABASE_URL=${{Postgres.DATABASE_URL}}
```

---

#### "Model not supported" error

**Cause:** Using a model not supported by @adaptic/lumic-utils

**Fix:** Use one of the supported models:
- `gpt-5-mini` (recommended)
- `gpt-5`
- `gpt-4.1`
- `gpt-4.1-mini`
- `o1`, `o1-mini`
- `o3`, `o3-mini`

---

#### Build fails on Netlify/Vercel

**Cause:** Missing dependencies or wrong Node version

**Fix:**
1. Ensure Node 18+ is used:
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

### Automatic Updates (Recommended)

Both Railway and Netlify support automatic deployments on push to `master`:

1. Push changes to GitHub
2. Deployment triggers automatically
3. Monitor build logs for errors

### Manual Updates

**Railway:**
```bash
# Via CLI
railway up
```

**Netlify:**
```bash
# Trigger deploy via webhook or dashboard
netlify deploy --prod
```

---

## Security Checklist

Before going to production:

- [ ] All secrets are stored in environment variables (not in code)
- [ ] `AUTH_SECRET` is a strong random string (32+ characters)
- [ ] Database is not publicly accessible (use internal URLs)
- [ ] HTTPS is enabled for all services
- [ ] CORS is configured to only allow your domains
- [ ] Rate limiting is enabled
- [ ] OAuth credentials are from production apps (not development)
- [ ] API keys have appropriate permissions/quotas

---

## Cost Optimization Tips

1. **Use free tiers** where possible:
   - Netlify: Free tier for static sites
   - Upstash: Free Redis tier
   - Supabase: Free PostgreSQL tier (with limits)

2. **Scale down when not in use:**
   - Railway allows pausing services
   - Use sleep mode for development environments

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
5. **Document for your team** - Share credentials securely (1Password, etc.)

---

*Last updated: December 2024*
