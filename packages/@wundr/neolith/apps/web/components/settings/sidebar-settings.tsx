/**
 * Sidebar Settings Component
 * @module components/settings/sidebar-settings
 */
'use client';

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  GripVertical,
  Eye,
  EyeOff,
  Star,
  Hash,
  MessageSquare,
  Bookmark,
  RotateCcw,
  ChevronRight,
  Sidebar,
  Zap,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

import type { DragEndEvent } from '@dnd-kit/core';

interface SidebarSection {
  id: string;
  name: string;
  icon: React.ReactNode;
  visible: boolean;
  sortable: boolean;
}

interface FavoriteItem {
  id: string;
  name: string;
  type: 'channel' | 'dm';
  icon: React.ReactNode;
}

interface SidebarPreferences {
  // Section settings
  sections: SidebarSection[];

  // Channel settings
  channelSorting: 'alphabetical' | 'recent' | 'custom' | 'unread-first';
  showMutedChannels: boolean;
  groupChannelsByType: boolean;

  // DM settings
  dmSorting: 'alphabetical' | 'recent' | 'custom' | 'status-first';
  showOfflineUsers: boolean;

  // Starred items
  showStarredSection: boolean;
  starredPosition: 'top' | 'bottom';

  // Quick access/favorites
  favoriteItems: FavoriteItem[];
  showFavoritesSection: boolean;

  // Visual settings
  sidebarWidth: number;
  showUnreadBadges: boolean;
  unreadBadgeStyle: 'count' | 'dot' | 'both';

  // Collapse behavior
  collapseOnMobile: boolean;
  autoCollapseInactive: boolean;
  autoCollapseDelay: number;
  rememberCollapseState: boolean;

  // Advanced
  showUserPresence: boolean;
  compactMode: boolean;
  showSectionCounts: boolean;
}

const DEFAULT_SECTIONS: SidebarSection[] = [
  {
    id: 'starred',
    name: 'Starred',
    icon: <Star className='h-4 w-4' />,
    visible: true,
    sortable: true,
  },
  {
    id: 'channels',
    name: 'Channels',
    icon: <Hash className='h-4 w-4' />,
    visible: true,
    sortable: false,
  },
  {
    id: 'direct-messages',
    name: 'Direct Messages',
    icon: <MessageSquare className='h-4 w-4' />,
    visible: true,
    sortable: false,
  },
  {
    id: 'favorites',
    name: 'Favorites',
    icon: <Bookmark className='h-4 w-4' />,
    visible: false,
    sortable: true,
  },
  {
    id: 'threads',
    name: 'Threads',
    icon: <Zap className='h-4 w-4' />,
    visible: false,
    sortable: true,
  },
];

const DEFAULT_FAVORITES: FavoriteItem[] = [];

