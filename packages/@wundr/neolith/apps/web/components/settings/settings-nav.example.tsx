/**
 * Settings Navigation Component - Usage Examples
 * @module components/settings/settings-nav
 */

import {
  Settings,
  User,
  Bell,
  Shield,
  Palette,
  Plug,
  Lock,
  CreditCard,
  Users,
  Zap,
} from 'lucide-react';

import { SettingsNav, MobileSettingsNav } from './settings-nav';

import type { NavSection } from './settings-nav';

/**
 * Example 1: Basic Usage with Default Sections
 */
export function BasicSettingsNavExample() {
  return <SettingsNav workspaceId='my-workspace' />;
}

/**
 * Example 2: Custom Sections with Badges
 */
export function CustomSectionsExample() {
  const customSections: NavSection[] = [
    {
      label: 'Account',
      items: [
        { href: '/my-workspace/settings', label: 'General', icon: Settings },
        {
          href: '/my-workspace/settings/profile',
          label: 'Profile',
          icon: User,
        },
        {
          href: '/my-workspace/settings/billing',
          label: 'Billing',
          icon: CreditCard,
          badge: 'Pro',
        },
      ],
    },
    {
      label: 'Preferences',
      items: [
        {
          href: '/my-workspace/settings/appearance',
          label: 'Appearance',
          icon: Palette,
        },
        {
          href: '/my-workspace/settings/notifications',
          label: 'Notifications',
          icon: Bell,
          badge: 5,
        },
      ],
    },
    {
      label: 'Team',
      items: [
        {
          href: '/my-workspace/settings/members',
          label: 'Members',
          icon: Users,
          badge: 12,
        },
        {
          href: '/my-workspace/settings/integrations',
          label: 'Integrations',
          icon: Plug,
          badge: 'New',
        },
      ],
    },
    {
      label: 'Security',
      items: [
        {
          href: '/my-workspace/settings/security',
          label: 'Security',
          icon: Shield,
        },
        {
          href: '/my-workspace/settings/privacy',
          label: 'Privacy',
          icon: Lock,
        },
      ],
    },
  ];

  return <SettingsNav workspaceId='my-workspace' sections={customSections} />;
}

/**
 * Example 3: Collapsible Sections
 */
export function CollapsibleSectionsExample() {
  const sectionsWithCollapse: NavSection[] = [
    {
      label: 'Account',
      collapsible: true,
      items: [
        { href: '/my-workspace/settings', label: 'General', icon: Settings },
        {
          href: '/my-workspace/settings/profile',
          label: 'Profile',
          icon: User,
        },
      ],
    },
    {
      label: 'Advanced',
      collapsible: true,
      defaultCollapsed: true,
      items: [
        {
          href: '/my-workspace/settings/integrations',
          label: 'Integrations',
          icon: Plug,
        },
        { href: '/my-workspace/settings/api', label: 'API Keys', icon: Zap },
      ],
    },
  ];

  return (
    <SettingsNav workspaceId='my-workspace' sections={sectionsWithCollapse} />
  );
}

/**
 * Example 4: With Disabled Items
 */
export function DisabledItemsExample() {
  const sectionsWithDisabled: NavSection[] = [
    {
      label: 'Account',
      items: [
        { href: '/my-workspace/settings', label: 'General', icon: Settings },
        {
          href: '/my-workspace/settings/profile',
          label: 'Profile',
          icon: User,
        },
        {
          href: '/my-workspace/settings/billing',
          label: 'Billing',
          icon: CreditCard,
          disabled: true,
          badge: 'Pro',
        },
      ],
    },
  ];

  return (
    <SettingsNav workspaceId='my-workspace' sections={sectionsWithDisabled} />
  );
}

/**
 * Example 5: Mobile Navigation
 */
export function MobileNavigationExample() {
  const mobileSections: NavSection[] = [
    {
      label: 'Account',
      items: [
        { href: '/my-workspace/settings', label: 'General', icon: Settings },
        {
          href: '/my-workspace/settings/profile',
          label: 'Profile',
          icon: User,
        },
      ],
    },
    {
      label: 'Preferences',
      items: [
        {
          href: '/my-workspace/settings/appearance',
          label: 'Appearance',
          icon: Palette,
        },
        {
          href: '/my-workspace/settings/notifications',
          label: 'Notifications',
          icon: Bell,
          badge: 3,
        },
      ],
    },
  ];

  return (
    <MobileSettingsNav workspaceId='my-workspace' sections={mobileSections} />
  );
}

/**
 * Example 6: Responsive Layout (Desktop + Mobile)
 */
export function ResponsiveExample() {
  const sections: NavSection[] = [
    {
      label: 'Account',
      items: [
        { href: '/my-workspace/settings', label: 'General', icon: Settings },
        {
          href: '/my-workspace/settings/profile',
          label: 'Profile',
          icon: User,
        },
      ],
    },
    {
      label: 'Preferences',
      items: [
        {
          href: '/my-workspace/settings/appearance',
          label: 'Appearance',
          icon: Palette,
        },
        {
          href: '/my-workspace/settings/notifications',
          label: 'Notifications',
          icon: Bell,
          badge: 3,
        },
      ],
    },
    {
      label: 'Advanced',
      items: [
        {
          href: '/my-workspace/settings/security',
          label: 'Security',
          icon: Shield,
        },
        {
          href: '/my-workspace/settings/integrations',
          label: 'Integrations',
          icon: Plug,
        },
      ],
    },
  ];

  return (
    <>
      {/* Desktop Navigation */}
      <div className='hidden md:block'>
        <SettingsNav workspaceId='my-workspace' sections={sections} />
      </div>

      {/* Mobile Navigation */}
      <div className='block md:hidden'>
        <MobileSettingsNav workspaceId='my-workspace' sections={sections} />
      </div>
    </>
  );
}
