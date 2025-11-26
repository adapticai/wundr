/**
 * Examples and usage documentation for responsive components
 *
 * This file demonstrates how to use the three main responsive components:
 * 1. ResponsiveModal - Switches between Dialog (desktop) and Drawer (mobile)
 * 2. MobileNavDrawer - Hamburger menu with navigation drawer
 * 3. ResponsiveSidebar - Adaptive sidebar for different screen sizes
 */

'use client';

import { Settings, Home, User, Mail, Bell } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { MobileNavDrawer } from '@/components/ui/mobile-nav-drawer';
import {
  ResponsiveModal,
  ResponsiveModalTrigger,
  ResponsiveModalContent,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
  ResponsiveModalDescription,
  ResponsiveModalFooter,
} from '@/components/ui/responsive-modal';
import {
  ResponsiveSidebar,
  SidebarNavItem,
  SidebarSection,
} from '@/components/ui/responsive-sidebar';

/**
 * Example 1: Basic ResponsiveModal usage
 * - Dialog on desktop (md+)
 * - Drawer on mobile
 */
export function ResponsiveModalExample() {
  const [open, setOpen] = React.useState(false);

  return (
    <ResponsiveModal open={open} onOpenChange={setOpen}>
      <ResponsiveModalTrigger>
        <Button>Open Modal</Button>
      </ResponsiveModalTrigger>
      <ResponsiveModalContent>
        <ResponsiveModalHeader>
          <ResponsiveModalTitle>Responsive Modal</ResponsiveModalTitle>
          <ResponsiveModalDescription>
            This is a dialog on desktop and a drawer on mobile
          </ResponsiveModalDescription>
        </ResponsiveModalHeader>
        <div className="p-4">
          <p className="text-sm text-muted-foreground">
            Modal content goes here. This component automatically adapts to the
            viewport size, showing a centered dialog on desktop and a bottom drawer
            on mobile.
          </p>
        </div>
        <ResponsiveModalFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={() => setOpen(false)}>Confirm</Button>
        </ResponsiveModalFooter>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}

/**
 * Example 2: Form in ResponsiveModal
 */
export function ResponsiveFormModalExample() {
  const [open, setOpen] = React.useState(false);
  const [formData, setFormData] = React.useState({ name: '', email: '' });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Form submitted:', formData);
    setOpen(false);
  };

  return (
    <ResponsiveModal open={open} onOpenChange={setOpen}>
      <ResponsiveModalTrigger>
        <Button>Edit Profile</Button>
      </ResponsiveModalTrigger>
      <ResponsiveModalContent>
        <ResponsiveModalHeader>
          <ResponsiveModalTitle>Edit Profile</ResponsiveModalTitle>
          <ResponsiveModalDescription>
            Update your profile information
          </ResponsiveModalDescription>
        </ResponsiveModalHeader>
        <form onSubmit={handleSubmit} className="space-y-4 p-4">
          <div>
            <label htmlFor="name" className="text-sm font-medium">
              Name
            </label>
            <input
              id="name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full mt-1 px-3 py-2 border rounded-md"
            />
          </div>
          <div>
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full mt-1 px-3 py-2 border rounded-md"
            />
          </div>
          <ResponsiveModalFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Save Changes</Button>
          </ResponsiveModalFooter>
        </form>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}

/**
 * Example 3: MobileNavDrawer with navigation items
 */
export function MobileNavDrawerExample() {
  const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: <Home className="h-5 w-5" /> },
    { href: '/profile', label: 'Profile', icon: <User className="h-5 w-5" /> },
    { href: '/messages', label: 'Messages', icon: <Mail className="h-5 w-5" /> },
    { href: '/notifications', label: 'Notifications', icon: <Bell className="h-5 w-5" /> },
    { href: '/settings', label: 'Settings', icon: <Settings className="h-5 w-5" /> },
  ];

  return (
    <MobileNavDrawer
      title="Navigation"
      description="Select a page to navigate"
      items={navItems}
    />
  );
}

/**
 * Example 4: MobileNavDrawer with custom footer
 */
export function MobileNavDrawerWithFooterExample() {
  const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: <Home className="h-5 w-5" /> },
    { href: '/settings', label: 'Settings', icon: <Settings className="h-5 w-5" /> },
  ];

  return (
    <MobileNavDrawer
      title="Menu"
      items={navItems}
      footer={
        <div className="flex flex-col gap-2">
          <Button variant="outline" className="w-full">
            Help & Support
          </Button>
          <Button variant="ghost" className="w-full">
            Sign Out
          </Button>
        </div>
      }
    />
  );
}

/**
 * Example 5: ResponsiveSidebar basic usage
 * - Full sidebar on desktop
 * - Collapsible on tablet
 * - Drawer on mobile
 */
