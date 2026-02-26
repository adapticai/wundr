'use client';

import {
  Archive,
  Bookmark,
  BookmarkCheck,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  ExternalLink,
  FileIcon,
  FileText,
  Forward,
  Hash,
  Image,
  Loader2,
  MessageSquare,
  MoreHorizontal,
  Music,
  Trash2,
  Video,
  Archive as ArchiveIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import {
  ShareFileDialog,
  type ShareFileData,
} from '@/components/channel/share-file-dialog';
import { useFilePreview } from '@/components/file-preview';
import { EmptyState } from '@/components/ui/empty-state';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UserAvatar } from '@/components/ui/user-avatar';

import type { SavedItemStatus, SavedItemType } from '@neolith/database';

/**
 * Saved item with included relations (matches Prisma API response)
 */
interface SavedItem {
  id: string;
  itemType: SavedItemType;
  status: SavedItemStatus;
  note: string | null;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  archivedAt: string | null;
  message: {
    id: string;
    content: string;
    createdAt: string;
    author: {
      id: string;
      name: string | null;
      displayName: string | null;
      avatarUrl: string | null;
      isOrchestrator: boolean;
    };
    channel: {
      id: string;
      name: string;
      slug: string;
      type: string;
    };
  } | null;
  file: {
    id: string;
    filename: string;
    originalName: string;
    mimeType: string;
    size: number;
    url?: string;
    thumbnailUrl?: string | null;
    createdAt: string;
    uploadedBy: {
      id: string;
      name: string | null;
      displayName: string | null;
      avatarUrl: string | null;
    };
  } | null;
}

type TabValue = 'in_progress' | 'completed' | 'archived';

/**
 * Later Page
 *
 * Displays user's saved/bookmarked items with tabs for In Progress, Completed, and Archived.
 * Similar to Slack's "Later" feature.
 */
