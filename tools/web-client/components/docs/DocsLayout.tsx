'use client';

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { 
  BookOpen, 
  FileCode, 
  Lightbulb, 
  GitBranch, 
  Search, 
  ChevronLeft, 
  ChevronRight,
  Menu,
  X,
  Home
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface DocPage {
  title: string;
  slug: string;
  path: string;
  category: string;
  description?: string;
  tags?: string[];
  order?: number;
}

interface DocsLayoutProps {
  children: React.ReactNode;
  currentPage?: DocPage;
  allPages?: DocPage[];
}

const defaultPages: DocPage[] = [
  {
    title: 'Getting Started',
    slug: 'getting-started',
    path: '/dashboard/docs/getting-started',
    category: 'guides',
    description: 'Quick setup and first steps',
    tags: ['setup', 'guide'],
    order: 1
  },
  {
    title: 'Templates',
    slug: 'templates',
    path: '/dashboard/docs/templates',
    category: 'resources',
    description: 'Available templates and examples',
    tags: ['templates', 'examples'],
    order: 2
  },
  {
    title: 'Golden Patterns',
    slug: 'patterns',
    path: '/dashboard/docs/patterns',
    category: 'standards',
    description: 'Best practices and recommended patterns',
    tags: ['patterns', 'standards'],
    order: 3
  },
  {
    title: 'API Reference',
    slug: 'api',
    path: '/dashboard/docs/api',
    category: 'reference',
    description: 'Complete API documentation',
    tags: ['api', 'reference'],
    order: 4
  }
];

export function DocsLayout({ children, currentPage, allPages = defaultPages }: DocsLayoutProps) {
  const pathname = usePathname();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [filteredPages, setFilteredPages] = useState(allPages);

  // Filter pages based on search
  useEffect(() => {
    if (!searchQuery) {
      setFilteredPages(allPages);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = allPages.filter(page => 
      page.title.toLowerCase().includes(query) ||
      page.description?.toLowerCase().includes(query) ||
      page.tags?.some(tag => tag.toLowerCase().includes(query))
    );
    setFilteredPages(filtered);
  }, [searchQuery, allPages]);

  // Group pages by category
  const pagesByCategory = filteredPages.reduce((acc, page) => {
    if (!acc[page.category]) {
      acc[page.category] = [];
    }
    acc[page.category].push(page);
    return acc;
  }, {} as Record<string, DocPage[]>);

  // Sort pages within categories
  Object.keys(pagesByCategory).forEach(category => {
    pagesByCategory[category].sort((a, b) => (a.order || 999) - (b.order || 999));
  });

  // Find current page index for navigation
  const currentIndex = allPages.findIndex(page => page.path === pathname);
  const previousPage = currentIndex > 0 ? allPages[currentIndex - 1] : null;
  const nextPage = currentIndex < allPages.length - 1 ? allPages[currentIndex + 1] : null;

  // Generate breadcrumb items
  const generateBreadcrumbs = () => {
    const segments = pathname.split('/').filter(Boolean);
    const breadcrumbs = [
      { label: 'Dashboard', href: '/dashboard', icon: Home }
    ];

    if (segments.includes('docs')) {
      breadcrumbs.push({ label: 'Documentation', href: '/dashboard/docs', icon: BookOpen });
      
      if (currentPage) {
        breadcrumbs.push({ label: currentPage.title, href: currentPage.path, icon: FileCode });
      }
    }

    return breadcrumbs;
  };

  const breadcrumbs = generateBreadcrumbs();

  const categoryIcons = {
    guides: BookOpen,
    resources: FileCode,
    standards: Lightbulb,
    reference: GitBranch
  };


  return (
    <div className="flex flex-1 h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className={cn(
        "w-80 bg-muted/30 border-r border-border transition-transform duration-200 ease-in-out",
        "lg:translate-x-0 lg:static lg:inset-0",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full",
        "fixed inset-y-0 left-0 z-50 lg:z-auto"
      )}>
        <div className="flex flex-col h-full">
          {/* Sidebar Header */}
          <div className="p-4 border-b border-border">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Documentation</h2>
              <Button
                variant="ghost"
                size="sm"
                className="lg:hidden"
                onClick={() => setIsSidebarOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            {/* Search */}
            <div className="relative mt-3">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search docs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-4">
            <div className="space-y-6">
              {Object.entries(pagesByCategory).map(([category, pages]) => {
                const Icon = categoryIcons[category as keyof typeof categoryIcons] || BookOpen;
                
                return (
                  <div key={category}>
                    <div className="flex items-center gap-2 mb-3">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <h3 className="font-medium text-sm uppercase tracking-wide text-muted-foreground">
                        {category}
                      </h3>
                    </div>
                    
                    <div className="space-y-1 ml-6">
                      {pages.map((page) => (
                        <Link
                          key={page.slug}
                          href={page.path}
                          className={cn(
                            "block px-3 py-2 text-sm rounded-lg transition-colors",
                            "hover:bg-accent hover:text-accent-foreground",
                            pathname === page.path 
                              ? "bg-primary text-primary-foreground font-medium" 
                              : "text-muted-foreground"
                          )}
                          onClick={() => setIsSidebarOpen(false)}
                        >
                          <div className="flex items-center justify-between">
                            <span>{page.title}</span>
                            {page.tags && (
                              <Badge variant="secondary" className="ml-2 text-xs">
                                {page.tags[0]}
                              </Badge>
                            )}
                          </div>
                          {page.description && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {page.description}
                            </p>
                          )}
                        </Link>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </nav>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-hidden">
        <div className="h-full overflow-y-auto">
          {/* Header */}
          <header className="sticky top-0 z-30 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
            <div className="flex items-center gap-4 p-4">
              <Button
                variant="ghost"
                size="sm"
                className="lg:hidden"
                onClick={() => setIsSidebarOpen(true)}
              >
                <Menu className="h-4 w-4" />
              </Button>

              {/* Breadcrumbs */}
              <Breadcrumb className="flex-1">
                <BreadcrumbList>
                  {breadcrumbs.map((crumb, index) => (
                    <React.Fragment key={crumb.href}>
                      <BreadcrumbItem>
                        {index === breadcrumbs.length - 1 ? (
                          <BreadcrumbPage className="flex items-center gap-1">
                            {crumb.icon && <crumb.icon className="h-4 w-4" />}
                            {crumb.label}
                          </BreadcrumbPage>
                        ) : (
                          <BreadcrumbLink href={crumb.href} className="flex items-center gap-1">
                            {crumb.icon && <crumb.icon className="h-4 w-4" />}
                            {crumb.label}
                          </BreadcrumbLink>
                        )}
                      </BreadcrumbItem>
                      {index < breadcrumbs.length - 1 && <BreadcrumbSeparator />}
                    </React.Fragment>
                  ))}
                </BreadcrumbList>
              </Breadcrumb>
            </div>
          </header>

          {/* Content */}
          <div className="p-6">
            {children}

            {/* Navigation Footer */}
            {(previousPage || nextPage) && (
              <Card className="mt-12 p-6">
                <div className="flex justify-between items-center">
                  <div className="flex-1">
                    {previousPage && (
                      <Link href={previousPage.path}>
                        <Button variant="ghost" className="h-auto p-4 justify-start">
                          <div className="flex items-center gap-3">
                            <ChevronLeft className="h-4 w-4" />
                            <div className="text-left">
                              <div className="text-sm text-muted-foreground">Previous</div>
                              <div className="font-medium">{previousPage.title}</div>
                            </div>
                          </div>
                        </Button>
                      </Link>
                    )}
                  </div>
                  
                  <div className="flex-1 text-right">
                    {nextPage && (
                      <Link href={nextPage.path}>
                        <Button variant="ghost" className="h-auto p-4 justify-end">
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <div className="text-sm text-muted-foreground">Next</div>
                              <div className="font-medium">{nextPage.title}</div>
                            </div>
                            <ChevronRight className="h-4 w-4" />
                          </div>
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default DocsLayout;