export function ResponsiveSidebarExample() {
  return (
    <ResponsiveSidebar
      title="Main Menu"
      description="Navigate your workspace"
      collapsible
      defaultCollapsed={false}
      header={
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded bg-primary" />
          <span className="font-bold">My App</span>
        </div>
      }
      footer={
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-accent" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">John Doe</p>
            <p className="text-xs text-muted-foreground truncate">john@example.com</p>
          </div>
        </div>
      }
    >
      <SidebarSection title="Main">
        <SidebarNavItem
          href="/dashboard"
          icon={<Home className="h-5 w-5" />}
          label="Dashboard"
          isActive
        />
        <SidebarNavItem
          href="/profile"
          icon={<User className="h-5 w-5" />}
          label="Profile"
        />
      </SidebarSection>

      <SidebarSection title="Settings">
        <SidebarNavItem
          href="/settings"
          icon={<Settings className="h-5 w-5" />}
          label="Settings"
        />
      </SidebarSection>
    </ResponsiveSidebar>
  );
}

/**
 * Example 6: Complete layout with ResponsiveSidebar
 */
export function ResponsiveLayoutExample() {
  return (
    <div className="flex min-h-screen">
      <ResponsiveSidebar
        title="App Menu"
        collapsible
        header={
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded bg-primary flex items-center justify-center text-primary-foreground font-bold">
              A
            </div>
            <span className="font-bold">App Name</span>
          </div>
        }
      >
        <nav className="space-y-1">
          <SidebarNavItem
            href="/dashboard"
            icon={<Home className="h-5 w-5" />}
            label="Dashboard"
            isActive
          />
          <SidebarNavItem
            href="/messages"
            icon={<Mail className="h-5 w-5" />}
            label="Messages"
          />
          <SidebarNavItem
            href="/notifications"
            icon={<Bell className="h-5 w-5" />}
            label="Notifications"
          />
          <SidebarNavItem
            href="/settings"
            icon={<Settings className="h-5 w-5" />}
            label="Settings"
          />
        </nav>
      </ResponsiveSidebar>

      {/* Main content area - adjust margin based on sidebar presence */}
      <main className="flex-1 md:ml-16 lg:ml-64 transition-all duration-300">
        <div className="p-6">
          <h1 className="text-2xl font-bold mb-4">Dashboard</h1>
          <p className="text-muted-foreground">
            Main content area. The sidebar automatically adapts to screen size.
          </p>
        </div>
      </main>
    </div>
  );
}

/**
 * Example 7: Controlled ResponsiveModal
 */
export function ControlledResponsiveModalExample() {
  const [isOpen, setIsOpen] = React.useState(false);
  const [confirmAction, setConfirmAction] = React.useState<'delete' | 'archive' | null>(null);

  const handleAction = () => {
    console.log('Action confirmed:', confirmAction);
    setIsOpen(false);
    setConfirmAction(null);
  };

  return (
    <div className="space-x-2">
      <Button
        variant="destructive"
        onClick={() => {
          setConfirmAction('delete');
          setIsOpen(true);
        }}
      >
        Delete Item
      </Button>
      <Button
        variant="secondary"
        onClick={() => {
          setConfirmAction('archive');
          setIsOpen(true);
        }}
      >
        Archive Item
      </Button>

      <ResponsiveModal open={isOpen} onOpenChange={setIsOpen}>
        <ResponsiveModalContent>
          <ResponsiveModalHeader>
            <ResponsiveModalTitle>
              {confirmAction === 'delete' ? 'Delete Item' : 'Archive Item'}
            </ResponsiveModalTitle>
            <ResponsiveModalDescription>
              {confirmAction === 'delete'
                ? 'This action cannot be undone. The item will be permanently deleted.'
                : 'The item will be moved to your archive.'}
            </ResponsiveModalDescription>
          </ResponsiveModalHeader>
          <ResponsiveModalFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button
              variant={confirmAction === 'delete' ? 'destructive' : 'default'}
              onClick={handleAction}
            >
              {confirmAction === 'delete' ? 'Delete' : 'Archive'}
            </Button>
          </ResponsiveModalFooter>
        </ResponsiveModalContent>
      </ResponsiveModal>
    </div>
  );
}

/**
 * Usage Tips:
 *
 * 1. ResponsiveModal:
 *    - Use for confirmation dialogs, forms, and detail views
 *    - Automatically switches between Dialog and Drawer at md breakpoint (768px)
 *    - Supports all standard Dialog/Drawer props
 *
 * 2. MobileNavDrawer:
 *    - Only visible on mobile devices (use md:hidden on trigger)
 *    - Swipe gesture support via vaul
 *    - Auto-closes on navigation
 *
 * 3. ResponsiveSidebar:
 *    - Full sidebar on desktop (lg+)
 *    - Collapsible on tablet (md to lg)
 *    - Drawer on mobile
 *    - Use with layout components for best results
 *
 * Breakpoints (Tailwind defaults):
 * - sm: 640px (mobile)
 * - md: 768px (tablet)
 * - lg: 1024px (desktop)
 * - xl: 1280px (large desktop)
 */
