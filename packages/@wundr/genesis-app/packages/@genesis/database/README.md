# @genesis/database

Prisma database client and schema for the Genesis App. Provides a singleton client optimized for
serverless environments with connection pooling.

## Installation

```bash
npm install @genesis/database
```

## Setup

### 1. Environment Variables

Create a `.env` file in the root of your project:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/genesis?schema=public"
```

For production with connection pooling (e.g., PgBouncer):

```env
DATABASE_URL="postgresql://user:password@pooler.example.com:6543/genesis?pgbouncer=true"
```

### 2. Generate Prisma Client

```bash
npm run db:generate
```

## Migration Commands

### Development

Create and apply migrations during development:

```bash
# Create a new migration
npm run db:migrate

# Apply migrations without creating new ones
npx prisma migrate dev --name <migration-name>

# Reset the database (destructive!)
npx prisma migrate reset
```

### Production

Deploy migrations to production:

```bash
npm run db:migrate:deploy
```

### Database Push (Prototyping)

Push schema changes directly without creating migrations (useful for prototyping):

```bash
npm run db:push
```

## Client Usage Examples

### Basic Usage

```typescript
import { prisma } from '@genesis/database';

// Find all users
const users = await prisma.user.findMany();

// Create a user
const user = await prisma.user.create({
  data: {
    email: 'user@example.com',
    name: 'John Doe',
  },
});

// Find user by email
const existingUser = await prisma.user.findUnique({
  where: { email: 'user@example.com' },
});
```

### With Type Safety

```typescript
import { prisma, type Prisma } from '@genesis/database';

// Type-safe input
const userData: Prisma.UserCreateInput = {
  email: 'user@example.com',
  name: 'John Doe',
  role: 'MEMBER',
};

const user = await prisma.user.create({ data: userData });
```

### Transactions

```typescript
import { prisma } from '@genesis/database';

const result = await prisma.$transaction(async tx => {
  const user = await tx.user.create({
    data: { email: 'user@example.com' },
  });

  // More operations within the same transaction
  // ...

  return user;
});
```

### Health Check

```typescript
import { healthCheck } from '@genesis/database';

const status = await healthCheck();

if (status.connected) {
  console.log(`Database connected (latency: ${status.latencyMs}ms)`);
} else {
  console.error(`Database connection failed: ${status.error}`);
}
```

### Connection Management

```typescript
import { connect, disconnect } from '@genesis/database';

// Pre-warm connection (useful for serverless cold starts)
await connect();

// Graceful shutdown
process.on('SIGTERM', async () => {
  await disconnect();
  process.exit(0);
});
```

## Seeding Instructions

### 1. Create Seed File

Create `prisma/seed.ts`:

```typescript
import { prisma } from '../src';

async function main() {
  // Clear existing data (optional)
  await prisma.user.deleteMany();

  // Seed users
  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@genesis.app',
      name: 'Admin User',
      role: 'ADMIN',
    },
  });

  console.log('Seeded admin user:', adminUser);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

### 2. Configure package.json

The `db:seed` script is already configured in package.json:

```json
{
  "prisma": {
    "seed": "ts-node prisma/seed.ts"
  }
}
```

### 3. Run Seeding

```bash
# Run seed manually
npm run db:seed

# Seed automatically after migrations
npx prisma migrate reset
```

## Prisma Studio

Launch the visual database editor:

```bash
npm run db:studio
```

This opens a web interface at `http://localhost:5555` for browsing and editing data.

## Serverless Optimization

This package is optimized for serverless environments (Vercel, AWS Lambda, etc.):

- **Connection Pooling**: Automatically configured connection limits
- **Singleton Pattern**: Prevents connection pool exhaustion during hot reloads
- **Pre-warming**: Use `connect()` to warm up connections before handling requests

### Recommended Configuration for Vercel

```env
DATABASE_URL="postgresql://user:pass@host:5432/db?connection_limit=5&pool_timeout=20"
```

### Using Prisma Accelerate

For better serverless performance, consider using
[Prisma Accelerate](https://www.prisma.io/accelerate):

```env
DATABASE_URL="prisma://accelerate.prisma-data.net/?api_key=YOUR_API_KEY"
```

## Development

```bash
# Build the package
npm run build

# Generate Prisma client
npm run db:generate

# Open Prisma Studio
npm run db:studio
```

## License

MIT
