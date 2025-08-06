import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { BookOpen, FileCode, GitBranch, Lightbulb } from 'lucide-react';
import Link from 'next/link';

const docSections = [
  {
    title: 'Getting Started',
    description: 'Learn how to set up and use the monorepo refactoring toolkit',
    icon: BookOpen,
    href: '/dashboard/docs/getting-started',
  },
  {
    title: 'Templates',
    description: 'Explore service templates and consolidation batch examples',
    icon: FileCode,
    href: '/dashboard/docs/templates',
  },
  {
    title: 'Golden Patterns',
    description: 'Best practices and recommended patterns for refactoring',
    icon: Lightbulb,
    href: '/dashboard/docs/patterns',
  },
  {
    title: 'API Reference',
    description: 'Detailed API documentation for the analysis tools',
    icon: GitBranch,
    href: '/dashboard/docs/api',
  },
];

export default function DocsPage() {
  return (
    <div className='flex flex-1 flex-col gap-4 p-4'>
      <div>
        <h1 className='text-3xl font-bold'>Documentation</h1>
        <p className='text-muted-foreground mt-2'>
          Everything you need to know about Wundr - Intelligent Monorepo
          Analysis by Lumic.ai
        </p>
      </div>

      <div className='grid gap-4 md:grid-cols-2'>
        {docSections.map(section => {
          const Icon = section.icon;
          return (
            <Link key={section.href} href={section.href}>
              <Card className='h-full transition-colors hover:bg-muted/50'>
                <CardHeader>
                  <div className='flex items-center gap-2'>
                    <Icon className='h-6 w-6 text-primary' />
                    <CardTitle>{section.title}</CardTitle>
                  </div>
                  <CardDescription>{section.description}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          );
        })}
      </div>

      <Card className='mt-4'>
        <CardHeader>
          <CardTitle>Quick Links</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className='space-y-2'>
            <li>
              <Link href='/dashboard' className='text-primary hover:underline'>
                → View Analysis Dashboard
              </Link>
            </li>
            <li>
              <Link
                href='/dashboard/analysis/duplicates'
                className='text-primary hover:underline'
              >
                → Check for Duplicate Code
              </Link>
            </li>
            <li>
              <Link
                href='/dashboard/recommendations'
                className='text-primary hover:underline'
              >
                → See Refactoring Recommendations
              </Link>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
