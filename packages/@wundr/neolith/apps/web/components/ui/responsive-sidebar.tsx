'use client';

import { Menu, X, ChevronLeft, ChevronRight } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { useMediaQuery } from '@/hooks/use-media-query';
import { cn } from '@/lib/utils';

export interface ResponsiveSidebarProps {
  children: React.ReactNode;
  className?: string;
  /**
   * Sidebar header content (logo, title, etc.)
   */
  header?: React.ReactNode;
  /**
   * Sidebar footer content (user profile, settings, etc.)
   */
  footer?: React.ReactNode;
  /**
   * Title for mobile drawer
   */
  title?: string;
  /**
   * Description for mobile drawer
   */
  description?: string;
  /**
   * Whether sidebar is collapsible on tablet/desktop
   */
  collapsible?: boolean;
  /**
   * Default collapsed state for tablet/desktop
   */
  defaultCollapsed?: boolean;
  /**
   * Callback when collapsed state changes
   */
  onCollapsedChange?: (collapsed: boolean) => void;
}

/**
 * Responsive sidebar component that adapts to different screen sizes
 * - Full sidebar on desktop (lg+)
 * - Collapsible sidebar on tablet (md to lg)
 * - Drawer on mobile (below md)
 *
 * @example
 * <ResponsiveSidebar
 *   header={<Logo />}
 *   footer={<UserProfile />}
 *   collapsible
 * >
 *   <nav>
 *     <NavItem href="/dashboard">Dashboard</NavItem>
 *     <NavItem href="/settings">Settings</NavItem>
 *   </nav>
 * </ResponsiveSidebar>
 */
export function ResponsiveSidebar({
  children,
  className,
  header,
  footer,
  title = 'Menu',
  description,
  collapsible = true,
  defaultCollapsed = false,
  onCollapsedChange,
}: ResponsiveSidebarProps) {
  const [isCollapsed, setIsCollapsed] = React.useState(defaultCollapsed);
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const isMobile = useMediaQuery('(max-width: 767px)');
  const isTablet = useMediaQuery('(min-width: 768px) and (max-width: 1023px)');
  const isDesktop = useMediaQuery('(min-width: 1024px)');

  const handleCollapsedChange = React.useCallback(
    (collapsed: boolean) => {
      setIsCollapsed(collapsed);
      if (onCollapsedChange) {
        onCollapsedChange(collapsed);
      }
    },
    [onCollapsedChange],
  );

  // Mobile: Render drawer
  if (isMobile) {
    return (
      <>
        <Button
          variant='ghost'
          size='icon'
          className='fixed top-4 left-4 z-40 md:hidden'
          onClick={() => setMobileOpen(true)}
          aria-label='Open menu'
        >
          <Menu className='h-5 w-5' />
        </Button>

        <Drawer open={mobileOpen} onOpenChange={setMobileOpen}>
          <DrawerContent className='max-h-[85vh]'>
            <DrawerHeader className='text-left'>
              <div className='flex items-center justify-between'>
                <div>
                  <DrawerTitle>{title}</DrawerTitle>
                  {description && (
                    <DrawerDescription>{description}</DrawerDescription>
                  )}
                </div>
                <DrawerClose asChild>
                  <Button variant='ghost' size='icon'>
                    <X className='h-5 w-5' />
                    <span className='sr-only'>Close</span>
                  </Button>
                </DrawerClose>
              </div>
            </DrawerHeader>

            <div className='flex flex-col h-full overflow-hidden'>
              {header && <div className='px-4 py-2'>{header}</div>}

              <div className='flex-1 overflow-y-auto px-4'>{children}</div>

              {footer && (
                <div className='border-t border-border px-4 py-2 mt-auto'>
                  {footer}
                </div>
              )}
            </div>
          </DrawerContent>
        </Drawer>
      </>
    );
  }

  // Tablet/Desktop: Render collapsible sidebar
  const sidebarWidth = isCollapsed ? 'w-16' : 'w-64';
  const showCollapse = collapsible && (isTablet || isDesktop);

  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-30 flex flex-col border-r bg-background',
        'transition-all duration-300 ease-in-out',
        sidebarWidth,
        className,
      )}
    >
      {/* Collapse button */}
      {showCollapse && (
        <Button
          variant='ghost'
          size='icon'
          className='absolute -right-3 top-6 z-40 h-6 w-6 rounded-full border bg-background shadow-md'
          onClick={() => handleCollapsedChange(!isCollapsed)}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? (
            <ChevronRight className='h-4 w-4' />
          ) : (
            <ChevronLeft className='h-4 w-4' />
          )}
        </Button>
      )}

      {/* Header */}
      {header && (
        <div
          className={cn(
            'border-b p-4',
            isCollapsed && 'px-2 flex justify-center',
          )}
        >
          {header}
        </div>
      )}

      {/* Main content */}
      <div className={cn('flex-1 overflow-y-auto p-4', isCollapsed && 'px-2')}>
        {children}
      </div>

      {/* Footer */}
      {footer && (
        <div className={cn('border-t p-4 mt-auto', isCollapsed && 'px-2')}>
          {footer}
        </div>
      )}
    </aside>
  );
}

export interface ResponsiveSidebarTriggerProps {
  className?: string;
}

/**
 * Trigger button for mobile sidebar drawer
 * Only visible on mobile devices
 */
export function ResponsiveSidebarTrigger({
  className,
}: ResponsiveSidebarTriggerProps) {
  return (
    <Button
      variant='ghost'
      size='icon'
      className={cn('md:hidden', className)}
      aria-label='Open menu'
    >
      <Menu className='h-5 w-5' />
    </Button>
  );
}

export interface SidebarNavItemProps {
  href?: string;
  icon?: React.ReactNode;
  label: string;
  onClick?: () => void;
  isActive?: boolean;
  className?: string;
}

/**
 * Sidebar navigation item with support for collapsed state
 */
export function SidebarNavItem({
  href,
  icon,
  label,
  onClick,
  isActive,
  className,
}: SidebarNavItemProps) {
  // Note: In a full implementation, this would use a context from ResponsiveSidebar
  // to detect the collapsed state. For now, items will always show labels.
  const isCollapsed = false;

  const content = (
    <>
      {icon && (
        <span className='flex h-5 w-5 items-center justify-center shrink-0'>
          {icon}
        </span>
      )}
      <span className={cn('truncate', isCollapsed && 'hidden')}>{label}</span>
    </>
  );

  const baseClasses = cn(
    'flex items-center gap-3 rounded-lg px-3 py-2',
    'text-sm font-medium transition-colors',
    'hover:bg-accent hover:text-accent-foreground',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
    isActive && 'bg-accent text-accent-foreground',
    isCollapsed && 'justify-center px-2',
    className,
  );

  if (href) {
    return (
      <a href={href} onClick={onClick} className={baseClasses}>
        {content}
      </a>
    );
  }

  return (
    <button onClick={onClick} className={cn(baseClasses, 'w-full')}>
      {content}
    </button>
  );
}

export interface SidebarSectionProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * Sidebar section with optional title
 */
export function SidebarSection({
  title,
  children,
  className,
}: SidebarSectionProps) {
  return (
    <div className={cn('space-y-1', className)}>
      {title && (
        <h3 className='mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground'>
          {title}
        </h3>
      )}
      {children}
    </div>
  );
}
