/**
 * Frontend Template - Next.js with shadcn/ui
 * Opinionated stack for modern web applications
 */

import type { TemplateConfig } from '../types';

export const frontendNextTemplate: TemplateConfig = {
  name: 'frontend-next',
  type: 'frontend',
  framework: 'next',
  displayName: 'Next.js Frontend Application',
  description:
    'Modern Next.js 15 app with shadcn/ui, Tailwind CSS, and TypeScript',

  dependencies: {
    next: '^15.0.0',
    react: '^19.0.0',
    'react-dom': '^19.0.0',
    '@radix-ui/react-accordion': '^1.1.2',
    '@radix-ui/react-alert-dialog': '^1.0.5',
    '@radix-ui/react-dialog': '^1.0.5',
    '@radix-ui/react-dropdown-menu': '^2.0.6',
    '@radix-ui/react-label': '^2.0.2',
    '@radix-ui/react-select': '^2.0.0',
    '@radix-ui/react-slot': '^1.0.2',
    '@radix-ui/react-toast': '^1.1.5',
    'class-variance-authority': '^0.7.0',
    clsx: '^2.1.0',
    'lucide-react': '^0.344.0',
    'tailwind-merge': '^2.2.1',
    'tailwindcss-animate': '^1.0.7',
    '@tanstack/react-query': '^5.28.4',
    zustand: '^4.5.1',
    'react-hook-form': '^7.50.1',
    zod: '^3.22.4',
    '@hookform/resolvers': '^3.3.4',
    '@prisma/client': '^5.11.0',
    axios: '^1.6.7',
  },

  devDependencies: {
    '@types/node': '^20.11.24',
    '@types/react': '^18.2.63',
    '@types/react-dom': '^18.2.20',
    typescript: '^5.3.3',
    eslint: '^8.57.0',
    'eslint-config-next': '^14.1.3',
    prettier: '^3.2.5',
    'prettier-plugin-tailwindcss': '^0.5.11',
    tailwindcss: '^3.4.1',
    autoprefixer: '^10.4.18',
    postcss: '^8.4.35',
    '@testing-library/react': '^14.2.1',
    '@testing-library/jest-dom': '^6.4.2',
    jest: '^29.7.0',
    'jest-environment-jsdom': '^29.7.0',
    prisma: '^5.11.0',
    husky: '^9.0.11',
    'lint-staged': '^15.2.2',
    '@commitlint/cli': '^19.0.3',
    '@commitlint/config-conventional': '^19.0.3',
  },

  scripts: {
    dev: 'next dev',
    build: 'next build',
    start: 'next start',
    lint: 'next lint',
    typecheck: 'tsc --noEmit',
    format: 'prettier --write .',
    test: 'jest',
    'test:watch': 'jest --watch',
    'test:coverage': 'jest --coverage',
    analyze: 'wundr analyze',
    govern: 'wundr govern check',
    prepare: 'husky install',
    'db:generate': 'prisma generate',
    'db:push': 'prisma db push',
    'db:migrate': 'prisma migrate dev',
  },

  files: [
    {
      path: 'app/layout.tsx',
      content: `import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/providers'
import { Toaster } from '@/components/ui/toaster'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: '{{projectName}}',
  description: '{{description}}',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  )
}`,
      template: true,
    },
    {
      path: 'app/page.tsx',
      content: `import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Welcome to {{projectName}}</CardTitle>
          <CardDescription>
            A wundr-compliant Next.js application with best practices built-in
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            This project includes:
          </p>
          <ul className="list-disc list-inside space-y-2 text-sm">
            <li>Next.js 15 with App Router</li>
            <li>TypeScript with strict mode</li>
            <li>Tailwind CSS + shadcn/ui components</li>
            <li>React Query for data fetching</li>
            <li>Zustand for state management</li>
            <li>React Hook Form + Zod for forms</li>
            <li>Prisma for database</li>
            <li>Testing with Jest</li>
            <li>ESLint + Prettier configured</li>
            <li>Wundr governance integration</li>
          </ul>
          <div className="flex gap-4">
            <Button>Get Started</Button>
            <Button variant="outline">Documentation</Button>
          </div>
        </CardContent>
      </Card>
    </main>
  )
}`,
      template: true,
    },
    {
      path: 'app/globals.css',
      content: `@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    --primary: 222.2 47.4% 11.2%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 222.2 84% 4.9%;
    --radius: 0.5rem;
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;
    --popover: 222.2 84% 4.9%;
    --popover-foreground: 210 40% 98%;
    --primary: 210 40% 98%;
    --primary-foreground: 222.2 47.4% 11.2%;
    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 212.7 26.8% 83.9%;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}`,
    },
    {
      path: 'components/providers.tsx',
      content: `'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { ThemeProvider } from 'next-themes'
import { useState } from 'react'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            refetchOnWindowFocus: false,
          },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        {children}
      </ThemeProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}`,
    },
    {
      path: 'components/ui/button.tsx',
      content: `import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }`,
    },
    {
      path: 'lib/utils.ts',
      content: `import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}`,
    },
    {
      path: 'tailwind.config.ts',
      content: `import type { Config } from "tailwindcss"

const config = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config

export default config`,
    },
    {
      path: 'next.config.mjs',
      content: `/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  experimental: {
    serverActions: true,
  },
}

export default nextConfig`,
    },
    {
      path: 'tsconfig.json',
      content: `{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}`,
    },
  ],

  postInstall: [
    'npx shadcn-ui@latest init -y',
    'npx shadcn-ui@latest add card toast',
    'npx prisma init',
    'npx husky install',
    'npx husky add .husky/pre-commit "npm run lint && npm run typecheck"',
    'npx husky add .husky/commit-msg "npx --no -- commitlint --edit $1"',
  ],
};
