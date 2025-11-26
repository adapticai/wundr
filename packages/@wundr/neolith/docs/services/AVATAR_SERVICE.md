# Avatar Service

Complete S3-based avatar storage system with OAuth integration, image processing, and fallback generation.

## Features

- **OAuth Integration**: Automatically downloads and stores avatars from Google and GitHub during sign-in
- **Image Processing**: Generates multiple size variants (32px, 64px, 128px, 256px) using Sharp
- **Fallback Avatars**: Generates SVG-based initials avatars with consistent colors
- **S3 Storage**: Supports AWS S3, Cloudflare R2, and MinIO
- **CDN Ready**: Configurable public URL base for CDN integration
- **Manual Upload**: API endpoint for users to change their avatar

## Architecture

### Size Variants

The service generates 4 size variants for every avatar:

```typescript
AVATAR_SIZES = {
  SMALL: 32,    // Thumbnails, small UI elements
  MEDIUM: 64,   // Chat messages, notifications
  LARGE: 128,   // Profile cards, sidebars
  XLARGE: 256,  // Profile pages, full view
}
```

### Storage Structure

Avatars are stored in S3 with the following key structure:

```
avatars/
  {userId}/
    avatar-small-{timestamp}-{id}.jpg
    avatar-medium-{timestamp}-{id}.jpg
    avatar-large-{timestamp}-{id}.jpg
    avatar-xlarge-{timestamp}-{id}.jpg
    fallback-small-{timestamp}-{id}.jpg
    ...
```

## Configuration

### Environment Variables

#### Main Storage (Required)

```bash
# S3-compatible storage provider
STORAGE_PROVIDER=s3              # s3 | r2 | minio
STORAGE_BUCKET=my-app-files
STORAGE_REGION=us-east-1

# AWS credentials
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY

# For R2/MinIO
STORAGE_ENDPOINT=https://your-account.r2.cloudflarestorage.com
STORAGE_PUBLIC_URL=https://cdn.yourapp.com
```

#### Avatar-Specific Storage (Optional)

Use a separate bucket for avatars for better security and CDN configuration:

```bash
# Dedicated avatar bucket
AVATAR_STORAGE_PROVIDER=s3
AVATAR_STORAGE_BUCKET=my-app-avatars
AVATAR_STORAGE_REGION=us-east-1

# Separate credentials (optional)
AVATAR_STORAGE_ACCESS_KEY_ID=...
AVATAR_STORAGE_SECRET_ACCESS_KEY=...

# CDN for avatars
AVATAR_STORAGE_PUBLIC_URL=https://avatars.cdn.yourapp.com
```

### AWS S3 Setup

1. **Create S3 Bucket**:
```bash
aws s3 mb s3://my-app-avatars --region us-east-1
```

2. **Configure CORS** (for direct uploads):
```json
[
  {
    "AllowedOrigins": ["https://yourapp.com"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

3. **Set Bucket Policy** (for public read access):
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::my-app-avatars/*"
    }
  ]
}
```

4. **Configure CloudFront CDN** (recommended):
   - Create CloudFront distribution
   - Set origin to S3 bucket
   - Enable caching
   - Set `AVATAR_STORAGE_PUBLIC_URL` to CloudFront domain

### Cloudflare R2 Setup

1. **Create R2 Bucket**:
```bash
wrangler r2 bucket create my-app-avatars
```

2. **Create API Token**:
   - Go to R2 > Manage R2 API Tokens
   - Create token with read/write permissions
   - Use token for `AVATAR_STORAGE_ACCESS_KEY_ID` and `AVATAR_STORAGE_SECRET_ACCESS_KEY`

3. **Enable Public Access**:
   - Connect custom domain to bucket
   - Set `AVATAR_STORAGE_PUBLIC_URL` to custom domain

## Usage

### Service API

```typescript
import { avatarService } from '@neolith/core/services';

// Upload avatar from buffer or file
const result = await avatarService.uploadAvatar({
  userId: 'user_123',
  source: buffer, // Buffer, URL, or base64 data URL
  filename: 'avatar.jpg',
});

// Download OAuth provider avatar
const result = await avatarService.uploadOAuthAvatar({
  userId: 'user_123',
  providerAvatarUrl: 'https://avatars.githubusercontent.com/u/123456',
  provider: 'github',
});

// Generate fallback avatar with initials
const result = await avatarService.generateFallbackAvatar({
  name: 'John Doe',
  userId: 'user_123',
});

// Get avatar URL with specific size
const url = await avatarService.getAvatarUrl('user_123', 'MEDIUM');

// Delete avatar (generates fallback)
await avatarService.deleteAvatar('user_123');
```

