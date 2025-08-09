# @wundr/project-templates

Wundr-compliant project templates with opinionated best practices for scaffolding new projects.

## 🚀 Overview

The `@wundr/project-templates` package provides production-ready project templates that come pre-configured with Wundr's best practices, including TypeScript, testing, linting, CI/CD, and governance baselines. Every project created is ready for immediate development with all quality tools configured.

## ✨ Features

- **Production-Ready Templates** - Frontend, Backend, Monorepo, Full-stack
- **Complete Tool Setup** - TypeScript, ESLint, Prettier, Jest/Vitest
- **CI/CD Included** - GitHub Actions workflows pre-configured
- **Wundr Governance** - Quality baselines and drift detection
- **AI-Ready** - CLAUDE.md configuration for AI assistance
- **Git Hooks** - Husky + lint-staged for code quality
- **Docker Support** - Optional containerization

## 📦 Installation

As part of the Wundr CLI:
```bash
npm install -g @wundr/cli
```

Or standalone:
```bash
npm install -g @wundr/project-templates
```

## 🎯 Quick Start

### Create a Frontend Application
```bash
wundr create frontend my-app
```

### Create a Backend API
```bash
wundr create backend my-api
```

### Create a Monorepo
```bash
wundr create monorepo my-platform
```

### Create a Full-Stack Application
```bash
wundr create fullstack my-project
```

## 📋 Available Templates

### Frontend (Next.js)
Modern React application with Next.js 15 and best practices.

**Stack:**
- Next.js 15 with App Router
- TypeScript 5.2+ (strict mode)
- Tailwind CSS 3.4
- shadcn/ui components
- Radix UI primitives
- React Query for data fetching
- Zustand for state management
- React Hook Form + Zod validation

**Features:**
- Server-side rendering (SSR)
- Static site generation (SSG)
- API routes
- Optimized images and fonts
- PWA ready
- SEO optimized
- Accessibility (WCAG 2.1 AA)

**Structure:**
```
my-app/
├── app/                    # Next.js app directory
│   ├── (auth)/            # Auth group routes
│   ├── api/               # API routes
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Home page
├── components/            # React components
│   ├── ui/               # shadcn/ui components
│   └── features/         # Feature components
├── lib/                   # Utilities
├── hooks/                 # Custom React hooks
├── styles/               # Global styles
├── public/               # Static assets
└── tests/                # Test files
```

### Backend (Fastify)
High-performance Node.js API with Fastify and enterprise features.

**Stack:**
- Fastify 4+ (high performance)
- TypeScript 5.2+ (strict mode)
- Prisma ORM
- OpenAPI/Swagger documentation
- Winston logging
- Bull for job queues
- Redis for caching
- JWT authentication

**Features:**
- RESTful API design
- GraphQL support (optional)
- Database migrations
- Request validation
- Error handling
- Rate limiting
- Health checks
- Metrics endpoint

**Structure:**
```
my-api/
├── src/
│   ├── controllers/      # Route handlers
│   ├── services/        # Business logic
│   ├── models/          # Data models
│   ├── middleware/      # Custom middleware
│   ├── plugins/         # Fastify plugins
│   ├── utils/           # Utilities
│   └── index.ts         # Entry point
├── prisma/
│   ├── schema.prisma    # Database schema
│   └── migrations/      # Database migrations
├── tests/               # Test files
└── docs/                # API documentation
```

### Monorepo (Turborepo)
Scalable monorepo setup with Turborepo and multiple packages.

**Stack:**
- Turborepo for build orchestration
- pnpm workspaces
- Shared TypeScript configs
- Unified ESLint/Prettier
- Changeset for versioning
- Shared component library
- Multiple applications

**Features:**
- Optimized builds with caching
- Parallel task execution
- Shared dependencies
- Cross-package imports
- Unified CI/CD
- Package publishing ready

**Structure:**
```
my-platform/
├── apps/
│   ├── web/             # Frontend application
│   ├── api/             # Backend API
│   └── admin/           # Admin dashboard
├── packages/
│   ├── ui/              # Shared UI components
│   ├── config/          # Shared configurations
│   ├── database/        # Database client
│   └── utils/           # Shared utilities
├── turbo.json           # Turborepo config
└── pnpm-workspace.yaml  # Workspace config
```

