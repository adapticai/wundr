# Genesis Web Application

The main web interface for the Genesis organization builder platform.

## Overview

This Next.js 14 application provides the user interface for creating and managing AI-powered
organizations through Genesis.

## Getting Started

### Prerequisites

- Node.js 18.17 or later
- pnpm 8.0 or later

### Installation

From the monorepo root:

```bash
# Install all dependencies
pnpm install

# Navigate to the web app
cd packages/@wundr/genesis-app/apps/web
```

### Development

```bash
# Start the development server
pnpm dev

# The app will be available at http://localhost:3000
```

### Build

```bash
# Build for production
pnpm build

# Start production server
pnpm start
```

### Type Checking

```bash
pnpm typecheck
```

### Linting

```bash
pnpm lint
```

## Project Structure

```
apps/web/
├── app/                    # Next.js App Router
│   ├── (auth)/            # Authentication routes
│   │   └── layout.tsx     # Auth layout with centered card
│   ├── (workspace)/       # Workspace routes (authenticated)
│   │   └── layout.tsx     # Workspace layout with sidebar
│   ├── globals.css        # Global styles and CSS variables
│   ├── layout.tsx         # Root layout with providers
│   └── page.tsx           # Landing page
├── components/            # React components (to be added)
├── hooks/                 # Custom React hooks (to be added)
├── lib/                   # Utility functions (to be added)
├── public/                # Static assets
├── types/                 # TypeScript type definitions (to be added)
├── next.config.js         # Next.js configuration
├── package.json           # Dependencies and scripts
├── postcss.config.js      # PostCSS configuration
├── tailwind.config.ts     # Tailwind CSS configuration
└── tsconfig.json          # TypeScript configuration
```

## Route Groups

### `(auth)` - Authentication Routes

Unauthenticated routes for sign-in, sign-up, and password reset. Uses a centered card layout.

- `/signin` - Sign in page
- `/signup` - Sign up page
- `/forgot-password` - Password reset request
- `/reset-password` - Password reset confirmation

### `(workspace)` - Workspace Routes

Authenticated routes for the main application. Uses a sidebar navigation layout.

- `/dashboard` - Main dashboard
- `/organizations` - Organization management
- `/agents` - Agent configuration
- `/workflows` - Workflow builder
- `/deployments` - Deployment management
- `/settings` - User and organization settings

## Configuration

### Environment Variables

Create a `.env.local` file:

```env
# Authentication
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-here

# Database (for NextAuth adapter)
DATABASE_URL=postgresql://user:password@localhost:5432/genesis

# API
NEXT_PUBLIC_API_URL=http://localhost:4000/graphql

# OAuth Providers (optional)
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

### Shared Packages

This app uses shared packages from the monorepo:

- `@genesis/typescript-config` - TypeScript configuration
- `@genesis/eslint-config` - ESLint rules
- `@genesis/tailwind-config` - Tailwind CSS preset
- `@genesis/ui` - Shared UI components (to be added)

## Features

### Current (Phase 0)

- Basic project structure
- App Router setup with route groups
- Tailwind CSS with CSS variables for theming
- Authentication layout placeholder
- Workspace layout with sidebar navigation
- Landing page with feature highlights

### Planned

- NextAuth.js integration with multiple providers
- Apollo Client for GraphQL API
- Dark mode support
- Organization CRUD operations
- Agent management interface
- Workflow visual builder
- Real-time updates with subscriptions

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript 5.3
- **Styling**: Tailwind CSS 3.4
- **Authentication**: NextAuth.js 4
- **API Client**: Apollo Client 3
- **State Management**: React Context + Apollo Cache

## Contributing

1. Follow the coding standards defined in `@genesis/eslint-config`
2. Write tests for new features
3. Update documentation as needed
4. Use conventional commits

## License

Proprietary - Wundr
