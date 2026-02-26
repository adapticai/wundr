'use client';

import {
  Activity,
  BarChart3,
  Bell,
  Bot,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Database,
  FileText,
  GitBranch,
  Home,
  Key,
  LayoutDashboard,
  Lock,
  Mail,
  Menu,
  MessageSquare,
  MoreVertical,
  Package,
  Route,
  ScrollText,
  Search,
  Settings,
  Shield,
  Sparkles,
  Users,
  Webhook,
  Workflow,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useSidebar } from '@/components/ui/sidebar';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface AdminLayoutClientProps {
  children: React.ReactNode;
  workspaceSlug: string;
  workspaceName: string;
  userRole: string;
  userName: string;
}

interface NavItem {
  title: string;
  href: string;
  icon: React.ReactNode;
  description?: string;
  badge?: string;
  section: 'overview' | 'management' | 'ai-organization' | 'settings' | 'security';
}

/**
 * Comprehensive Admin Layout Client with:
 * - Collapsible sidebar navigation
 * - Breadcrumb navigation
 * - Quick search command palette
 * - Mobile-responsive drawer
 * - Admin header with quick actions
 */
export function AdminLayoutClient({
  children,
  workspaceSlug,
  workspaceName,
  userRole,
  userName,
}: AdminLayoutClientProps) {
  const { setOpen, open } = useSidebar();
  const previousOpenState = useRef<boolean | null>(null);
  const pathname = usePathname();

  // State management
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);

  // Navigation items
  const navItems: NavItem[] = [
    {
      title: 'Dashboard',
      href: `/${workspaceSlug}/admin`,
      icon: <LayoutDashboard className='h-4 w-4' />,
      description: 'Overview and metrics',
      section: 'overview',
    },
    {
      title: 'Activity',
      href: `/${workspaceSlug}/admin/activity`,
      icon: <Activity className='h-4 w-4' />,
      description: 'Admin action logs',
      section: 'overview',
    },
    {
      title: 'Members',
      href: `/${workspaceSlug}/admin/members`,
      icon: <Users className='h-4 w-4' />,
      description: 'Manage workspace members',
      section: 'management',
    },
    {
      title: 'Roles',
      href: `/${workspaceSlug}/admin/roles`,
      icon: <Shield className='h-4 w-4' />,
      description: 'Configure roles and permissions',
      section: 'management',
    },
    {
      title: 'Invitations',
      href: `/${workspaceSlug}/admin/invitations`,
      icon: <Mail className='h-4 w-4' />,
      description: 'Manage pending invites',
      section: 'management',
    },
    {
      title: 'Channels',
      href: `/${workspaceSlug}/admin/channels`,
      icon: <Package className='h-4 w-4' />,
      description: 'Manage communication channels',
      section: 'management',
    },
    {
      title: 'Workflows',
      href: `/${workspaceSlug}/admin/workflows`,
      icon: <FileText className='h-4 w-4' />,
      description: 'Configure automated workflows',
      section: 'management',
    },
    {
      title: 'Orchestrators',
      href: `/${workspaceSlug}/admin/orchestrators`,
      icon: <Bot className='h-4 w-4' />,
      description: 'Manage orchestrator services',
      section: 'ai-organization',
    },
    {
      title: 'Org Chart',
      href: `/${workspaceSlug}/admin/org-chart`,
      icon: <GitBranch className='h-4 w-4' />,
      description: 'View AI organisation hierarchy',
      section: 'ai-organization',
    },
    {
      title: 'Traffic Manager',
      href: `/${workspaceSlug}/admin/traffic-manager`,
      icon: <Route className='h-4 w-4' />,
      description: 'Route and balance agent traffic',
      section: 'ai-organization',
    },
    {
      title: 'Charter',
      href: `/${workspaceSlug}/admin/charter`,
      icon: <ScrollText className='h-4 w-4' />,
      description: 'View and edit organisation charter',
      section: 'ai-organization',
    },
    {
      title: 'Communications',
      href: `/${workspaceSlug}/admin/communications`,
      icon: <MessageSquare className='h-4 w-4' />,
      description: 'Monitor agent communications',
      section: 'ai-organization',
    },
    {
      title: 'AI Settings',
      href: `/${workspaceSlug}/admin/ai`,
      icon: <Sparkles className='h-4 w-4' />,
      description: 'Configure AI behaviour and models',
      section: 'ai-organization',
    },
    {
      title: 'Performance',
      href: `/${workspaceSlug}/admin/performance`,
      icon: <BarChart3 className='h-4 w-4' />,
      description: 'Monitor system performance metrics',
      section: 'ai-organization',
    },
    {
      title: 'Settings',
      href: `/${workspaceSlug}/admin/settings`,
      icon: <Settings className='h-4 w-4' />,
      description: 'General workspace settings',
      section: 'settings',
    },
    {
      title: 'Billing',
      href: `/${workspaceSlug}/admin/billing`,
      icon: <CreditCard className='h-4 w-4' />,
      description: 'Manage billing and plans',
      section: 'settings',
    },
    {
      title: 'Storage',
      href: `/${workspaceSlug}/admin/storage`,
      icon: <Database className='h-4 w-4' />,
      description: 'Manage storage and files',
      section: 'settings',
    },
    {
      title: 'Integrations',
      href: `/${workspaceSlug}/admin/integrations`,
      icon: <Package className='h-4 w-4' />,
      description: 'Third-party integrations',
      section: 'settings',
    },
    {
      title: 'API Keys',
      href: `/${workspaceSlug}/admin/api-keys`,
      icon: <Key className='h-4 w-4' />,
      description: 'Manage API access',
      section: 'security',
    },
    {
      title: 'Security',
      href: `/${workspaceSlug}/admin/security`,
      icon: <Lock className='h-4 w-4' />,
      description: 'Security settings',
      section: 'security',
    },
    {
      title: 'Webhooks',
      href: `/${workspaceSlug}/admin/webhooks`,
      icon: <Webhook className='h-4 w-4' />,
      description: 'Configure webhooks',
      section: 'security',
    },
    {
      title: 'Audit Log',
      href: `/${workspaceSlug}/admin/audit-log`,
      icon: <FileText className='h-4 w-4' />,
      description: 'View audit logs',
      section: 'security',
    },
  ];

  // Group navigation items by section
  const groupedNav = {
    overview: navItems.filter(item => item.section === 'overview'),
    management: navItems.filter(item => item.section === 'management'),
    aiOrganization: navItems.filter(item => item.section === 'ai-organization'),
    settings: navItems.filter(item => item.section === 'settings'),
    security: navItems.filter(item => item.section === 'security'),
  };

  // Generate breadcrumbs
  const generateBreadcrumbs = () => {
    const segments = pathname.split('/').filter(Boolean);
    const breadcrumbs: Array<{ label: string; href: string }> = [];

    segments.forEach((segment, index) => {
      if (segment === workspaceSlug) {
        breadcrumbs.push({
          label: workspaceName,
          href: `/${workspaceSlug}/dashboard`,
        });
      } else if (segment === 'admin') {
        breadcrumbs.push({
          label: 'Admin',
          href: `/${workspaceSlug}/admin`,
        });
      } else {
        const navItem = navItems.find(item =>
          item.href.endsWith(`/${segment}`)
        );
        if (navItem) {
          breadcrumbs.push({
            label: navItem.title,
            href: navItem.href,
          });
        } else {
          breadcrumbs.push({
            label: segment
              .split('-')
              .map(s => s.charAt(0).toUpperCase() + s.slice(1))
              .join(' '),
            href: `/${segments.slice(0, index + 1).join('/')}`,
          });
        }
      }
    });

    return breadcrumbs;
  };

  const breadcrumbs = generateBreadcrumbs();

  // Auto-collapse main workspace sidebar on mount, restore on unmount
  useEffect(() => {
    previousOpenState.current = open;
    setOpen(false);
    return () => {
      if (previousOpenState.current !== null) {
        setOpen(previousOpenState.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCommandOpen(open => !open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const NavLink = ({ item }: { item: NavItem }) => {
    const isActive = pathname === item.href;

    return (
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                !sidebarOpen && 'justify-center'
              )}
            >
              <span className='flex-shrink-0'>{item.icon}</span>
              {sidebarOpen && (
                <>
                  <span className='flex-1'>{item.title}</span>
                  {item.badge && (
                    <Badge variant='secondary' className='ml-auto'>
                      {item.badge}
                    </Badge>
                  )}
                </>
              )}
            </Link>
          </TooltipTrigger>
          {!sidebarOpen && (
            <TooltipContent side='right'>
              <p>{item.title}</p>
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>
    );
  };

  const SidebarContent = () => (
    <div className='flex h-full flex-col'>
      {/* Sidebar Header */}
      <div className='flex h-14 items-center justify-between border-b px-4'>
        {sidebarOpen && (
          <div className='flex items-center gap-2'>
            <Shield className='h-5 w-5 text-primary' />
            <span className='font-semibold'>Admin Console</span>
          </div>
        )}
        <Button
          variant='ghost'
          size='icon'
          className={cn('h-8 w-8', !sidebarOpen && 'mx-auto')}
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          {sidebarOpen ? (
            <ChevronLeft className='h-4 w-4' />
          ) : (
            <ChevronRight className='h-4 w-4' />
          )}
        </Button>
      </div>

      {/* Navigation */}
      <ScrollArea className='flex-1 px-3 py-4'>
        <nav className='space-y-6'>
          {/* Overview Section */}
          <div>
            {sidebarOpen && (
              <h4 className='mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground'>
                Overview
              </h4>
            )}
            <div className='space-y-1'>
              {groupedNav.overview.map(item => (
                <NavLink key={item.href} item={item} />
              ))}
            </div>
          </div>

          <Separator />

          {/* Management Section */}
          <div>
            {sidebarOpen && (
              <h4 className='mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground'>
                Management
              </h4>
            )}
            <div className='space-y-1'>
              {groupedNav.management.map(item => (
                <NavLink key={item.href} item={item} />
              ))}
            </div>
          </div>

          <Separator />

          {/* AI Organization Section */}
          <div>
            {sidebarOpen && (
              <h4 className='mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground'>
                AI Organization
              </h4>
            )}
            <div className='space-y-1'>
              {groupedNav.aiOrganization.map(item => (
                <NavLink key={item.href} item={item} />
              ))}
            </div>
          </div>

          <Separator />

          {/* Settings Section */}
          <div>
            {sidebarOpen && (
              <h4 className='mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground'>
                Settings
              </h4>
            )}
            <div className='space-y-1'>
              {groupedNav.settings.map(item => (
                <NavLink key={item.href} item={item} />
              ))}
            </div>
          </div>

          <Separator />

          {/* Security Section */}
          <div>
            {sidebarOpen && (
              <h4 className='mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground'>
                Security
              </h4>
            )}
            <div className='space-y-1'>
              {groupedNav.security.map(item => (
                <NavLink key={item.href} item={item} />
              ))}
            </div>
          </div>
        </nav>
      </ScrollArea>

      {/* Sidebar Footer */}
      {sidebarOpen && (
        <div className='border-t p-4'>
          <div className='rounded-lg bg-muted/50 p-3'>
            <p className='text-xs font-medium'>{userName}</p>
            <p className='text-xs text-muted-foreground'>{userRole} Access</p>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className='flex h-screen overflow-hidden'>
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          'hidden border-r bg-background transition-all duration-300 lg:block',
          sidebarOpen ? 'w-64' : 'w-16'
        )}
      >
        <SidebarContent />
      </aside>

      {/* Mobile Drawer */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side='left' className='w-64 p-0'>
          <SheetHeader className='border-b p-4'>
            <SheetTitle className='flex items-center gap-2'>
              <Shield className='h-5 w-5 text-primary' />
              Admin Console
            </SheetTitle>
          </SheetHeader>
          <SidebarContent />
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <div className='flex flex-1 flex-col overflow-hidden'>
        {/* Header */}
        <header className='flex h-14 items-center justify-between border-b bg-background px-4 lg:px-6'>
          {/* Left Section */}
          <div className='flex items-center gap-4'>
            {/* Mobile Menu Button */}
            <Button
              variant='ghost'
              size='icon'
              className='lg:hidden'
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu className='h-5 w-5' />
            </Button>

            {/* Breadcrumbs */}
            <Breadcrumb className='hidden md:flex'>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link href={`/${workspaceSlug}/dashboard`}>
                      <Home className='h-3.5 w-3.5' />
                    </Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                {breadcrumbs.map((crumb, index) => (
                  <div key={crumb.href} className='flex items-center'>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      {index === breadcrumbs.length - 1 ? (
                        <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                      ) : (
                        <BreadcrumbLink asChild>
                          <Link href={crumb.href}>{crumb.label}</Link>
                        </BreadcrumbLink>
                      )}
                    </BreadcrumbItem>
                  </div>
                ))}
              </BreadcrumbList>
            </Breadcrumb>
          </div>

          {/* Right Section - Quick Actions */}
          <div className='flex items-center gap-2'>
            {/* Search */}
            <Button
              variant='outline'
              className='gap-2'
              onClick={() => setCommandOpen(true)}
            >
              <Search className='h-4 w-4' />
              <span className='hidden sm:inline'>Search</span>
              <kbd className='pointer-events-none hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex'>
                <span className='text-xs'>⌘</span>K
              </kbd>
            </Button>

            {/* Quick Actions */}
            <Button variant='ghost' size='icon'>
              <Bell className='h-4 w-4' />
            </Button>

            <Button variant='ghost' size='icon'>
              <MoreVertical className='h-4 w-4' />
            </Button>
          </div>
        </header>

        {/* Page Content */}
        <main className='flex-1 overflow-y-auto bg-muted/10'>
          <div className='container mx-auto p-4 lg:p-6'>{children}</div>
        </main>
      </div>

      {/* Command Palette */}
      <CommandDialog open={commandOpen} onOpenChange={setCommandOpen}>
        <CommandInput placeholder='Search admin features...' />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>

          <CommandGroup heading='Overview'>
            {groupedNav.overview.map(item => (
              <CommandItem
                key={item.href}
                onSelect={() => {
                  setCommandOpen(false);
                  window.location.href = item.href;
                }}
              >
                {item.icon}
                <span>{item.title}</span>
                {item.description && (
                  <span className='ml-auto text-xs text-muted-foreground'>
                    {item.description}
                  </span>
                )}
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandGroup heading='Management'>
            {groupedNav.management.map(item => (
              <CommandItem
                key={item.href}
                onSelect={() => {
                  setCommandOpen(false);
                  window.location.href = item.href;
                }}
              >
                {item.icon}
                <span>{item.title}</span>
                {item.description && (
                  <span className='ml-auto text-xs text-muted-foreground'>
                    {item.description}
                  </span>
                )}
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandGroup heading='AI Organization'>
            {groupedNav.aiOrganization.map(item => (
              <CommandItem
                key={item.href}
                onSelect={() => {
                  setCommandOpen(false);
                  window.location.href = item.href;
                }}
              >
                {item.icon}
                <span>{item.title}</span>
                {item.description && (
                  <span className='ml-auto text-xs text-muted-foreground'>
                    {item.description}
                  </span>
                )}
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandGroup heading='Settings'>
            {groupedNav.settings.map(item => (
              <CommandItem
                key={item.href}
                onSelect={() => {
                  setCommandOpen(false);
                  window.location.href = item.href;
                }}
              >
                {item.icon}
                <span>{item.title}</span>
                {item.description && (
                  <span className='ml-auto text-xs text-muted-foreground'>
                    {item.description}
                  </span>
                )}
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandGroup heading='Security'>
            {groupedNav.security.map(item => (
              <CommandItem
                key={item.href}
                onSelect={() => {
                  setCommandOpen(false);
                  window.location.href = item.href;
                }}
              >
                {item.icon}
                <span>{item.title}</span>
                {item.description && (
                  <span className='ml-auto text-xs text-muted-foreground'>
                    {item.description}
                  </span>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </div>
  );
}