### Full-Stack
Complete application with frontend, backend, and shared packages.

**Includes:**
- Next.js frontend
- Fastify backend
- Shared types package
- Database package
- UI component library
- Unified authentication
- End-to-end type safety

## 🔧 Configuration Files

Every template includes:

### Wundr Configuration
```
.wundr/
├── baseline.json        # Quality baseline metrics
├── config.yaml         # Project configuration
├── patterns.yaml       # Approved code patterns
└── drift-check.yaml    # Drift detection rules
```

### Development Tools
```
.husky/                  # Git hooks
.github/workflows/       # CI/CD pipelines
.vscode/                # VS Code settings
.eslintrc.json          # ESLint configuration
.prettierrc             # Prettier configuration
jest.config.js          # Jest configuration
tsconfig.json           # TypeScript configuration
CLAUDE.md               # AI assistant instructions
```

## 💻 CLI Options

### Create Command Options
```bash
# Skip git initialization
wundr create frontend my-app --no-git

# Skip dependency installation
wundr create backend my-api --no-install

# Include Docker configuration
wundr create monorepo my-platform --docker

# Specify package manager
wundr create frontend my-app --package-manager pnpm

# Custom path
wundr create backend my-api --path ./projects

# With description
wundr create fullstack my-project --description "My awesome project"
```

### Interactive Mode
```bash
# Interactive project creation
wundr create project

# Will prompt for:
# - Project type (frontend/backend/monorepo/fullstack)
# - Project name
# - Description
# - Author
# - Package manager
# - Additional features
```

## 📊 Included Scripts

All templates include these npm scripts:

```json
{
  "scripts": {
    "dev": "Start development server",
    "build": "Build for production",
    "start": "Start production server",
    "test": "Run tests",
    "test:watch": "Run tests in watch mode",
    "test:coverage": "Generate coverage report",
    "lint": "Lint code",
    "lint:fix": "Fix linting issues",
    "format": "Format code with Prettier",
    "typecheck": "Type check with TypeScript",
    "prepare": "Setup Husky hooks",
    "analyze": "Analyze with Wundr",
    "govern:check": "Check governance compliance"
  }
}
```

## 🚀 Post-Creation Steps

After creating a project:

```bash
# Navigate to project
cd my-app

# Install dependencies (if not auto-installed)
pnpm install

# Start development
pnpm dev

# Run initial analysis
pnpm analyze

# Create governance baseline
pnpm govern:baseline
```

## 🎯 Best Practices Included

### Code Quality
- TypeScript strict mode enabled
- ESLint with recommended rules
- Prettier for consistent formatting
- Import sorting configured
- No console.log in production

### Testing
- Jest/Vitest configured
- Testing utilities included
- Coverage thresholds set
- E2E test setup (Playwright)

### Git Workflow
- Conventional commits enforced
- Pre-commit hooks for linting
- Pre-push hooks for testing
- Protected branch rules

### CI/CD
- GitHub Actions workflows
- Automated testing
- Build verification
- Dependency caching
- Release automation

### Documentation
- README template
- API documentation
- Component documentation
- Contribution guidelines

## 📄 API Usage

```typescript
import { projectTemplates } from '@wundr/project-templates';

// Create a project programmatically
await projectTemplates.createProject({
  name: 'my-app',
  type: 'frontend',
  framework: 'next',
  path: './projects',
  install: true,
  git: true
});

// Get template information
const templates = projectTemplates.listTemplates();

// Validate project name
const isValid = projectTemplates.validateProjectName('my-app');
```

## 🔧 Template Customization

Templates use Handlebars for variable substitution:

```typescript
// Template variables available
interface TemplateVariables {
  projectName: string;
  projectDescription: string;
  author: string;
  email: string;
  year: number;
  license: string;
  packageManager: 'npm' | 'pnpm' | 'yarn';
}
```

## 🤝 Contributing

We welcome new templates! To contribute:

1. Create a new template in `src/templates/`
2. Define the template structure
3. Add configuration files
4. Include documentation
5. Submit a pull request

## 📄 License

MIT - See [LICENSE](../../../LICENSE) for details.