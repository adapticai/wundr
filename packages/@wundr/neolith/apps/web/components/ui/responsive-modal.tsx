'use client';

import * as React from 'react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import { useMediaQuery } from '@/hooks/use-media-query';

export interface ResponsiveModalProps {
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactNode;
}

export interface ResponsiveModalContentProps {
  children: React.ReactNode;
  className?: string;
}

export interface ResponsiveModalHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export interface ResponsiveModalTitleProps {
  children: React.ReactNode;
  className?: string;
}

export interface ResponsiveModalDescriptionProps {
  children: React.ReactNode;
  className?: string;
}

export interface ResponsiveModalFooterProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Responsive modal component that switches between Dialog (desktop) and Drawer (mobile)
 * - Uses Dialog on md+ breakpoint (768px+)
 * - Uses Drawer below md breakpoint
 * - Single API that adapts to viewport size
 *
 * @example
 * <ResponsiveModal open={open} onOpenChange={setOpen}>
 *   <ResponsiveModalTrigger>
 *     <Button>Open Modal</Button>
 *   </ResponsiveModalTrigger>
 *   <ResponsiveModalContent>
 *     <ResponsiveModalHeader>
 *       <ResponsiveModalTitle>Title</ResponsiveModalTitle>
 *       <ResponsiveModalDescription>Description</ResponsiveModalDescription>
 *     </ResponsiveModalHeader>
 *     <div>Content goes here</div>
 *     <ResponsiveModalFooter>
 *       <Button>Action</Button>
 *     </ResponsiveModalFooter>
 *   </ResponsiveModalContent>
 * </ResponsiveModal>
 */
export function ResponsiveModal({
  children,
  open,
  onOpenChange,
  ...props
}: ResponsiveModalProps) {
  const isDesktop = useMediaQuery('(min-width: 768px)');

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange} {...props}>
        {children}
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange} {...props}>
      {children}
    </Drawer>
  );
}

export function ResponsiveModalTrigger({ children }: { children: React.ReactNode }) {
  const isDesktop = useMediaQuery('(min-width: 768px)');

  if (isDesktop) {
    return <DialogTrigger asChild>{children}</DialogTrigger>;
  }

  return <DrawerTrigger asChild>{children}</DrawerTrigger>;
}

export function ResponsiveModalContent({
  children,
  className,
}: ResponsiveModalContentProps) {
  const isDesktop = useMediaQuery('(min-width: 768px)');

  if (isDesktop) {
    return <DialogContent className={className}>{children}</DialogContent>;
  }

  return <DrawerContent className={className}>{children}</DrawerContent>;
}

export function ResponsiveModalHeader({
  children,
  className,
}: ResponsiveModalHeaderProps) {
  const isDesktop = useMediaQuery('(min-width: 768px)');

  if (isDesktop) {
    return <DialogHeader className={className}>{children}</DialogHeader>;
  }

  return <DrawerHeader className={className}>{children}</DrawerHeader>;
}

export function ResponsiveModalTitle({
  children,
  className,
}: ResponsiveModalTitleProps) {
  const isDesktop = useMediaQuery('(min-width: 768px)');

  if (isDesktop) {
    return <DialogTitle className={className}>{children}</DialogTitle>;
  }

  return <DrawerTitle className={className}>{children}</DrawerTitle>;
}

export function ResponsiveModalDescription({
  children,
  className,
}: ResponsiveModalDescriptionProps) {
  const isDesktop = useMediaQuery('(min-width: 768px)');

  if (isDesktop) {
    return <DialogDescription className={className}>{children}</DialogDescription>;
  }

  return <DrawerDescription className={className}>{children}</DrawerDescription>;
}

export function ResponsiveModalFooter({
  children,
  className,
}: ResponsiveModalFooterProps) {
  const isDesktop = useMediaQuery('(min-width: 768px)');

  if (isDesktop) {
    return <DialogFooter className={className}>{children}</DialogFooter>;
  }

  return <DrawerFooter className={className}>{children}</DrawerFooter>;
}

export function ResponsiveModalClose({ children }: { children: React.ReactNode }) {
  const isDesktop = useMediaQuery('(min-width: 768px)');

  // Dialog has built-in close button in DialogContent
  // For drawer, we can use DrawerClose
  if (isDesktop) {
    return <>{children}</>;
  }

  return <DrawerClose asChild>{children}</DrawerClose>;
}
