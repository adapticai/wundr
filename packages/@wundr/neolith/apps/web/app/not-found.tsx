import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-secondary p-4">
      <div className="max-w-md w-full space-y-8 text-center">
        {/* 404 Illustration */}
        <div className="flex justify-center">
          <div className="relative">
            <div className="text-[120px] font-bold text-muted/20 leading-none select-none">
              404
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <svg
                className="w-16 h-16 text-muted-foreground/40"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
          </div>
        </div>

        {/* Message */}
        <div className="space-y-3">
          <h1 className="text-3xl font-bold text-foreground font-heading">
            Page not found
          </h1>
          <p className="text-muted-foreground">
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
          </p>
        </div>

        {/* Navigation Suggestions */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              asChild
              size="lg"
              className="w-full sm:w-auto"
            >
              <Link href="/">Go to home</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="w-full sm:w-auto"
            >
              <Link href="/dashboard">Go to dashboard</Link>
            </Button>
          </div>
        </div>

        {/* Quick Links */}
        <div className="pt-6 border-t border-border">
          <p className="text-sm text-muted-foreground mb-3">
            Popular pages:
          </p>
          <div className="flex flex-wrap gap-2 justify-center">
            <Button
              asChild
              variant="ghost"
              size="sm"
            >
              <Link href="/dashboard/workflows">Workflows</Link>
            </Button>
            <Button
              asChild
              variant="ghost"
              size="sm"
            >
              <Link href="/dashboard/agents">Agents</Link>
            </Button>
            <Button
              asChild
              variant="ghost"
              size="sm"
            >
              <Link href="/dashboard/org-chart">Organization</Link>
            </Button>
            <Button
              asChild
              variant="ghost"
              size="sm"
            >
              <Link href="/dashboard/settings">Settings</Link>
            </Button>
          </div>
        </div>

        {/* Neolith Branding */}
        <div className="pt-6">
          <p className="text-xs text-muted-foreground">
            <span className="font-heading font-semibold">Neolith</span>
            {' '}&mdash; AI-Powered Workspace
          </p>
        </div>
      </div>
    </div>
  );
}
