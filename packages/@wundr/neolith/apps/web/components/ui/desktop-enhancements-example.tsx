/**
 * Desktop Enhancements Example
 * Example usage of Wave 3.1.3 Desktop Enhancement components
 * @module components/ui/desktop-enhancements-example
 *
 * This file demonstrates how to use the new desktop-specific components.
 * It is not part of the production code - use as a reference.
 */
'use client';

import * as React from 'react';
import { CommandPalette } from '@/components/ui/command-palette';
import { KeyboardShortcutsTrigger } from '@/components/ui/keyboard-shortcuts';
import { MultiPanelLayout } from '@/components/layout/multi-panel-layout';
import {
  DragDropUpload,
  type UploadedFile,
} from '@/components/ui/drag-drop-upload';
import {
  ContextMenuWrapper,
  type ContextMenuAction,
} from '@/components/ui/context-menu-wrapper';
import { useDesktopNotifications } from '@/hooks/use-desktop-notifications';
import { Copy, Edit, Trash, Share } from 'lucide-react';

/**
 * Example: Command Palette Integration
 * Add to your root layout or main app component
 */
export function CommandPaletteExample() {
  return (
    <>
      {/* Add this at the root level */}
      <CommandPalette workspaceId='workspace-123' />

      {/* Users can now press Cmd+K or Ctrl+K to open the command palette */}
    </>
  );
}

/**
 * Example: Keyboard Shortcuts
 * Show a help dialog with all keyboard shortcuts
 */
export function KeyboardShortcutsExample() {
  return (
    <div className='p-4'>
      {/* Add to your settings or help menu */}
      <KeyboardShortcutsTrigger />

      {/* Users can now press ? to see all shortcuts */}
    </div>
  );
}

/**
 * Example: Multi-Panel Layout
 * Create a complex layout with resizable panels
 */
export function MultiPanelLayoutExample() {
  return (
    <MultiPanelLayout
      leftPanel={{
        content: <div className='p-4'>Left Sidebar Content</div>,
        defaultSize: 300,
        minSize: 200,
        maxSize: 500,
        collapsible: true,
      }}
      rightPanel={{
        content: <div className='p-4'>Right Sidebar Content</div>,
        defaultSize: 350,
        minSize: 250,
        maxSize: 600,
        collapsible: true,
      }}
      bottomPanel={{
        content: <div className='p-4'>Bottom Panel (e.g., Terminal)</div>,
        defaultSize: 300,
        minSize: 100,
        maxSize: 600,
        collapsible: true,
      }}
      storageKey='my-app-layout'
    >
      {/* Main content area */}
      <div className='p-8'>
        <h1 className='text-2xl font-bold'>Main Content</h1>
        <p className='mt-4'>This area flexes to fill available space.</p>
      </div>
    </MultiPanelLayout>
  );
}

/**
 * Example: Drag and Drop Upload
 * File upload with drag-and-drop support
 */
export function DragDropUploadExample() {
  const [files, setFiles] = React.useState<UploadedFile[]>([]);

  const handleFilesSelected = (newFiles: File[]) => {
    // Convert File objects to UploadedFile format
    const uploadedFiles: UploadedFile[] = newFiles.map((file, index) => ({
      id: `file-${Date.now()}-${index}`,
      file,
      progress: 0,
    }));

    setFiles([...files, ...uploadedFiles]);

    // Simulate upload progress
    uploadedFiles.forEach(uploadedFile => {
      let progress = 0;
      const interval = setInterval(() => {
        progress += 10;
        if (progress > 100) {
          clearInterval(interval);
          progress = 100;
        }

        setFiles(prevFiles =>
          prevFiles.map(f =>
            f.id === uploadedFile.id ? { ...f, progress } : f
          )
        );
      }, 200);
    });
  };

  const handleFileRemove = (fileId: string) => {
    setFiles(files.filter(f => f.id !== fileId));
  };

  return (
    <div className='max-w-2xl mx-auto p-8'>
      <h2 className='text-xl font-bold mb-4'>Upload Files</h2>
      <DragDropUpload
        onFilesSelected={handleFilesSelected}
        onFileRemove={handleFileRemove}
        accept='image/*,video/*,.pdf,.doc,.docx'
        maxSize={10 * 1024 * 1024} // 10MB
        maxFiles={5}
        multiple
        uploadedFiles={files}
        showPreview
      />
    </div>
  );
}

