"use strict";
/**
 * Monorepo Template - Turborepo
 * Complete platform with multiple apps and packages
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.monorepoTurborepoTemplate = void 0;
exports.monorepoTurborepoTemplate = {
    name: 'monorepo-turborepo',
    type: 'monorepo',
    framework: 'turborepo',
    displayName: 'Turborepo Monorepo Platform',
    description: 'Full-featured monorepo with frontend, backend, and shared packages',
    dependencies: {
        turbo: '^2.0.0',
    },
    devDependencies: {
        '@changesets/cli': '^2.27.1',
        '@types/node': '^20.11.24',
        eslint: '^8.57.0',
        prettier: '^3.2.5',
        typescript: '^5.3.3',
        husky: '^9.0.11',
        'lint-staged': '^15.2.2',
        '@commitlint/cli': '^19.0.3',
        '@commitlint/config-conventional': '^19.0.3',
    },
    scripts: {
        dev: 'turbo dev',
        build: 'turbo build',
        test: 'turbo test',
        lint: 'turbo lint',
        typecheck: 'turbo typecheck',
        format: 'prettier --write "**/*.{ts,tsx,md,json}"',
        clean: 'turbo clean && rm -rf node_modules',
        changeset: 'changeset',
        version: 'changeset version',
        publish: 'turbo build && changeset publish',
        analyze: 'wundr analyze',
        govern: 'wundr govern check',
        prepare: 'husky install',
    },
    files: [
        {
            path: 'turbo.json',
            content: `{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": ["**/.env.*local"],
  "globalEnv": ["NODE_ENV"],
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "!.next/cache/**", "dist/**"],
      "env": ["DATABASE_URL", "NEXT_PUBLIC_*"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": ["^build"]
    },
    "typecheck": {
      "dependsOn": ["^build"]
    },
    "test": {
      "dependsOn": ["build"],
      "outputs": ["coverage/**"],
      "env": ["NODE_ENV"]
    },
    "clean": {
      "cache": false
    }
  }
}`,
        },
        {
            path: 'pnpm-workspace.yaml',
            content: `packages:
  - "apps/*"
  - "packages/*"`,
        },
        {
            path: 'apps/web/package.json',
            content: `{
  "name": "@{{projectNameKebab}}/web",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev --port 3001",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@{{projectNameKebab}}/ui": "workspace:*",
    "@{{projectNameKebab}}/utils": "workspace:*",
    "@{{projectNameKebab}}/database": "workspace:*",
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@{{projectNameKebab}}/tsconfig": "workspace:*",
    "@types/node": "^20.11.24",
    "@types/react": "^18.2.63",
    "@types/react-dom": "^18.2.20",
    "typescript": "^5.3.3"
  }
}`,
            template: true,
        },
        {
            path: 'apps/api/package.json',
            content: `{
  "name": "@{{projectNameKebab}}/api",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "lint": "eslint src --ext .ts",
    "typecheck": "tsc --noEmit",
    "test": "jest"
  },
  "dependencies": {
    "@{{projectNameKebab}}/database": "workspace:*",
    "@{{projectNameKebab}}/utils": "workspace:*",
    "fastify": "^4.26.1",
    "@fastify/cors": "^9.0.1",
    "@fastify/helmet": "^11.1.1",
    "@fastify/jwt": "^8.0.0",
    "@prisma/client": "^5.11.0"
  },
  "devDependencies": {
    "@{{projectNameKebab}}/tsconfig": "workspace:*",
    "@types/node": "^20.11.24",
    "tsx": "^4.7.1",
    "typescript": "^5.3.3",
    "jest": "^29.7.0",
    "ts-jest": "^29.1.2"
  }
}`,
            template: true,
        },
        {
            path: 'apps/admin/package.json',
            content: `{
  "name": "@{{projectNameKebab}}/admin",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev --port 3002",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@{{projectNameKebab}}/ui": "workspace:*",
    "@{{projectNameKebab}}/utils": "workspace:*",
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@{{projectNameKebab}}/tsconfig": "workspace:*",
    "@types/node": "^20.11.24",
    "@types/react": "^18.2.63",
    "@types/react-dom": "^18.2.20",
    "typescript": "^5.3.3"
  }
}`,
            template: true,
        },
        {
            path: 'packages/ui/package.json',
            content: `{
  "name": "@{{projectNameKebab}}/ui",
  "version": "1.0.0",
  "main": "./dist/index.js",
  "module": "./dist/index.mjs",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "lint": "eslint src --ext .ts,.tsx",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@radix-ui/react-slot": "^1.0.2",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.0",
    "lucide-react": "^0.344.0",
    "tailwind-merge": "^2.2.1"
  },
  "devDependencies": {
    "@{{projectNameKebab}}/tsconfig": "workspace:*",
    "@types/react": "^18.2.63",
    "react": "^19.0.0",
    "tsup": "^8.0.2",
    "typescript": "^5.3.3"
  },
  "peerDependencies": {
    "react": ">=18"
  }
}`,
            template: true,
        },
        {
            path: 'packages/database/package.json',
            content: `{
  "name": "@{{projectNameKebab}}/database",
  "version": "1.0.0",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "db:generate": "prisma generate",
    "db:push": "prisma db push",
    "db:migrate": "prisma migrate dev",
    "db:seed": "tsx prisma/seed.ts",
    "lint": "eslint src --ext .ts",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@prisma/client": "^5.11.0"
  },
  "devDependencies": {
    "@{{projectNameKebab}}/tsconfig": "workspace:*",
    "prisma": "^5.11.0",
    "tsx": "^4.7.1",
    "typescript": "^5.3.3"
  }
}`,
            template: true,
        },
        {
            path: 'packages/utils/package.json',
            content: `{
  "name": "@{{projectNameKebab}}/utils",
  "version": "1.0.0",
  "main": "./dist/index.js",
  "module": "./dist/index.mjs",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "test": "jest",
    "lint": "eslint src --ext .ts",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "zod": "^3.22.4"
  },
  "devDependencies": {
    "@{{projectNameKebab}}/tsconfig": "workspace:*",
    "jest": "^29.7.0",
    "ts-jest": "^29.1.2",
    "tsup": "^8.0.2",
    "typescript": "^5.3.3"
  }
}`,
            template: true,
        },
        {
            path: 'packages/config/package.json',
            content: `{
  "name": "@{{projectNameKebab}}/config",
  "version": "1.0.0",
  "main": "index.js",
  "files": [
    "eslint-preset.js",
    "tailwind.config.js",
    "jest.config.js"
  ]
}`,
            template: true,
        },
        {
            path: 'packages/tsconfig/package.json',
            content: `{
  "name": "@{{projectNameKebab}}/tsconfig",
  "version": "1.0.0",
  "private": true,
  "files": [
    "base.json",
    "nextjs.json",
    "node.json",
    "react-library.json"
  ]
}`,
            template: true,
        },
        {
            path: 'packages/tsconfig/base.json',
            content: `{
  "$schema": "https://json.schemastore.org/tsconfig",
  "display": "Default",
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020"],
    "module": "commonjs",
    "moduleResolution": "node",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "inlineSources": false,
    "isolatedModules": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "preserveWatchOutput": true,
    "resolveJsonModule": true
  },
  "exclude": ["node_modules"]
}`,
        },
        {
            path: '.changeset/config.json',
            content: `{
  "$schema": "https://unpkg.com/@changesets/config@3.0.0/schema.json",
  "changelog": "@changesets/cli/changelog",
  "commit": false,
  "fixed": [],
  "linked": [],
  "access": "restricted",
  "baseBranch": "main",
  "updateInternalDependencies": "patch",
  "ignore": []
}`,
        },
        {
            path: 'README.md',
            content: `# {{projectName}}

{{description}}

## Structure

This monorepo contains:

### Apps
- \`web\` - Next.js frontend application
- \`api\` - Fastify backend API
- \`admin\` - Admin dashboard

### Packages
- \`ui\` - Shared React components
- \`database\` - Prisma database schema
- \`utils\` - Shared utilities
- \`config\` - Shared configuration
- \`tsconfig\` - TypeScript configurations

## Development

\`\`\`bash
# Install dependencies
pnpm install

# Start development servers
pnpm dev

# Build all packages
pnpm build

# Run tests
pnpm test

# Run governance checks
pnpm govern
\`\`\`

## Wundr Integration

This project is wundr-compliant with:
- Governance baselines in \`.wundr/\`
- Claude AI integration via \`CLAUDE.md\`
- Automated quality checks
- Drift detection

## Tech Stack

- **Turborepo** - Build orchestration
- **Next.js** - Frontend framework
- **Fastify** - Backend API
- **Prisma** - Database ORM
- **TypeScript** - Type safety
- **pnpm** - Package management`,
            template: true,
        },
    ],
    postInstall: [
        'pnpm install',
        'npx husky install',
        'npx husky add .husky/pre-commit "pnpm lint && pnpm typecheck"',
        'npx husky add .husky/commit-msg "npx --no -- commitlint --edit $1"',
    ],
};
//# sourceMappingURL=monorepo-turborepo.js.map