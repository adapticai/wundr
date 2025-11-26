'use client';

/**
 * Responsive Design Examples
 *
 * This file demonstrates how to use the responsive design utilities,
 * hooks, and components throughout your application.
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ResponsiveModal } from '@/components/ui/responsive-modal';
import { MobileNavDrawer, MobileNavToggle } from '@/components/ui/mobile-nav-drawer';
import {
  useIsMobile,
  useIsTablet,
  useIsDesktop,
  useBreakpoint,
  useTouchDevice,
} from '@/hooks/use-media-query';
import { Home, Settings, Bell, Mail } from 'lucide-react';

// Example 1: Basic Responsive Hooks
export function ResponsiveHooksExample() {
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();
  const isDesktop = useIsDesktop();
  const breakpoint = useBreakpoint();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Responsive Hooks Example</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-sm text-muted-foreground">Current viewport:</p>
          <p className="text-lg font-semibold">{breakpoint || 'unknown'}</p>
        </div>

        <div className="grid gap-2">
          <div className={`p-2 rounded ${isMobile ? 'bg-blue-100' : 'bg-gray-100'}`}>
            Mobile: {isMobile ? 'Yes' : 'No'}
          </div>
          <div className={`p-2 rounded ${isTablet ? 'bg-green-100' : 'bg-gray-100'}`}>
            Tablet: {isTablet ? 'Yes' : 'No'}
          </div>
          <div className={`p-2 rounded ${isDesktop ? 'bg-purple-100' : 'bg-gray-100'}`}>
            Desktop: {isDesktop ? 'Yes' : 'No'}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Example 2: Touch Device Detection
export function TouchDeviceExample() {
  const isTouch = useTouchDevice();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Touch Device Detection</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-4">
          This device {isTouch ? 'supports' : 'does not support'} touch input.
        </p>
        <Button className={isTouch ? 'h-11 w-11' : 'h-10 w-10'}>
          {isTouch ? 'Touch-sized' : 'Normal'}
        </Button>
      </CardContent>
    </Card>
  );
}

// Example 3: Responsive Modal
export function ResponsiveModalExample() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>Open Modal</Button>

      <ResponsiveModal
        open={open}
        onOpenChange={setOpen}
        title="Responsive Modal"
        description="This modal becomes a drawer on mobile and a dialog on desktop"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => setOpen(false)}>Confirm</Button>
          </>
        }
      >
        <div className="space-y-4">
          <p>
            This is a responsive modal that automatically switches between a drawer on
            mobile and a dialog on desktop.
          </p>
          <ul className="list-disc list-inside space-y-2 text-sm">
            <li>Swipe down to close on mobile</li>
            <li>Click outside to close on desktop</li>
            <li>Press ESC to close on both</li>
            <li>Touch-friendly sizing on mobile</li>
          </ul>
        </div>
      </ResponsiveModal>
    </>
  );
}

// Example 4: Mobile Navigation Drawer
export function MobileNavDrawerExample() {
  const [drawerOpen, setDrawerOpen] = useState(false);

  const navItems = [
    {
      label: 'Home',
      href: '/',
      icon: <Home className="h-5 w-5" />,
    },
    {
      label: 'Notifications',
      href: '/notifications',
      icon: <Bell className="h-5 w-5" />,
      badge: 5,
    },
    {
      label: 'Messages',
      href: '/messages',
      icon: <Mail className="h-5 w-5" />,
    },
    {
      label: 'Settings',
      href: '/settings',
      icon: <Settings className="h-5 w-5" />,
    },
  ];

  return (
    <div className="flex items-center gap-4">
      <MobileNavToggle onClick={() => setDrawerOpen(true)} />

      <MobileNavDrawer
        items={navItems}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        title="Navigation"
      />

      <div className="hidden md:block">
        <span className="text-sm text-muted-foreground">
          Navigation toggle visible only on mobile
        </span>
      </div>
    </div>
  );
}

// Example 5: Responsive Grid
export function ResponsiveGridExample() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Responsive Grid</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((item) => (
            <div key={item} className="p-4 bg-muted rounded-lg text-center">
              Item {item}
            </div>
          ))}
        </div>
        <p className="text-sm text-muted-foreground mt-4">
          1 column on mobile, 2 on tablet, 3 on desktop
        </p>
      </CardContent>
    </Card>
  );
}

// Example 6: Responsive Form
export function ResponsiveFormExample() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Responsive Form</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">First Name</label>
              <input
                type="text"
                className="w-full mt-1 px-3 py-2 border rounded-md"
                placeholder="John"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Last Name</label>
              <input
                type="text"
                className="w-full mt-1 px-3 py-2 border rounded-md"
                placeholder="Doe"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Email</label>
            <input
              type="email"
              className="w-full mt-1 px-3 py-2 border rounded-md"
              placeholder="john@example.com"
            />
          </div>

          <Button className="w-full md:w-auto">Submit</Button>
        </form>

        <p className="text-sm text-muted-foreground mt-4">
          Form fields stack on mobile, side-by-side on tablet+
        </p>
      </CardContent>
    </Card>
  );
}

// Example 7: Conditional Rendering
export function ConditionalRenderingExample() {
  const isDesktop = useIsDesktop();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Conditional Rendering</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Method 1: Using hooks */}
        {isDesktop ? (
          <div className="p-4 bg-blue-50 rounded-lg">Desktop View (using hook)</div>
        ) : (
          <div className="p-4 bg-green-50 rounded-lg">Mobile View (using hook)</div>
        )}

        {/* Method 2: Using Tailwind classes */}
        <div className="p-4 bg-purple-50 rounded-lg hidden md:block">
          Desktop View (using Tailwind hidden class)
        </div>
        <div className="p-4 bg-yellow-50 rounded-lg md:hidden">
          Mobile View (using Tailwind hidden class)
        </div>
      </CardContent>
    </Card>
  );
}