/**
 * Example: Context Menu Wrapper
 * Add right-click context menus to any element
 */
export function ContextMenuWrapperExample() {
  const menuItems: ContextMenuAction[] = [
    {
      label: 'Copy',
      icon: <Copy className='h-4 w-4' />,
      shortcut: ['Cmd', 'C'],
      onClick: () => console.log('Copy clicked'),
    },
    {
      label: 'Edit',
      icon: <Edit className='h-4 w-4' />,
      shortcut: ['Cmd', 'E'],
      onClick: () => console.log('Edit clicked'),
    },
    { type: 'separator', label: '' },
    {
      label: 'Share',
      icon: <Share className='h-4 w-4' />,
      children: [
        {
          label: 'Email',
          onClick: () => console.log('Share via email'),
        },
        {
          label: 'Link',
          onClick: () => console.log('Copy link'),
        },
      ],
    },
    { type: 'separator', label: '' },
    {
      label: 'Delete',
      icon: <Trash className='h-4 w-4' />,
      shortcut: ['Delete'],
      onClick: () => console.log('Delete clicked'),
    },
  ];

  return (
    <div className='p-8'>
      <ContextMenuWrapper items={menuItems}>
        <div className='p-8 border rounded-lg bg-muted'>
          <p className='text-center'>Right-click on me to see context menu!</p>
        </div>
      </ContextMenuWrapper>
    </div>
  );
}

/**
 * Example: Desktop Notifications
 * Send browser notifications
 */
export function DesktopNotificationsExample() {
  const {
    permission,
    isSupported,
    requestPermission,
    sendNotification,
    isPermissionGranted,
  } = useDesktopNotifications();

  const handleRequestPermission = async () => {
    const result = await requestPermission();
    console.log('Permission result:', result);
  };

  const handleSendNotification = () => {
    sendNotification({
      title: 'New Message',
      body: 'You have a new message from John Doe',
      icon: '/icon-192x192.png',
      onClick: () => {
        console.log('Notification clicked');
        // Navigate to the message
      },
    });
  };

  return (
    <div className='p-8 space-y-4'>
      <h2 className='text-xl font-bold'>Desktop Notifications</h2>

      {!isSupported && (
        <p className='text-destructive'>
          Notifications are not supported in this browser
        </p>
      )}

      {isSupported && (
        <>
          <p>
            Permission status: <strong>{permission}</strong>
          </p>

          {!isPermissionGranted && (
            <button
              onClick={handleRequestPermission}
              className='px-4 py-2 bg-primary text-primary-foreground rounded'
            >
              Request Permission
            </button>
          )}

          {isPermissionGranted && (
            <button
              onClick={handleSendNotification}
              className='px-4 py-2 bg-primary text-primary-foreground rounded'
            >
              Send Test Notification
            </button>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Example: 4K Display Optimizations
 * Use the new 4K CSS utilities
 */
export function FourKDisplayExample() {
  return (
    <div className='ultra-hd:center-content p-8'>
      <h1 className='ultra-hd:text-4xl text-2xl font-bold mb-4'>
        4K Optimized Content
      </h1>
      <p className='ultra-hd:text-lg text-base ultra-hd:p-6 p-4 bg-muted rounded-lg'>
        This text and spacing automatically scales on 4K displays (≥1920px).
      </p>

      <div className='grid grid-cols-2 ultra-hd:grid-cols-4 ultra-hd:gap-6 gap-4 mt-6'>
        <div className='ultra-hd:p-6 p-4 bg-card rounded-lg ultra-hd:shadow-lg shadow'>
          Card 1
        </div>
        <div className='ultra-hd:p-6 p-4 bg-card rounded-lg ultra-hd:shadow-lg shadow'>
          Card 2
        </div>
        <div className='ultra-hd:p-6 p-4 bg-card rounded-lg ultra-hd:shadow-lg shadow'>
          Card 3
        </div>
        <div className='ultra-hd:p-6 p-4 bg-card rounded-lg ultra-hd:shadow-lg shadow'>
          Card 4
        </div>
      </div>
    </div>
  );
}
