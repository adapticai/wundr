'use client';

import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useParams } from 'next/navigation';
import * as React from 'react';

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';

export function NavSecondary({
  items,
  ...props
}: {
  items: {
    title: string;
    url: string;
    icon: LucideIcon;
  }[];
} & React.ComponentPropsWithoutRef<typeof SidebarGroup>) {
  const pathname = usePathname();
  const params = useParams();
  const workspaceSlug = params?.workspaceSlug as string | undefined;

  const isActive = (url: string) => {
    const fullUrl = workspaceSlug ? `/${workspaceSlug}${url}` : url;
    return pathname === fullUrl || pathname?.startsWith(`${fullUrl}/`);
  };

  const resolveUrl = (url: string) => {
    return workspaceSlug ? `/${workspaceSlug}${url}` : url;
  };

  return (
    <SidebarGroup {...props}>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map(item => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton asChild isActive={isActive(item.url)}>
                <Link href={resolveUrl(item.url)}>
                  <item.icon />
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