// Example 8: Touch-Friendly Buttons
export function TouchFriendlyButtonsExample() {
  const isTouch = useTouchDevice();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Touch-Friendly Buttons</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Always 44x44px or larger */}
        <div className="space-y-2">
          <p className="text-sm font-medium">Touch-sized buttons (44x44px):</p>
          <div className="flex gap-2">
            <button className="h-11 w-11 bg-primary text-white rounded-lg">A</button>
            <button className="h-11 w-11 bg-primary text-white rounded-lg">B</button>
            <button className="h-11 w-11 bg-primary text-white rounded-lg">C</button>
          </div>
        </div>

        {/* Responsive: larger on mobile, normal on desktop */}
        <div className="space-y-2">
          <p className="text-sm font-medium">Responsive-sized buttons:</p>
          <div className="flex gap-2">
            <button className="h-11 w-11 md:h-10 md:w-10 bg-secondary text-black rounded-lg">
              A
            </button>
            <button className="h-11 w-11 md:h-10 md:w-10 bg-secondary text-black rounded-lg">
              B
            </button>
            <button className="h-11 w-11 md:h-10 md:w-10 bg-secondary text-black rounded-lg">
              C
            </button>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          Larger buttons on mobile for easier touch, smaller on desktop for mouse precision
        </p>
      </CardContent>
    </Card>
  );
}

// Example 9: All Examples Combined
export function AllExamplesPage() {
  return (
    <div className="space-y-8 p-4 md:p-6 lg:p-8">
      <h1 className="text-3xl font-bold">Responsive Design Examples</h1>

      <ResponsiveHooksExample />
      <TouchDeviceExample />
      <ResponsiveModalExample />
      <MobileNavDrawerExample />
      <ResponsiveGridExample />
      <ResponsiveFormExample />
      <ConditionalRenderingExample />
      <TouchFriendlyButtonsExample />

      <Card>
        <CardHeader>
          <CardTitle>Testing Tips</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">Browser DevTools</h3>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>Press Ctrl+Shift+M (or Cmd+Shift+M on Mac) to toggle device toolbar</li>
              <li>Select different device sizes from the dropdown</li>
              <li>Test with "Enable touch simulation" enabled</li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Test Breakpoints</h3>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>Mobile: 375px - 639px</li>
              <li>Tablet: 640px - 1023px</li>
              <li>Desktop: 1024px+</li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Key Files</h3>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>/hooks/use-media-query.ts - Media query hooks</li>
              <li>/lib/responsive-utils.ts - Responsive utilities</li>
              <li>/components/ui/responsive-modal.tsx - Responsive modal/drawer</li>
              <li>/components/ui/mobile-nav-drawer.tsx - Mobile navigation</li>
              <li>/docs/RESPONSIVE_DESIGN_PATTERNS.md - Complete guide</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default AllExamplesPage;