export function SidebarSettings() {
  const { toast } = useToast();
  const router = useRouter();
  const [mounted, setMounted] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);

  const [preferences, setPreferences] = React.useState<SidebarPreferences>({
    sections: DEFAULT_SECTIONS,
    channelSorting: 'alphabetical',
    showMutedChannels: true,
    groupChannelsByType: false,
    dmSorting: 'recent',
    showOfflineUsers: true,
    showStarredSection: true,
    starredPosition: 'top',
    favoriteItems: DEFAULT_FAVORITES,
    showFavoritesSection: false,
    sidebarWidth: 256,
    showUnreadBadges: true,
    unreadBadgeStyle: 'count',
    collapseOnMobile: true,
    autoCollapseInactive: false,
    autoCollapseDelay: 5,
    rememberCollapseState: true,
    showUserPresence: true,
    compactMode: false,
    showSectionCounts: true,
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  React.useEffect(() => {
    setMounted(true);
    const savedPreferences = localStorage.getItem('sidebar-preferences');
    if (savedPreferences) {
      try {
        setPreferences(JSON.parse(savedPreferences));
      } catch (error) {
        console.error('Failed to parse saved preferences:', error);
      }
    }
  }, []);

  const updatePreference = <K extends keyof SidebarPreferences>(
    key: K,
    value: SidebarPreferences[K]
  ) => {
    setPreferences(prev => {
      const updated = { ...prev, [key]: value };
      localStorage.setItem('sidebar-preferences', JSON.stringify(updated));
      return updated;
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = preferences.sections.findIndex(s => s.id === active.id);
      const newIndex = preferences.sections.findIndex(s => s.id === over.id);

      const newSections = arrayMove(preferences.sections, oldIndex, newIndex);
      updatePreference('sections', newSections);
    }
  };

  const toggleSectionVisibility = (sectionId: string) => {
    const updatedSections = preferences.sections.map(section =>
      section.id === sectionId
        ? { ...section, visible: !section.visible }
        : section
    );
    updatePreference('sections', updatedSections);
  };

  const handleSavePreferences = async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/users/me/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sidebar: preferences }),
      });

      if (!response.ok) {
        throw new Error('Failed to save preferences');
      }

      toast({
        title: 'Saved',
        description: 'Sidebar preferences saved successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to save preferences',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetToDefaults = () => {
    const defaults: SidebarPreferences = {
      sections: DEFAULT_SECTIONS,
      channelSorting: 'alphabetical',
      showMutedChannels: true,
      groupChannelsByType: false,
      dmSorting: 'recent',
      showOfflineUsers: true,
      showStarredSection: true,
      starredPosition: 'top',
      favoriteItems: DEFAULT_FAVORITES,
      showFavoritesSection: false,
      sidebarWidth: 256,
      showUnreadBadges: true,
      unreadBadgeStyle: 'count',
      collapseOnMobile: true,
      autoCollapseInactive: false,
      autoCollapseDelay: 5,
      rememberCollapseState: true,
      showUserPresence: true,
      compactMode: false,
      showSectionCounts: true,
    };

    setPreferences(defaults);
    localStorage.setItem('sidebar-preferences', JSON.stringify(defaults));

    toast({
      title: 'Reset Complete',
      description: 'All sidebar settings have been reset to defaults',
    });
  };

  if (!mounted) {
    return null;
  }

  return (
    <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
      {/* Settings Panel */}
      <div className='lg:col-span-2 space-y-6'>
        <div>
          <h2 className='text-2xl font-bold'>Sidebar Settings</h2>
          <p className='text-muted-foreground'>
            Customize your sidebar layout, organization, and behavior.
          </p>
        </div>

        <Tabs defaultValue='sections' className='w-full'>
          <TabsList className='grid w-full grid-cols-4'>
            <TabsTrigger value='sections'>Sections</TabsTrigger>
            <TabsTrigger value='sorting'>Sorting</TabsTrigger>
            <TabsTrigger value='display'>Display</TabsTrigger>
            <TabsTrigger value='behavior'>Behavior</TabsTrigger>
          </TabsList>

          {/* Sections Tab */}
          <TabsContent value='sections' className='space-y-4'>
            <Card>
              <CardHeader>
                <div className='flex items-center gap-2'>
                  <Sidebar className='h-5 w-5' />
                  <CardTitle>Section Visibility & Order</CardTitle>
                </div>
                <CardDescription>
                  Show or hide sections and drag to reorder them.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={preferences.sections.map(s => s.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className='space-y-2'>
                      {preferences.sections.map(section => (
                        <SortableSectionItem
                          key={section.id}
                          section={section}
                          onToggleVisibility={() =>
                            toggleSectionVisibility(section.id)
                          }
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className='flex items-center gap-2'>
                  <Bookmark className='h-5 w-5' />
                  <CardTitle>Quick Access & Favorites</CardTitle>
                </div>
                <CardDescription>
                  Manage your favorite channels and direct messages.
                </CardDescription>
              </CardHeader>
              <CardContent className='space-y-4'>
                <div className='flex items-center justify-between'>
                  <div className='space-y-0.5'>
                    <Label htmlFor='show-favorites'>
                      Show Favorites Section
                    </Label>
                    <p className='text-sm text-muted-foreground'>
                      Display a dedicated section for favorited items
                    </p>
                  </div>
                  <Switch
                    id='show-favorites'
                    checked={preferences.showFavoritesSection}
                    onCheckedChange={checked =>
                      updatePreference('showFavoritesSection', checked)
                    }
                  />
                </div>

                {preferences.showFavoritesSection && (
                  <>
                    <Separator />
                    <div className='space-y-2'>
                      <Label>Current Favorites</Label>
                      {preferences.favoriteItems.length === 0 ? (
                        <div className='rounded-lg border border-dashed px-4 py-6 text-center'>
                          <p className='text-sm text-muted-foreground'>
                            No favorites yet
                          </p>
                          <p className='mt-1 text-xs text-muted-foreground'>
                            Star channels or conversations in the sidebar to pin
                            them here
                          </p>
                        </div>
                      ) : (
                        <div className='rounded-lg border divide-y'>
                          {preferences.favoriteItems.map(item => (
                            <div
                              key={item.id}
                              className='flex items-center gap-3 p-3 hover:bg-accent/50'
                            >
                              <div className='flex items-center justify-center h-8 w-8 rounded bg-muted'>
                                {item.icon}
                              </div>
                              <span className='flex-1 text-sm font-medium'>
                                {item.name}
                              </span>
                              <span className='text-xs text-muted-foreground capitalize'>
                                {item.type}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className='flex items-center gap-2'>
                  <Star className='h-5 w-5' />
                  <CardTitle>Starred Items</CardTitle>
                </div>
                <CardDescription>
                  Configure how starred items are displayed.
                </CardDescription>
              </CardHeader>
              <CardContent className='space-y-4'>
                <div className='flex items-center justify-between'>
                  <div className='space-y-0.5'>
                    <Label htmlFor='show-starred'>Show Starred Section</Label>
                    <p className='text-sm text-muted-foreground'>
                      Display starred channels and conversations
                    </p>
                  </div>
                  <Switch
                    id='show-starred'
                    checked={preferences.showStarredSection}
                    onCheckedChange={checked =>
                      updatePreference('showStarredSection', checked)
                    }
                  />
                </div>

                {preferences.showStarredSection && (
                  <>
                    <Separator />
                    <div className='flex items-center justify-between'>
                      <div className='space-y-0.5'>
                        <Label htmlFor='starred-position'>
                          Starred Position
                        </Label>
                        <p className='text-sm text-muted-foreground'>
                          Where to show starred items
                        </p>
                      </div>
                      <Select
                        value={preferences.starredPosition}
                        onValueChange={(value: 'top' | 'bottom') =>
                          updatePreference('starredPosition', value)
                        }
                      >
                        <SelectTrigger id='starred-position' className='w-32'>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value='top'>Top</SelectItem>
                          <SelectItem value='bottom'>Bottom</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Sorting Tab */}
          <TabsContent value='sorting' className='space-y-4'>
            <Card>
              <CardHeader>
                <div className='flex items-center gap-2'>
                  <Hash className='h-5 w-5' />
                  <CardTitle>Channel Sorting</CardTitle>
                </div>
                <CardDescription>
                  Choose how channels are ordered in the sidebar.
                </CardDescription>
              </CardHeader>
              <CardContent className='space-y-4'>
                <div className='flex items-center justify-between'>
                  <div className='space-y-0.5'>
                    <Label htmlFor='channel-sorting'>Sort Channels By</Label>
                    <p className='text-sm text-muted-foreground'>
                      Default ordering for channel list
                    </p>
                  </div>
                  <Select
                    value={preferences.channelSorting}
                    onValueChange={(value: typeof preferences.channelSorting) =>
                      updatePreference('channelSorting', value)
                    }
                  >
                    <SelectTrigger id='channel-sorting' className='w-40'>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='alphabetical'>Alphabetical</SelectItem>
                      <SelectItem value='recent'>Recent Activity</SelectItem>
                      <SelectItem value='unread-first'>Unread First</SelectItem>
                      <SelectItem value='custom'>Custom Order</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                <div className='flex items-center justify-between'>
                  <div className='space-y-0.5'>
                    <Label htmlFor='show-muted'>Show Muted Channels</Label>
                    <p className='text-sm text-muted-foreground'>
                      Display channels you have muted
                    </p>
                  </div>
                  <Switch
                    id='show-muted'
                    checked={preferences.showMutedChannels}
                    onCheckedChange={checked =>
                      updatePreference('showMutedChannels', checked)
                    }
                  />
                </div>

                <div className='flex items-center justify-between'>
                  <div className='space-y-0.5'>
                    <Label htmlFor='group-channels'>Group by Type</Label>
                    <p className='text-sm text-muted-foreground'>
                      Separate public and private channels
                    </p>
                  </div>
                  <Switch
                    id='group-channels'
                    checked={preferences.groupChannelsByType}
                    onCheckedChange={checked =>
                      updatePreference('groupChannelsByType', checked)
                    }
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className='flex items-center gap-2'>
                  <MessageSquare className='h-5 w-5' />
                  <CardTitle>Direct Message Sorting</CardTitle>
                </div>
                <CardDescription>
                  Choose how DMs are ordered in the sidebar.
                </CardDescription>
              </CardHeader>
              <CardContent className='space-y-4'>
                <div className='flex items-center justify-between'>
                  <div className='space-y-0.5'>
                    <Label htmlFor='dm-sorting'>Sort DMs By</Label>
                    <p className='text-sm text-muted-foreground'>
                      Default ordering for direct messages
                    </p>
                  </div>
                  <Select
                    value={preferences.dmSorting}
                    onValueChange={(value: typeof preferences.dmSorting) =>
                      updatePreference('dmSorting', value)
                    }
                  >
                    <SelectTrigger id='dm-sorting' className='w-40'>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='alphabetical'>Alphabetical</SelectItem>
                      <SelectItem value='recent'>Recent Activity</SelectItem>
                      <SelectItem value='status-first'>Online First</SelectItem>
                      <SelectItem value='custom'>Custom Order</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                <div className='flex items-center justify-between'>
                  <div className='space-y-0.5'>
                    <Label htmlFor='show-offline'>Show Offline Users</Label>
                    <p className='text-sm text-muted-foreground'>
                      Display DMs with offline users
                    </p>
                  </div>
                  <Switch
                    id='show-offline'
                    checked={preferences.showOfflineUsers}
                    onCheckedChange={checked =>
                      updatePreference('showOfflineUsers', checked)
                    }
                  />
                </div>

                <div className='flex items-center justify-between'>
                  <div className='space-y-0.5'>
                    <Label htmlFor='show-presence'>Show User Presence</Label>
                    <p className='text-sm text-muted-foreground'>
                      Display online status indicators
                    </p>
                  </div>
                  <Switch
                    id='show-presence'
                    checked={preferences.showUserPresence}
                    onCheckedChange={checked =>
                      updatePreference('showUserPresence', checked)
                    }
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Display Tab */}
          <TabsContent value='display' className='space-y-4'>
            <Card>
              <CardHeader>
                <div className='flex items-center gap-2'>
                  <Eye className='h-5 w-5' />
                  <CardTitle>Visual Settings</CardTitle>
                </div>
                <CardDescription>
                  Customize the appearance of your sidebar.
                </CardDescription>
              </CardHeader>
              <CardContent className='space-y-6'>
                <div className='space-y-3'>
                  <div className='flex items-center justify-between'>
                    <Label htmlFor='sidebar-width'>Sidebar Width</Label>
                    <span className='text-sm text-muted-foreground'>
                      {preferences.sidebarWidth}px
                    </span>
                  </div>
                  <Slider
                    id='sidebar-width'
                    min={200}
                    max={400}
                    step={8}
                    value={[preferences.sidebarWidth]}
                    onValueChange={([value]) =>
                      updatePreference('sidebarWidth', value)
                    }
                    className='w-full'
                  />
                  <p className='text-xs text-muted-foreground'>
                    Adjust the width of the sidebar (200-400px)
                  </p>
                </div>

                <Separator />

                <div className='flex items-center justify-between'>
                  <div className='space-y-0.5'>
                    <Label htmlFor='compact-mode'>Compact Mode</Label>
                    <p className='text-sm text-muted-foreground'>
                      Use smaller spacing and fonts
                    </p>
                  </div>
                  <Switch
                    id='compact-mode'
                    checked={preferences.compactMode}
                    onCheckedChange={checked =>
                      updatePreference('compactMode', checked)
                    }
                  />
                </div>

                <div className='flex items-center justify-between'>
                  <div className='space-y-0.5'>
                    <Label htmlFor='show-badges'>Show Unread Badges</Label>
                    <p className='text-sm text-muted-foreground'>
                      Display unread message indicators
                    </p>
                  </div>
                  <Switch
                    id='show-badges'
                    checked={preferences.showUnreadBadges}
                    onCheckedChange={checked =>
                      updatePreference('showUnreadBadges', checked)
                    }
                  />
                </div>

                {preferences.showUnreadBadges && (
                  <>
                    <div className='flex items-center justify-between'>
                      <div className='space-y-0.5'>
                        <Label htmlFor='badge-style'>Badge Style</Label>
                        <p className='text-sm text-muted-foreground'>
                          How to display unread indicators
                        </p>
                      </div>
                      <Select
                        value={preferences.unreadBadgeStyle}
                        onValueChange={(
                          value: typeof preferences.unreadBadgeStyle
                        ) => updatePreference('unreadBadgeStyle', value)}
                      >
                        <SelectTrigger id='badge-style' className='w-32'>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value='count'>Count</SelectItem>
                          <SelectItem value='dot'>Dot</SelectItem>
                          <SelectItem value='both'>Both</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}

                <Separator />

                <div className='flex items-center justify-between'>
                  <div className='space-y-0.5'>
                    <Label htmlFor='section-counts'>Show Section Counts</Label>
                    <p className='text-sm text-muted-foreground'>
                      Display item counts next to section headers
                    </p>
                  </div>
                  <Switch
                    id='section-counts'
                    checked={preferences.showSectionCounts}
                    onCheckedChange={checked =>
                      updatePreference('showSectionCounts', checked)
                    }
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Behavior Tab */}
          <TabsContent value='behavior' className='space-y-4'>
            <Card>
              <CardHeader>
                <div className='flex items-center gap-2'>
                  <ChevronRight className='h-5 w-5' />
                  <CardTitle>Collapse Behavior</CardTitle>
                </div>
                <CardDescription>
                  Control how the sidebar collapses and expands.
                </CardDescription>
              </CardHeader>
              <CardContent className='space-y-4'>
                <div className='flex items-center justify-between'>
                  <div className='space-y-0.5'>
                    <Label htmlFor='collapse-mobile'>Collapse on Mobile</Label>
                    <p className='text-sm text-muted-foreground'>
                      Automatically collapse sidebar on small screens
                    </p>
                  </div>
                  <Switch
                    id='collapse-mobile'
                    checked={preferences.collapseOnMobile}
                    onCheckedChange={checked =>
                      updatePreference('collapseOnMobile', checked)
                    }
                  />
                </div>

                <Separator />

                <div className='flex items-center justify-between'>
                  <div className='space-y-0.5'>
                    <Label htmlFor='auto-collapse'>
                      Auto-collapse When Inactive
                    </Label>
                    <p className='text-sm text-muted-foreground'>
                      Collapse sidebar after period of inactivity
                    </p>
                  </div>
                  <Switch
                    id='auto-collapse'
                    checked={preferences.autoCollapseInactive}
                    onCheckedChange={checked =>
                      updatePreference('autoCollapseInactive', checked)
                    }
                  />
                </div>

                {preferences.autoCollapseInactive && (
                  <div className='space-y-3 pl-4 border-l-2 border-muted'>
                    <div className='flex items-center justify-between'>
                      <Label htmlFor='collapse-delay'>Inactivity Delay</Label>
                      <span className='text-sm text-muted-foreground'>
                        {preferences.autoCollapseDelay} minutes
                      </span>
                    </div>
                    <Slider
                      id='collapse-delay'
                      min={1}
                      max={30}
                      step={1}
                      value={[preferences.autoCollapseDelay]}
                      onValueChange={([value]) =>
                        updatePreference('autoCollapseDelay', value)
                      }
                      className='w-full'
                    />
                  </div>
                )}

                <Separator />

                <div className='flex items-center justify-between'>
                  <div className='space-y-0.5'>
                    <Label htmlFor='remember-state'>
                      Remember Collapse State
                    </Label>
                    <p className='text-sm text-muted-foreground'>
                      Restore sidebar state on page reload
                    </p>
                  </div>
                  <Switch
                    id='remember-state'
                    checked={preferences.rememberCollapseState}
                    onCheckedChange={checked =>
                      updatePreference('rememberCollapseState', checked)
                    }
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className='flex items-center gap-2'>
                  <RotateCcw className='h-5 w-5' />
                  <CardTitle>Reset Settings</CardTitle>
                </div>
                <CardDescription>
                  Restore all sidebar settings to their default values.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  variant='outline'
                  onClick={handleResetToDefaults}
                  className='w-full gap-2'
                >
                  <RotateCcw className='h-4 w-4' />
                  Reset to Defaults
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Save Button */}
        <div className='flex justify-end gap-3'>
          <Button variant='outline' onClick={() => router.back()}>
            Cancel
          </Button>
          <Button onClick={handleSavePreferences} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save All Changes'}
          </Button>
        </div>
      </div>

      {/* Preview Panel */}
      <div className='lg:col-span-1'>
        <div className='sticky top-6'>
          <Card>
            <CardHeader>
              <div className='flex items-center gap-2'>
                <Eye className='h-5 w-5' />
                <CardTitle>Live Preview</CardTitle>
              </div>
              <CardDescription>See how your sidebar will look</CardDescription>
            </CardHeader>
            <CardContent>
              <SidebarPreview preferences={preferences} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

interface SortableSectionItemProps {
  section: SidebarSection;
  onToggleVisibility: () => void;
}

function SortableSectionItem({
  section,
  onToggleVisibility,
}: SortableSectionItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id, disabled: !section.sortable });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-3 p-3 rounded-lg border bg-card',
        isDragging && 'opacity-50 cursor-grabbing',
        !section.sortable && 'opacity-75'
      )}
    >
      {section.sortable && (
        <button
          type='button'
          className='cursor-grab active:cursor-grabbing touch-none'
          {...attributes}
          {...listeners}
        >
          <GripVertical className='h-5 w-5 text-muted-foreground' />
        </button>
      )}
      <div className='flex items-center gap-2 flex-1'>
        <div className='flex items-center justify-center h-8 w-8 rounded bg-muted'>
          {section.icon}
        </div>
        <span className='font-medium'>{section.name}</span>
      </div>
      <button
        type='button'
        onClick={onToggleVisibility}
        className={cn(
          'p-2 rounded-md transition-colors',
          section.visible
            ? 'text-foreground hover:bg-muted'
            : 'text-muted-foreground hover:bg-muted'
        )}
        title={section.visible ? 'Hide section' : 'Show section'}
      >
        {section.visible ? (
          <Eye className='h-4 w-4' />
        ) : (
          <EyeOff className='h-4 w-4' />
        )}
      </button>
    </div>
  );
}

interface SidebarPreviewProps {
  preferences: SidebarPreferences;
}

function SidebarPreview({ preferences }: SidebarPreviewProps) {
  const visibleSections = preferences.sections.filter(s => s.visible);

  return (
    <div className='space-y-4'>
      {/* Dimensions */}
      <div className='text-center p-3 rounded-lg bg-muted'>
        <p className='text-xs text-muted-foreground mb-1'>Sidebar Width</p>
        <p className='font-semibold'>{preferences.sidebarWidth}px</p>
      </div>

      {/* Sidebar Mock */}
      <div
        className={cn(
          'rounded-lg border bg-background overflow-hidden',
          preferences.compactMode ? 'p-2' : 'p-3'
        )}
        style={{ minHeight: '400px' }}
      >
        {/* Header */}
        <div
          className={cn(
            'flex items-center gap-2 mb-4',
            preferences.compactMode ? 'mb-2' : 'mb-4'
          )}
        >
          <div className='h-8 w-8 rounded-lg bg-primary' />
          <div className='flex-1'>
            <div className='h-3 w-24 rounded bg-foreground mb-1' />
            <div className='h-2 w-16 rounded bg-muted-foreground/50' />
          </div>
        </div>

        <Separator className='my-3' />

        {/* Sections */}
        <div className='space-y-3'>
          {visibleSections.map((section, index) => (
            <div key={section.id}>
              {/* Section Header */}
              <div
                className={cn(
                  'flex items-center gap-2 mb-2',
                  preferences.compactMode ? 'text-xs' : 'text-sm'
                )}
              >
                <ChevronRight className='h-3 w-3 text-muted-foreground' />
                <span className='font-semibold text-muted-foreground uppercase tracking-wider'>
                  {section.name}
                </span>
                {preferences.showSectionCounts && (
                  <span className='ml-auto text-xs text-muted-foreground'>
                    {section.id === 'channels'
                      ? 12
                      : section.id === 'direct-messages'
                        ? 8
                        : 3}
                  </span>
                )}
              </div>

              {/* Section Items */}
              <div
                className={cn(
                  'space-y-1',
                  preferences.compactMode && 'space-y-0.5'
                )}
              >
                {[1, 2, 3].slice(0, section.id === 'starred' ? 2 : 3).map(i => (
                  <div
                    key={i}
                    className={cn(
                      'flex items-center gap-2 rounded px-2 py-1.5 bg-muted/50',
                      preferences.compactMode && 'py-1'
                    )}
                  >
                    <div className='h-1 w-1 rounded-full bg-muted-foreground/50' />
                    <div
                      className={cn(
                        'h-2 flex-1 rounded bg-muted-foreground/30',
                        i === 1 ? 'w-20' : i === 2 ? 'w-24' : 'w-16'
                      )}
                    />
                    {preferences.showUnreadBadges && i === 1 && (
                      <div
                        className={cn(
                          'flex items-center justify-center rounded-full bg-primary',
                          preferences.unreadBadgeStyle === 'dot'
                            ? 'h-2 w-2'
                            : 'h-4 min-w-4 px-1'
                        )}
                      >
                        {preferences.unreadBadgeStyle !== 'dot' && (
                          <span className='text-[8px] text-primary-foreground font-medium'>
                            5
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {index < visibleSections.length - 1 && (
                <Separator className='my-3' />
              )}
            </div>
          ))}
        </div>

        {/* User Section */}
        <div className='mt-auto pt-4'>
          <Separator className='mb-3' />
          <div
            className={cn(
              'flex items-center gap-2 p-2 rounded bg-muted/50',
              preferences.compactMode && 'p-1.5'
            )}
          >
            <div className='relative'>
              <div className='h-8 w-8 rounded-full bg-primary' />
              {preferences.showUserPresence && (
                <div className='absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-background' />
              )}
            </div>
            <div className='flex-1'>
              <div className='h-2 w-16 rounded bg-foreground mb-1' />
              <div className='h-1.5 w-20 rounded bg-muted-foreground/50' />
            </div>
          </div>
        </div>
      </div>

      {/* Settings Summary */}
      <div className='space-y-2 text-xs'>
        <div className='flex justify-between'>
          <span className='text-muted-foreground'>Visible Sections:</span>
          <span className='font-medium'>{visibleSections.length}</span>
        </div>
        <div className='flex justify-between'>
          <span className='text-muted-foreground'>Channel Sort:</span>
          <span className='capitalize'>{preferences.channelSorting}</span>
        </div>
        <div className='flex justify-between'>
          <span className='text-muted-foreground'>DM Sort:</span>
          <span className='capitalize'>{preferences.dmSorting}</span>
        </div>
        <div className='flex justify-between'>
          <span className='text-muted-foreground'>Compact Mode:</span>
          <span>{preferences.compactMode ? 'On' : 'Off'}</span>
        </div>
        {preferences.autoCollapseInactive && (
          <div className='flex justify-between text-primary'>
            <span>Auto-collapse:</span>
            <span className='font-semibold'>
              {preferences.autoCollapseDelay}m
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