### REST API

#### Get Avatar URL

```bash
GET /api/users/:id/avatar?size=LARGE

Response:
{
  "url": "https://avatars.cdn.app.com/avatars/user_123/avatar-large-123.jpg",
  "size": "LARGE"
}
```

#### Upload Avatar (File)

```bash
POST /api/users/:id/avatar
Content-Type: multipart/form-data

file: [binary data]

Response:
{
  "success": true,
  "avatar": {
    "url": "https://...",
    "variants": {
      "SMALL": "https://...",
      "MEDIUM": "https://...",
      "LARGE": "https://...",
      "XLARGE": "https://..."
    }
  }
}
```

#### Upload Avatar (URL or Base64)

```bash
POST /api/users/:id/avatar
Content-Type: application/json

{
  "source": "https://example.com/avatar.jpg"
  // OR
  "source": "data:image/png;base64,iVBORw0KGgoAAAANS..."
}
```

#### Delete Avatar

```bash
DELETE /api/users/:id/avatar

Response:
{
  "success": true,
  "message": "Avatar deleted and fallback generated",
  "avatar": {
    "url": "https://...",
    "variants": { ... }
  }
}
```

### OAuth Integration

Avatars are automatically processed during OAuth sign-in:

1. **OAuth Callback** receives user profile with avatar URL
2. **Avatar Service** downloads the provider avatar
3. **Image Processing** generates all size variants
4. **S3 Upload** stores all variants
5. **Database Update** sets `User.image` to XLARGE URL
6. **Fallback on Failure** generates initials-based avatar

## Image Processing

### Processing Pipeline

1. **Download/Decode**: Fetch from URL or decode base64
2. **Validation**: Check format (JPEG, PNG, WebP, GIF) and size (<10MB)
3. **Resize**: Generate 4 size variants with Sharp
4. **Optimize**: JPEG quality 85%, progressive encoding
5. **Upload**: Store all variants in S3
6. **Database Update**: Save XLARGE URL to `User.avatarUrl`

### Fallback Avatar Generation

When OAuth doesn't provide an avatar or user deletes their avatar:

1. **Extract Initials**: First letter of first and last name (or first 2 letters)
2. **Generate Color**: Consistent HSL color based on user ID
3. **Create SVG**: Initials centered on colored background
4. **Convert to PNG**: All 4 size variants
5. **Upload**: Store in S3 with "fallback" prefix

Example fallback avatar for "John Doe":

```svg
<svg width="256" height="256">
  <rect width="256" height="256" fill="hsl(182, 72%, 52%)"/>
  <text x="50%" y="50%"
        font-size="102"
        fill="#FFFFFF"
        text-anchor="middle"
        dominant-baseline="central">JD</text>
</svg>
```

## CDN Configuration

### CloudFront Cache Headers

Set in S3 upload metadata:

```typescript
CacheControl: 'public, max-age=31536000, immutable'
```

Recommended CloudFront settings:
- **Minimum TTL**: 86400 (1 day)
- **Maximum TTL**: 31536000 (1 year)
- **Default TTL**: 604800 (1 week)
- **Compress Objects**: Yes
- **Viewer Protocol Policy**: HTTPS only

### Cache Invalidation

When user updates avatar, old files are **not** deleted to prevent CDN cache issues. Instead:

1. Generate new filename with timestamp and unique ID
2. Upload new variants
3. Update `User.avatarUrl` to new URL
4. Old URLs remain accessible until TTL expires

## Security

### Access Control

- **Upload**: User can only upload their own avatar (or admin can upload any)
- **Delete**: User can only delete their own avatar (or admin can delete any)
- **Read**: Avatars are public (read-only via CDN)

### Validation

- **File Size**: Max 10MB
- **File Type**: JPEG, PNG, WebP, GIF only
- **Dimensions**: Auto-resized, no dimension limits
- **Content**: No virus/malware scanning (consider adding in production)

### Best Practices

1. **Separate Bucket**: Use dedicated bucket for avatars
2. **CDN**: Always use CDN for production (CloudFront, Cloudflare)
3. **CORS**: Configure minimal CORS for security
4. **Encryption**: Enable S3 encryption at rest (AES-256)
5. **Backup**: Enable S3 versioning for disaster recovery
6. **Monitoring**: Set up CloudWatch alerts for upload failures