export default function LaterPage() {
  const params = useParams();
  const workspaceSlug = params?.workspaceSlug as string;

  const [activeTab, setActiveTab] = useState<TabValue>('in_progress');
  const [items, setItems] = useState<SavedItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [counts, setCounts] = useState({
    in_progress: 0,
    completed: 0,
    archived: 0,
  });

  // Share file dialog state
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [fileToShare, setFileToShare] = useState<ShareFileData | null>(null);

  // Handler to open share dialog
  const handleOpenShareDialog = useCallback(
    (file: NonNullable<SavedItem['file']>) => {
      setFileToShare({
        id: file.id,
        name: file.originalName,
        mimeType: file.mimeType,
        size: file.size,
        url: file.url,
        thumbnailUrl: file.thumbnailUrl ?? undefined,
        uploadedBy: {
          id: file.uploadedBy.id,
          name: file.uploadedBy.name,
          displayName: file.uploadedBy.displayName,
          avatarUrl: file.uploadedBy.avatarUrl,
        },
        uploadedAt: file.createdAt,
      });
      setShareDialogOpen(true);
    },
    []
  );

  // Fetch saved items
  const fetchItems = useCallback(
    async (status: SavedItemStatus) => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/workspaces/${workspaceSlug}/saved-items?status=${status}&limit=50`
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error('Saved items API error:', response.status, errorData);
          throw new Error(
            errorData.error ||
              `Failed to fetch saved items (${response.status})`
          );
        }

        const data = await response.json();
        setItems(data.data || []);
      } catch (err) {
        console.error('Error fetching saved items:', err);
        setError(err instanceof Error ? err.message : 'An error occurred');
        setItems([]);
      } finally {
        setIsLoading(false);
      }
    },
    [workspaceSlug]
  );

  // Fetch counts for all tabs
  const fetchCounts = useCallback(async () => {
    try {
      const [inProgressRes, completedRes, archivedRes] = await Promise.all([
        fetch(
          `/api/workspaces/${workspaceSlug}/saved-items?status=IN_PROGRESS&limit=1`
        ),
        fetch(
          `/api/workspaces/${workspaceSlug}/saved-items?status=COMPLETED&limit=1`
        ),
        fetch(
          `/api/workspaces/${workspaceSlug}/saved-items?status=ARCHIVED&limit=1`
        ),
      ]);

      const [inProgress, completed, archived] = await Promise.all([
        inProgressRes.json(),
        completedRes.json(),
        archivedRes.json(),
      ]);

      setCounts({
        in_progress: inProgress.pagination?.totalCount || 0,
        completed: completed.pagination?.totalCount || 0,
        archived: archived.pagination?.totalCount || 0,
      });
    } catch (err) {
      console.error('Error fetching counts:', err);
    }
  }, [workspaceSlug]);

  // Map tab value to API status
  const tabToStatus = (tab: TabValue): SavedItemStatus => {
    const map: Record<TabValue, SavedItemStatus> = {
      in_progress: 'IN_PROGRESS',
      completed: 'COMPLETED',
      archived: 'ARCHIVED',
    };
    return map[tab];
  };

  // Fetch items when tab changes
  useEffect(() => {
    fetchItems(tabToStatus(activeTab));
  }, [activeTab, fetchItems]);

  // Fetch counts on mount
  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);

  // Update item status
  const updateItemStatus = async (
    itemId: string,
    newStatus: SavedItemStatus
  ) => {
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceSlug}/saved-items/${itemId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to update item');
      }

      // Refresh items and counts
      await Promise.all([fetchItems(tabToStatus(activeTab)), fetchCounts()]);
    } catch (err) {
      console.error('Error updating item:', err);
    }
  };

  // Delete item
  const deleteItem = async (itemId: string) => {
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceSlug}/saved-items/${itemId}`,
        { method: 'DELETE' }
      );

      if (!response.ok) {
        throw new Error('Failed to delete item');
      }

      // Refresh items and counts
      await Promise.all([fetchItems(tabToStatus(activeTab)), fetchCounts()]);
    } catch (err) {
      console.error('Error deleting item:', err);
    }
  };

  return (
    <div className='flex h-full flex-col'>
      {/* Header */}
      <div className='border-b px-6 py-4'>
        <div className='flex items-center gap-3'>
          <div className='flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10'>
            <Bookmark className='h-5 w-5 text-primary' />
          </div>
          <div>
            <h1 className='text-xl font-semibold'>Later</h1>
            <p className='text-sm text-muted-foreground'>
              Messages and files you've saved for later
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className='flex-1 overflow-hidden'>
        <Tabs
          value={activeTab}
          onValueChange={value => setActiveTab(value as TabValue)}
          className='flex h-full flex-col'
        >
          <div className='border-b px-6'>
            <TabsList className='h-12 w-full justify-start gap-1 rounded-none bg-transparent p-0'>
              <TabsTrigger
                value='in_progress'
                className='relative h-12 rounded-none border-b-2 border-transparent bg-transparent px-4 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none'
              >
                <Clock className='mr-2 h-4 w-4' />
                In progress
                {counts.in_progress > 0 && (
                  <span className='ml-2 rounded-full bg-muted px-2 py-0.5 text-xs'>
                    {counts.in_progress}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger
                value='archived'
                className='relative h-12 rounded-none border-b-2 border-transparent bg-transparent px-4 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none'
              >
                <Archive className='mr-2 h-4 w-4' />
                Archived
                {counts.archived > 0 && (
                  <span className='ml-2 rounded-full bg-muted px-2 py-0.5 text-xs'>
                    {counts.archived}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger
                value='completed'
                className='relative h-12 rounded-none border-b-2 border-transparent bg-transparent px-4 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none'
              >
                <CheckCircle2 className='mr-2 h-4 w-4' />
                Completed
                {counts.completed > 0 && (
                  <span className='ml-2 rounded-full bg-muted px-2 py-0.5 text-xs'>
                    {counts.completed}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>
          </div>

          <div className='flex-1 overflow-y-auto p-6'>
            {/* Loading State */}
            {isLoading && (
              <div className='flex items-center justify-center py-12'>
                <Loader2 className='h-8 w-8 animate-spin text-muted-foreground' />
              </div>
            )}

            {/* Error State */}
            {error && !isLoading && (
              <div className='rounded-lg border border-destructive/50 bg-destructive/10 p-4'>
                <p className='text-sm text-destructive'>{error}</p>
                <button
                  type='button'
                  onClick={() => fetchItems(tabToStatus(activeTab))}
                  className='mt-2 text-sm font-medium text-destructive hover:underline'
                >
                  Try again
                </button>
              </div>
            )}

            {/* Content */}
            {!isLoading && !error && (
              <>
                <TabsContent value='in_progress' className='m-0'>
                  <SavedItemsList
                    items={items}
                    workspaceSlug={workspaceSlug}
                    onMarkComplete={id => updateItemStatus(id, 'COMPLETED')}
                    onArchive={id => updateItemStatus(id, 'ARCHIVED')}
                    onDelete={deleteItem}
                    onShareFile={handleOpenShareDialog}
                    emptyMessage='No items saved for later. Bookmark messages and files to see them here.'
                  />
                </TabsContent>

                <TabsContent value='archived' className='m-0'>
                  <SavedItemsList
                    items={items}
                    workspaceSlug={workspaceSlug}
                    onRestore={id => updateItemStatus(id, 'IN_PROGRESS')}
                    onDelete={deleteItem}
                    onShareFile={handleOpenShareDialog}
                    emptyMessage='No archived items. Items you archive will appear here.'
                    isArchived
                  />
                </TabsContent>

                <TabsContent value='completed' className='m-0'>
                  <SavedItemsList
                    items={items}
                    workspaceSlug={workspaceSlug}
                    onRestore={id => updateItemStatus(id, 'IN_PROGRESS')}
                    onDelete={deleteItem}
                    onShareFile={handleOpenShareDialog}
                    emptyMessage="No completed items. Mark items as complete when you're done with them."
                    isCompleted
                  />
                </TabsContent>
              </>
            )}
          </div>
        </Tabs>
      </div>

      {/* Share File Dialog */}
      <ShareFileDialog
        open={shareDialogOpen}
        onOpenChange={setShareDialogOpen}
        file={fileToShare}
        workspaceSlug={workspaceSlug}
        onShareSuccess={destinations => {
          console.log('File shared to:', destinations);
          // Refresh the items after sharing
          fetchItems(tabToStatus(activeTab));
        }}
      />
    </div>
  );
}

/**
 * Saved Items List Component
 */
interface SavedItemsListProps {
  items: SavedItem[];
  workspaceSlug: string;
  onMarkComplete?: (id: string) => void;
  onArchive?: (id: string) => void;
  onRestore?: (id: string) => void;
  onDelete: (id: string) => void;
  onShareFile?: (file: NonNullable<SavedItem['file']>) => void;
  emptyMessage: string;
  isArchived?: boolean;
  isCompleted?: boolean;
}

function SavedItemsList({
  items,
  workspaceSlug,
  onMarkComplete,
  onArchive,
  onRestore,
  onDelete,
  onShareFile,
  emptyMessage,
  isArchived,
  isCompleted,
}: SavedItemsListProps) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={Bookmark}
        title='Nothing here yet'
        description={emptyMessage}
      />
    );
  }

  // Group items by type
  const messages = items.filter(
    item => item.itemType === 'MESSAGE' && item.message
  );
  const files = items.filter(item => item.itemType === 'FILE' && item.file);

  return (
    <div className='space-y-6'>
      {/* Messages Section */}
      {messages.length > 0 && (
        <div>
          <h3 className='mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground'>
            <MessageSquare className='h-4 w-4' />
            Messages ({messages.length})
          </h3>
          <div className='space-y-2'>
            {messages.map(item => (
              <SavedMessageCard
                key={item.id}
                item={item}
                workspaceSlug={workspaceSlug}
                onMarkComplete={onMarkComplete}
                onArchive={onArchive}
                onRestore={onRestore}
                onDelete={onDelete}
                isArchived={isArchived}
                isCompleted={isCompleted}
              />
            ))}
          </div>
        </div>
      )}

      {/* Files Section */}
      {files.length > 0 && (
        <div>
          <h3 className='mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground'>
            <FileIcon className='h-4 w-4' />
            Files ({files.length})
          </h3>
          <div className='space-y-2'>
            {files.map(item => (
              <SavedFileCard
                key={item.id}
                item={item}
                workspaceSlug={workspaceSlug}
                onMarkComplete={onMarkComplete}
                onArchive={onArchive}
                onRestore={onRestore}
                onDelete={onDelete}
                onShareFile={onShareFile}
                isArchived={isArchived}
                isCompleted={isCompleted}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Saved Message Card Component
 */
interface SavedItemCardProps {
  item: SavedItem;
  workspaceSlug: string;
  onMarkComplete?: (id: string) => void;
  onArchive?: (id: string) => void;
  onRestore?: (id: string) => void;
  onDelete: (id: string) => void;
  onShareFile?: (file: NonNullable<SavedItem['file']>) => void;
  isArchived?: boolean;
  isCompleted?: boolean;
}

function SavedMessageCard({
  item,
  workspaceSlug,
  onMarkComplete,
  onArchive,
  onRestore,
  onDelete,
  isArchived,
  isCompleted,
}: SavedItemCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const message = item.message;

  if (!message) {
    return null;
  }

  const channelUrl =
    message.channel.type === 'DM'
      ? `/${workspaceSlug}/dm/${message.channel.id}`
      : `/${workspaceSlug}/channels/${message.channel.id}`;

  const messageUrl = `${channelUrl}?message=${message.id}`;

  const handleOpenInNewTab = () => {
    window.open(messageUrl, '_blank');
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin + messageUrl);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Error copying link:', err);
    }
  };

  const handleRemoveFromLater = () => {
    onDelete(item.id);
  };

  return (
    <div className='group relative rounded-lg border bg-card p-4 transition-shadow hover:shadow-md'>
      <div className='flex gap-3'>
        {/* Author Avatar */}
        <UserAvatar
          user={{
            name: message.author.name,
            avatarUrl: message.author.avatarUrl,
          }}
          size='sm'
        />

        {/* Content */}
        <div className='flex-1 min-w-0'>
          <div className='flex items-start justify-between gap-2'>
            <div className='flex-1 min-w-0'>
              <div className='flex items-center gap-2'>
                <span className='font-medium'>
                  {message.author.displayName ||
                    message.author.name ||
                    'Unknown'}
                </span>
                {message.author.isOrchestrator && (
                  <span className='rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary'>
                    AI
                  </span>
                )}
                <span className='text-xs text-muted-foreground'>
                  {formatRelativeTime(message.createdAt)}
                </span>
              </div>
              <Link
                href={channelUrl}
                className='flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground'
              >
                <Hash className='h-3 w-3' />
                {message.channel.name}
              </Link>
            </div>

            {/* Quick Action Icons - Always visible on hover */}
            <div className='flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity'>
              {/* Open in new tab */}
              <button
                type='button'
                onClick={handleOpenInNewTab}
                className='rounded p-1.5 hover:bg-muted'
                title='Open in new tab'
              >
                <ExternalLink className='h-4 w-4' />
              </button>

              {/* Copy link */}
              <button
                type='button'
                onClick={handleCopyLink}
                className='rounded p-1.5 hover:bg-muted'
                title={copySuccess ? 'Copied!' : 'Copy link'}
              >
                <Copy className='h-4 w-4' />
              </button>

              {/* Forward/Share - opens message in context */}
              <button
                type='button'
                onClick={handleOpenInNewTab}
                className='rounded p-1.5 hover:bg-muted'
                title='Open message'
              >
                <Forward className='h-4 w-4' />
              </button>

              {/* Bookmark (filled since it's in Later) - click to remove */}
              <button
                type='button'
                onClick={handleRemoveFromLater}
                className='rounded p-1.5 hover:bg-muted text-primary'
                title='Remove from Later'
              >
                <BookmarkCheck className='h-4 w-4 fill-current' />
              </button>

              {/* More Options Menu */}
              <div className='relative'>
                <button
                  type='button'
                  onClick={() => setShowMenu(!showMenu)}
                  className='rounded p-1.5 hover:bg-muted'
                  title='More options'
                >
                  <MoreHorizontal className='h-4 w-4' />
                </button>

                {showMenu && (
                  <>
                    <div
                      className='fixed inset-0 z-10'
                      onClick={() => setShowMenu(false)}
                    />
                    <div className='absolute right-0 top-full z-20 mt-1 w-52 rounded-md border bg-popover p-1 shadow-lg'>
                      {/* Message Actions */}
                      <button
                        type='button'
                        onClick={() => {
                          handleOpenInNewTab();
                          setShowMenu(false);
                        }}
                        className='flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent'
                      >
                        <ExternalLink className='h-4 w-4' />
                        Open in new tab
                      </button>
                      <button
                        type='button'
                        onClick={() => {
                          handleCopyLink();
                          setShowMenu(false);
                        }}
                        className='flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent'
                      >
                        <Copy className='h-4 w-4' />
                        {copySuccess ? 'Copied!' : 'Copy link'}
                      </button>
                      <button
                        type='button'
                        onClick={() => {
                          handleOpenInNewTab();
                          setShowMenu(false);
                        }}
                        className='flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent'
                      >
                        <Forward className='h-4 w-4' />
                        Open message
                      </button>
                      {/* Status Actions */}
                      {onMarkComplete && !isArchived && !isCompleted && (
                        <button
                          type='button'
                          onClick={() => {
                            onMarkComplete(item.id);
                            setShowMenu(false);
                          }}
                          className='flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent'
                        >
                          <CheckCircle2 className='h-4 w-4' />
                          Mark complete
                        </button>
                      )}
                      {onArchive && !isArchived && !isCompleted && (
                        <button
                          type='button'
                          onClick={() => {
                            onArchive(item.id);
                            setShowMenu(false);
                          }}
                          className='flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent'
                        >
                          <Archive className='h-4 w-4' />
                          Archive
                        </button>
                      )}
                      {onRestore && (isArchived || isCompleted) && (
                        <button
                          type='button'
                          onClick={() => {
                            onRestore(item.id);
                            setShowMenu(false);
                          }}
                          className='flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent'
                        >
                          <Clock className='h-4 w-4' />
                          Move to In progress
                        </button>
                      )}

                      <div className='my-1 h-px bg-border' />

                      {/* Destructive Actions */}
                      <button
                        type='button'
                        onClick={() => {
                          handleRemoveFromLater();
                          setShowMenu(false);
                        }}
                        className='flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-destructive hover:bg-accent'
                      >
                        <Trash2 className='h-4 w-4' />
                        Remove from Later
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Message Content */}
          <p className='mt-2 text-sm text-foreground line-clamp-3'>
            {message.content}
          </p>

          {/* Note */}
          {item.note && (
            <div className='mt-2 rounded bg-muted/50 px-2 py-1 text-xs text-muted-foreground'>
              Note: {item.note}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Saved File Card Component
 */
function SavedFileCard({
  item,
  workspaceSlug,
  onMarkComplete,
  onArchive,
  onRestore,
  onDelete,
  onShareFile,
  isArchived,
  isCompleted,
}: SavedItemCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const { openPreview } = useFilePreview();
  const file = item.file;

  if (!file) {
    return null;
  }

  const handlePreview = async () => {
    try {
      const response = await fetch(
        `/api/files/${file.id}/download?inline=true`
      );
      const data = await response.json();
      if (data.data?.url) {
        openPreview({
          id: file.id,
          url: data.data.url,
          originalName: file.originalName,
          mimeType: file.mimeType,
          size: file.size,
          thumbnailUrl: file.thumbnailUrl,
          uploadedBy: {
            name: file.uploadedBy.name,
            displayName: file.uploadedBy.displayName,
          },
          createdAt: file.createdAt,
        });
      }
    } catch (err) {
      console.error('Error opening file preview:', err);
    }
  };

  const formatFileSize = (bytes: number) => {
    const size = Number(bytes);
    if (size < 1024) {
      return `${size} B`;
    }
    if (size < 1024 * 1024) {
      return `${(size / 1024).toFixed(1)} KB`;
    }
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Get appropriate icon for file type
  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) {
      return Image;
    }
    if (mimeType.startsWith('video/')) {
      return Video;
    }
    if (mimeType.startsWith('audio/')) {
      return Music;
    }
    if (
      mimeType.includes('pdf') ||
      mimeType.includes('document') ||
      mimeType.includes('text')
    ) {
      return FileText;
    }
    if (
      mimeType.includes('zip') ||
      mimeType.includes('tar') ||
      mimeType.includes('rar')
    ) {
      return ArchiveIcon;
    }
    return FileIcon;
  };

  const isImage = file.mimeType.startsWith('image/');
  const FileTypeIcon = getFileIcon(file.mimeType);
  // Use thumbnailUrl if available, otherwise use the file URL for images
  const imagePreviewUrl = file.thumbnailUrl || (isImage ? file.url : null);

  // File action handlers
  const handleOpenInNewTab = async () => {
    try {
      const response = await fetch(
        `/api/files/${file.id}/download?inline=true`
      );
      const data = await response.json();
      if (data.data?.url) {
        window.open(data.data.url, '_blank');
      }
    } catch (err) {
      console.error('Error opening file:', err);
    }
  };

  const handleCopyLink = async () => {
    try {
      const response = await fetch(
        `/api/files/${file.id}/download?inline=true`
      );
      const data = await response.json();
      if (data.data?.url) {
        await navigator.clipboard.writeText(data.data.url);
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
      }
    } catch (err) {
      console.error('Error copying link:', err);
    }
  };

  const handleDownload = async () => {
    try {
      const response = await fetch(
        `/api/files/${file.id}/download?download=true`
      );
      const data = await response.json();
      if (data.data?.url) {
        // Create a temporary anchor to trigger download
        const link = document.createElement('a');
        link.href = data.data.url;
        link.download = file.originalName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (err) {
      console.error('Error downloading file:', err);
    }
  };

  const handleShare = () => {
    // Open share dialog with the file
    if (onShareFile) {
      onShareFile(file);
    } else {
      // Fallback to copy link
      handleCopyLink();
    }
  };

  const handleRemoveFromLater = () => {
    onDelete(item.id);
  };

  // Suppress unused variable warning - workspaceSlug is available for future use
  void workspaceSlug;

  return (
    <div
      className='group relative rounded-lg border bg-card p-4 transition-shadow hover:shadow-md cursor-pointer'
      onClick={handlePreview}
      onKeyDown={e => e.key === 'Enter' && handlePreview()}
      role='button'
      tabIndex={0}
    >
      <div className='flex gap-3'>
        {/* File Thumbnail or Icon */}
        <div className='flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-muted overflow-hidden'>
          {isImage && imagePreviewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imagePreviewUrl}
              alt={file.originalName}
              className='h-full w-full object-cover'
            />
          ) : (
            <FileTypeIcon className='h-6 w-6 text-muted-foreground' />
          )}
        </div>

        {/* Content */}
        <div className='flex-1 min-w-0'>
          <div className='flex items-start justify-between gap-2'>
            <div className='flex-1 min-w-0'>
              <p className='truncate font-medium'>{file.originalName}</p>
              <div className='flex items-center gap-2 text-xs text-muted-foreground'>
                <span>{formatFileSize(file.size)}</span>
                <span>•</span>
                <span>{formatRelativeTime(file.createdAt)}</span>
                <span>•</span>
                <span>
                  {file.uploadedBy.displayName ||
                    file.uploadedBy.name ||
                    'Unknown'}
                </span>
              </div>
            </div>

            {/* Quick Action Icons - Always visible on hover */}
            <div className='flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity'>
              {/* Open in new tab */}
              <button
                type='button'
                onClick={e => {
                  e.stopPropagation();
                  handleOpenInNewTab();
                }}
                className='rounded p-1.5 hover:bg-muted'
                title='Open in new tab'
              >
                <ExternalLink className='h-4 w-4' />
              </button>

              {/* Download */}
              <button
                type='button'
                onClick={e => {
                  e.stopPropagation();
                  handleDownload();
                }}
                className='rounded p-1.5 hover:bg-muted'
                title='Download'
              >
                <Download className='h-4 w-4' />
              </button>

              {/* Share/Forward */}
              <button
                type='button'
                onClick={e => {
                  e.stopPropagation();
                  handleShare();
                }}
                className='rounded p-1.5 hover:bg-muted'
                title={copySuccess ? 'Link copied!' : 'Share file'}
              >
                <Forward className='h-4 w-4' />
              </button>

              {/* Bookmark (filled since it's in Later) - click to remove */}
              <button
                type='button'
                onClick={e => {
                  e.stopPropagation();
                  handleRemoveFromLater();
                }}
                className='rounded p-1.5 hover:bg-muted text-primary'
                title='Remove from Later'
              >
                <BookmarkCheck className='h-4 w-4 fill-current' />
              </button>

              {/* More Options Menu */}
              <div className='relative'>
                <button
                  type='button'
                  onClick={e => {
                    e.stopPropagation();
                    setShowMenu(!showMenu);
                  }}
                  className='rounded p-1.5 hover:bg-muted'
                  title='More options'
                >
                  <MoreHorizontal className='h-4 w-4' />
                </button>

                {showMenu && (
                  <>
                    <div
                      className='fixed inset-0 z-10'
                      onClick={e => {
                        e.stopPropagation();
                        setShowMenu(false);
                      }}
                    />
                    <div
                      className='absolute right-0 top-full z-20 mt-1 w-52 rounded-md border bg-popover p-1 shadow-lg'
                      onClick={e => e.stopPropagation()}
                    >
                      {/* File Actions */}
                      <button
                        type='button'
                        onClick={() => {
                          handleOpenInNewTab();
                          setShowMenu(false);
                        }}
                        className='flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent'
                      >
                        <ExternalLink className='h-4 w-4' />
                        Open in new tab
                      </button>
                      <button
                        type='button'
                        onClick={() => {
                          handleCopyLink();
                          setShowMenu(false);
                        }}
                        className='flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent'
                      >
                        <Copy className='h-4 w-4' />
                        {copySuccess ? 'Copied!' : 'Copy link'}
                      </button>
                      <button
                        type='button'
                        onClick={() => {
                          handleDownload();
                          setShowMenu(false);
                        }}
                        className='flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent'
                      >
                        <Download className='h-4 w-4' />
                        Download
                      </button>
                      <button
                        type='button'
                        onClick={() => {
                          handleShare();
                          setShowMenu(false);
                        }}
                        className='flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent'
                      >
                        <Forward className='h-4 w-4' />
                        Share file...
                      </button>
                      {/* Status Actions */}
                      {onMarkComplete && !isArchived && !isCompleted && (
                        <button
                          type='button'
                          onClick={() => {
                            onMarkComplete(item.id);
                            setShowMenu(false);
                          }}
                          className='flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent'
                        >
                          <CheckCircle2 className='h-4 w-4' />
                          Mark complete
                        </button>
                      )}
                      {onArchive && !isArchived && !isCompleted && (
                        <button
                          type='button'
                          onClick={() => {
                            onArchive(item.id);
                            setShowMenu(false);
                          }}
                          className='flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent'
                        >
                          <Archive className='h-4 w-4' />
                          Archive
                        </button>
                      )}
                      {onRestore && (isArchived || isCompleted) && (
                        <button
                          type='button'
                          onClick={() => {
                            onRestore(item.id);
                            setShowMenu(false);
                          }}
                          className='flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent'
                        >
                          <Clock className='h-4 w-4' />
                          Move to In progress
                        </button>
                      )}

                      <div className='my-1 h-px bg-border' />

                      {/* Destructive Actions */}
                      <button
                        type='button'
                        onClick={() => {
                          handleRemoveFromLater();
                          setShowMenu(false);
                        }}
                        className='flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-destructive hover:bg-accent'
                      >
                        <Trash2 className='h-4 w-4' />
                        Remove from Later
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Note */}
          {item.note && (
            <div className='mt-2 rounded bg-muted/50 px-2 py-1 text-xs text-muted-foreground'>
              Note: {item.note}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Format relative time
 */
function formatRelativeTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) {
    return 'Just now';
  }
  if (diffMins < 60) {
    return `${diffMins}m ago`;
  }
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }
  if (diffDays < 7) {
    return `${diffDays}d ago`;
  }
  if (diffDays < 30) {
    return `${Math.floor(diffDays / 7)}w ago`;
  }

  return date.toLocaleDateString();
}
