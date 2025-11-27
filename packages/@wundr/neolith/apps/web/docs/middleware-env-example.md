# Middleware Environment Configuration

## Required Environment Variables

The middleware requires the following environment variables to function properly.

### Authentication (NextAuth.js)

```env
# NextAuth Configuration
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key-here-generate-with-openssl-rand-base64-32

# GitHub OAuth (for developer authentication)
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret

# Google OAuth (for general user authentication)
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

### CORS Configuration (Optional)

```env
# Comma-separated list of allowed origins
# Default: http://localhost:3000,http://localhost:3001
ALLOWED_ORIGINS=https://app.example.com,https://admin.example.com,https://api.example.com
```

### Rate Limiting (Production)

```env
# Redis for distributed rate limiting (recommended for production)
UPSTASH_REDIS_REST_URL=https://your-redis-instance.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-redis-token
```

## Example .env.local File

Create a `.env.local` file in the project root:

```env
# =================================
# NextAuth.js Configuration
# =================================
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=super-secret-key-change-in-production

# =================================
# OAuth Providers
# =================================

# GitHub OAuth
GITHUB_CLIENT_ID=Iv1.a1b2c3d4e5f6g7h8
GITHUB_CLIENT_SECRET=1234567890abcdef1234567890abcdef12345678

# Google OAuth
GOOGLE_CLIENT_ID=123456789012-abcdefghijklmnopqrstuvwxyz123456.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-abcdefghijklmnopqrstuvwxyz

# =================================
# CORS Configuration (Optional)
# =================================
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001

# =================================
# Database
# =================================
DATABASE_URL=postgresql://user:password@localhost:5432/neolith

# =================================
# Redis (Optional - for production rate limiting)
# =================================
# UPSTASH_REDIS_REST_URL=https://your-instance.upstash.io
# UPSTASH_REDIS_REST_TOKEN=your-token
```

## Generating NEXTAUTH_SECRET

Use OpenSSL to generate a secure secret:

```bash
openssl rand -base64 32
```

Output example:
```
K7JxQv3mN8pR2sT5wY9zA1bC4dE6fG8h
```

## Setting Up OAuth Providers

### GitHub OAuth

1. Go to GitHub Settings → Developer settings → OAuth Apps
2. Click "New OAuth App"
3. Fill in:
   - Application name: `Neolith App (Local Dev)`
   - Homepage URL: `http://localhost:3000`
   - Authorization callback URL: `http://localhost:3000/api/auth/callback/github`
4. Copy the Client ID and generate a Client Secret
5. Add to `.env.local`

### Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select an existing one
3. Enable "Google+ API"
4. Go to Credentials → Create Credentials → OAuth 2.0 Client ID
5. Configure consent screen if needed
6. Application type: Web application
7. Authorized redirect URIs: `http://localhost:3000/api/auth/callback/google`
8. Copy Client ID and Client Secret
9. Add to `.env.local`

## Production Configuration

### Vercel

Add environment variables in Vercel Dashboard:

```bash
vercel env add NEXTAUTH_SECRET
vercel env add NEXTAUTH_URL
vercel env add GITHUB_CLIENT_ID
vercel env add GITHUB_CLIENT_SECRET
vercel env add GOOGLE_CLIENT_ID
vercel env add GOOGLE_CLIENT_SECRET
vercel env add ALLOWED_ORIGINS
```

### Docker

Create a `.env` file for production:

```env
NEXTAUTH_URL=https://app.example.com
NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
GITHUB_CLIENT_ID=${GITHUB_CLIENT_ID}
GITHUB_CLIENT_SECRET=${GITHUB_CLIENT_SECRET}
GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}
GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}
ALLOWED_ORIGINS=https://app.example.com,https://admin.example.com
```

Use with Docker Compose:

```yaml
services:
  web:
    image: neolith-web
    env_file:
      - .env
    environment:
      - NODE_ENV=production
```

### Kubernetes

Create a Secret:

```bash
kubectl create secret generic neolith-auth \
  --from-literal=nextauth-url=https://app.example.com \
  --from-literal=nextauth-secret=your-secret \
  --from-literal=github-client-id=your-id \
  --from-literal=github-client-secret=your-secret \
  --from-literal=google-client-id=your-id \
  --from-literal=google-client-secret=your-secret
```

Reference in deployment:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: neolith-web
spec:
  template:
    spec:
      containers:
        - name: web
          envFrom:
            - secretRef:
                name: neolith-auth
          env:
            - name: ALLOWED_ORIGINS
              value: "https://app.example.com,https://admin.example.com"
```

## Verification

Test that environment variables are loaded:

```typescript
// app/api/test-env/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    hasNextAuthUrl: !!process.env.NEXTAUTH_URL,
    hasNextAuthSecret: !!process.env.NEXTAUTH_SECRET,
    hasGithubClientId: !!process.env.GITHUB_CLIENT_ID,
    hasGoogleClientId: !!process.env.GOOGLE_CLIENT_ID,
    allowedOrigins: process.env.ALLOWED_ORIGINS || 'default',
  });
}
```

Visit: `http://localhost:3000/api/test-env`

Expected response:
```json
{
  "hasNextAuthUrl": true,
  "hasNextAuthSecret": true,
  "hasGithubClientId": true,
  "hasGoogleClientId": true,
  "allowedOrigins": "http://localhost:3000,http://localhost:3001"
}
```

## Troubleshooting

### Error: "NEXTAUTH_URL is not defined"

**Solution**: Add `NEXTAUTH_URL` to `.env.local`

### Error: "Invalid client ID"

**Solution**: Check that Client ID matches exactly from OAuth provider

### Error: "Redirect URI mismatch"

**Solution**: Ensure callback URL in OAuth app matches:
- Local: `http://localhost:3000/api/auth/callback/{provider}`
- Production: `https://yourdomain.com/api/auth/callback/{provider}`

### Warning: "ALLOWED_ORIGINS not set"

**Info**: Using default origins for development. Set in production.

## Security Best Practices

1. **Never commit `.env.local`** - Add to `.gitignore`
2. **Rotate secrets regularly** - Especially in production
3. **Use different OAuth apps** - Separate dev/staging/prod
4. **Restrict callback URLs** - Only allow necessary domains
5. **Enable 2FA** - On OAuth provider accounts
6. **Monitor auth logs** - Watch for suspicious activity
7. **Use environment-specific secrets** - Different for each environment