## Performance

### Optimization Techniques

1. **Lazy Loading**: Only load required size variant
2. **Progressive JPEG**: Faster perceived loading
3. **CDN Caching**: Reduce origin requests by 99%+
4. **Compression**: JPEG quality 85% (good balance)
5. **Immutable URLs**: Infinite cache with unique filenames

### Benchmarks

- **Upload + Processing**: ~500ms (4 variants)
- **OAuth Download**: ~200ms (depends on provider)
- **Fallback Generation**: ~100ms (SVG to PNG)
- **CDN Response**: <50ms (after first request)

## Error Handling

### Common Errors

| Error | HTTP | Description |
|-------|------|-------------|
| `InvalidAvatarError` | 400 | Invalid format or corrupted file |
| `AvatarDownloadError` | 502 | Failed to download from provider |
| `AvatarProcessingError` | 500 | Image processing failed |
| `AvatarServiceError` | 500 | Generic service error |

### Retry Strategy

OAuth avatar downloads include automatic fallback:

```typescript
try {
  // Try downloading OAuth avatar
  await avatarService.uploadOAuthAvatar(...);
} catch {
  // Fall back to initials-based avatar
  await avatarService.generateFallbackAvatar(...);
}
```

## Testing

### Unit Tests

Test avatar service with mocked S3:

```typescript
import { createAvatarService } from '@neolith/core/services';
import { MockS3 } from '@neolith/core/test-utils';

const mockStorage = new MockS3();
const avatarService = createAvatarService(mockStorage);

// Test upload
const result = await avatarService.uploadAvatar({
  userId: 'test_user',
  source: testBuffer,
});

expect(result.variants).toHaveProperty('SMALL');
expect(result.variants).toHaveProperty('XLARGE');
```

### Integration Tests

Test with real S3 (development bucket):

```bash
# Set test credentials
export AVATAR_STORAGE_BUCKET=test-avatars-bucket
export AWS_ACCESS_KEY_ID=...
export AWS_SECRET_ACCESS_KEY=...

# Run tests
npm run test:integration -- avatar-service
```

## Migration

### Migrating Existing Avatars

If you have existing avatar URLs (e.g., from OAuth), migrate them:

```typescript
import { prisma } from '@neolith/database';
import { avatarService } from '@neolith/core/services';

async function migrateAvatars() {
  const users = await prisma.user.findMany({
    where: {
      avatarUrl: { not: null },
      // Optional: only migrate external URLs
      avatarUrl: { startsWith: 'https://avatars.githubusercontent.com' },
    },
  });

  for (const user of users) {
    try {
      await avatarService.uploadAvatar({
        userId: user.id,
        source: user.avatarUrl!,
      });
      console.log(`Migrated avatar for ${user.email}`);
    } catch (error) {
      console.error(`Failed to migrate ${user.email}:`, error);

      // Generate fallback
      await avatarService.generateFallbackAvatar({
        name: user.name || user.email!,
        userId: user.id,
      });
    }
  }
}
```

## Troubleshooting

### Avatar Not Displaying

1. **Check S3 permissions**: Ensure bucket policy allows public read
2. **Verify CORS**: Check browser console for CORS errors
3. **Test CDN**: Try accessing URL directly
4. **Check database**: Verify `User.avatarUrl` is set

### Upload Failing

1. **Check credentials**: Verify AWS keys are correct
2. **Test S3 access**: Use AWS CLI to test bucket access
3. **Check file size**: Ensure file is under 10MB
4. **Verify format**: Only JPEG, PNG, WebP, GIF supported

### Slow Performance

1. **Enable CDN**: Must use CloudFront/Cloudflare in production
2. **Check region**: Use S3 region closest to users
3. **Optimize images**: Ensure Sharp is processing correctly
4. **Monitor metrics**: Use CloudWatch to identify bottlenecks

## Roadmap

- [ ] Add video avatar support (animated GIFs, short videos)
- [ ] Implement AI-based cropping (face detection)
- [ ] Add WebP format generation for modern browsers
- [ ] Support custom avatar frames/borders
- [ ] Add avatar history/versioning
- [ ] Implement avatar moderation/filtering
- [ ] Add batch migration CLI tool
- [ ] Support signed URLs for private avatars
