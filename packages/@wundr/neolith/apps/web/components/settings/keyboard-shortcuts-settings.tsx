/**
 * Keyboard Shortcuts Settings Component
 * @module components/settings/keyboard-shortcuts-settings
 */
'use client';

import {
  Keyboard,
  Search,
  RotateCcw,
  Download,
  Upload,
  AlertTriangle,
  Check,
  X,
  Zap,
  Edit,
  Layout,
  MessageSquare,
  Bot,
  Hash,
  Compass,
  ChevronDown,
  ChevronRight,
  Info,
} from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import {
  useKeyboardShortcuts,
  useShortcutCapture,
  useIsMac,
} from '@/hooks/use-keyboard-shortcuts';
import {
  CATEGORY_CONFIG,
  SHORTCUT_PRESETS,
  formatKeyForDisplay,
} from '@/lib/keyboard-shortcuts';
import type {
  KeyboardShortcut,
  ShortcutCategory,
} from '@/lib/keyboard-shortcuts';
import { cn } from '@/lib/utils';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

const CATEGORY_ICONS: Record<ShortcutCategory, React.ElementType> = {
  navigation: Compass,
  actions: Zap,
  editing: Edit,
  window: Layout,
  messaging: MessageSquare,
  orchestrators: Bot,
  channels: Hash,
};

export function KeyboardShortcutsSettings() {
  const { toast } = useToast();
  const isMac = useIsMac();
  const {
    shortcuts,
    updateShortcut,
    toggleShortcut,
    resetShortcut,
    resetAll,
    applyPreset,
    toggleCategory,
    conflicts,
    exportConfig,
    importConfig,
    filterByCategory,
    searchShortcuts,
  } = useKeyboardShortcuts();

  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedPreset, setSelectedPreset] = React.useState('default');
  const [showResetDialog, setShowResetDialog] = React.useState(false);
  const [showCheatSheet, setShowCheatSheet] = React.useState(false);
  const [editingShortcut, setEditingShortcut] =
    React.useState<KeyboardShortcut | null>(null);
  const [expandedCategories, setExpandedCategories] = React.useState<
    Set<string>
  >(new Set(Object.keys(CATEGORY_CONFIG)));

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Get filtered shortcuts
  const filteredShortcuts = React.useMemo(() => {
    if (searchQuery.trim()) {
      return searchShortcuts(searchQuery);
    }
    return shortcuts;
  }, [shortcuts, searchQuery, searchShortcuts]);

  // Group shortcuts by category
  const shortcutsByCategory = React.useMemo(() => {
    const grouped: Record<ShortcutCategory, KeyboardShortcut[]> = {
      navigation: [],
      actions: [],
      editing: [],
      window: [],
      messaging: [],
      orchestrators: [],
      channels: [],
    };

    filteredShortcuts.forEach(shortcut => {
      grouped[shortcut.category].push(shortcut);
    });

    return grouped;
  }, [filteredShortcuts]);

  const handleExport = () => {
    const config = exportConfig();
    const blob = new Blob([config], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `keyboard-shortcuts-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: 'Exported',
      description: 'Keyboard shortcuts configuration exported successfully',
    });
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = e => {
      const content = e.target?.result as string;
      const result = importConfig(content);

      if (result.success) {
        toast({
          title: 'Imported',
          description: 'Keyboard shortcuts configuration imported successfully',
        });
      } else {
        toast({
          title: 'Import Failed',
          description: result.error || 'Failed to import configuration',
          variant: 'destructive',
        });
      }
    };
    reader.readAsText(file);

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleApplyPreset = (presetId: string) => {
    applyPreset(presetId);
    setSelectedPreset(presetId);
    toast({
      title: 'Preset Applied',
      description: `${SHORTCUT_PRESETS.find(p => p.id === presetId)?.name} preset applied successfully`,
    });
  };

  const handleResetAll = () => {
    resetAll();
    setSelectedPreset('default');
    setShowResetDialog(false);
    toast({
      title: 'Reset Complete',
      description: 'All keyboard shortcuts have been reset to defaults',
    });
  };

  const toggleCategoryExpanded = (category: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const handleToggleCategory = (category: ShortcutCategory, enabled: boolean) => {
    toggleCategory(category, enabled);
    toast({
      title: enabled ? 'Category Enabled' : 'Category Disabled',
      description: `${CATEGORY_CONFIG[category].label} shortcuts ${enabled ? 'enabled' : 'disabled'}`,
    });
  };

  const conflictMap = React.useMemo(() => {
    const map = new Map<string, string[]>();
    conflicts.forEach(({ shortcut1, shortcut2 }) => {
      if (!map.has(shortcut1.id)) {
        map.set(shortcut1.id, []);
      }
      if (!map.has(shortcut2.id)) {
        map.set(shortcut2.id, []);
      }
      map.get(shortcut1.id)?.push(shortcut2.id);
      map.get(shortcut2.id)?.push(shortcut1.id);
    });
    return map;
  }, [conflicts]);

  return (
    <div className='space-y-6'>
      <div>
        <h2 className='text-2xl font-bold'>Keyboard Shortcuts</h2>
        <p className='text-muted-foreground'>
          Customize keyboard shortcuts to match your workflow
        </p>
      </div>

      {/* Conflicts Alert */}
      {conflicts.length > 0 && (
        <Card className='border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20'>
          <CardContent className='pt-6'>
            <div className='flex items-start gap-3'>
              <AlertTriangle className='h-5 w-5 text-amber-600 dark:text-amber-500 flex-shrink-0 mt-0.5' />
              <div className='flex-1'>
                <h4 className='font-semibold text-amber-900 dark:text-amber-100'>
                  Keyboard Shortcut Conflicts Detected
                </h4>
                <p className='text-sm text-amber-800 dark:text-amber-200 mt-1'>
                  {conflicts.length} conflict{conflicts.length > 1 ? 's' : ''}{' '}
                  found. Conflicting shortcuts are highlighted below.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <div className='flex flex-wrap gap-3'>
        <Button
          variant='outline'
          size='sm'
          onClick={() => setShowCheatSheet(true)}
          className='gap-2'
        >
          <Keyboard className='h-4 w-4' />
          Cheat Sheet
        </Button>
        <Button
          variant='outline'
          size='sm'
          onClick={handleExport}
          className='gap-2'
        >
          <Download className='h-4 w-4' />
          Export
        </Button>
        <Button
          variant='outline'
          size='sm'
          onClick={() => fileInputRef.current?.click()}
          className='gap-2'
        >
          <Upload className='h-4 w-4' />
          Import
        </Button>
        <input
          ref={fileInputRef}
          type='file'
          accept='.json'
          className='hidden'
          onChange={handleImport}
        />
        <Button
          variant='outline'
          size='sm'
          onClick={() => setShowResetDialog(true)}
          className='gap-2'
        >
          <RotateCcw className='h-4 w-4' />
          Reset All
        </Button>
      </div>

      {/* Preset Selection */}
      <Card>
        <CardHeader>
          <CardTitle className='text-lg'>Shortcut Scheme</CardTitle>
          <CardDescription>
            Choose a preset or customize individual shortcuts
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='grid gap-3 md:grid-cols-3'>
            {SHORTCUT_PRESETS.map(preset => (
              <button
                key={preset.id}
                onClick={() => handleApplyPreset(preset.id)}
                className={cn(
                  'relative rounded-lg border-2 p-4 text-left transition-all hover:bg-accent',
                  selectedPreset === preset.id
                    ? 'border-primary bg-primary/5'
                    : 'border-muted',
                )}
              >
                <div className='space-y-1'>
                  <div className='flex items-center justify-between'>
                    <h4 className='font-semibold'>{preset.name}</h4>
                    {selectedPreset === preset.id && (
                      <Check className='h-4 w-4 text-primary' />
                    )}
                  </div>
                  <p className='text-sm text-muted-foreground'>
                    {preset.description}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Search */}
      <div className='relative'>
        <Search className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground' />
        <Input
          placeholder='Search shortcuts...'
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className='pl-9'
        />
      </div>

      {/* Shortcuts by Category */}
      <div className='space-y-4'>
        {Object.entries(shortcutsByCategory).map(([category, categoryShortcuts]) => {
          if (categoryShortcuts.length === 0) {
            return null;
          }

          const config = CATEGORY_CONFIG[category as ShortcutCategory];
          const Icon = CATEGORY_ICONS[category as ShortcutCategory];
          const isExpanded = expandedCategories.has(category);
          const categoryEnabled = categoryShortcuts.some(s => s.enabled);

          return (
            <Card key={category}>
              <Collapsible
                open={isExpanded}
                onOpenChange={() => toggleCategoryExpanded(category)}
              >
                <CardHeader className='pb-3'>
                  <div className='flex items-center justify-between'>
                    <CollapsibleTrigger className='flex items-center gap-3 flex-1 text-left hover:opacity-80 transition-opacity'>
                      <Icon className='h-5 w-5 text-primary' />
                      <div className='flex-1'>
                        <CardTitle className='text-base flex items-center gap-2'>
                          {config.label}
                          <Badge variant='outline' className='ml-2'>
                            {categoryShortcuts.length}
                          </Badge>
                        </CardTitle>
                        <CardDescription className='text-sm mt-1'>
                          {config.description}
                        </CardDescription>
                      </div>
                      {isExpanded ? (
                        <ChevronDown className='h-5 w-5 text-muted-foreground' />
                      ) : (
                        <ChevronRight className='h-5 w-5 text-muted-foreground' />
                      )}
                    </CollapsibleTrigger>
                    <Switch
                      checked={categoryEnabled}
                      onCheckedChange={enabled =>
                        handleToggleCategory(category as ShortcutCategory, enabled)
                      }
                      onClick={e => e.stopPropagation()}
                      className='ml-3'
                    />
                  </div>
                </CardHeader>

                <CollapsibleContent>
                  <CardContent className='pt-0'>
                    <div className='space-y-3'>
                      {categoryShortcuts.map((shortcut, index) => (
                        <ShortcutRow
                          key={shortcut.id}
                          shortcut={shortcut}
                          isMac={isMac}
                          hasConflict={conflictMap.has(shortcut.id)}
                          onEdit={() => setEditingShortcut(shortcut)}
                          onToggle={() => toggleShortcut(shortcut.id)}
                          onReset={() => resetShortcut(shortcut.id)}
                          showDivider={index < categoryShortcuts.length - 1}
                        />
                      ))}
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          );
        })}
      </div>

      {/* Edit Shortcut Dialog */}
      <EditShortcutDialog
        shortcut={editingShortcut}
        isMac={isMac}
        onClose={() => setEditingShortcut(null)}
        onSave={(keys) => {
          if (editingShortcut) {
            updateShortcut(editingShortcut.id, keys);
            setEditingShortcut(null);
            toast({
              title: 'Shortcut Updated',
              description: `${editingShortcut.description} shortcut has been updated`,
            });
          }
        }}
      />

      {/* Reset All Dialog */}
      <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset All Shortcuts?</AlertDialogTitle>
            <AlertDialogDescription>
              This will reset all keyboard shortcuts to their default values. This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleResetAll}>
              Reset All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cheat Sheet Dialog */}
      <CheatSheetDialog
        open={showCheatSheet}
        onOpenChange={setShowCheatSheet}
        shortcuts={shortcuts.filter(s => s.enabled)}
        isMac={isMac}
      />
    </div>
  );
}

interface ShortcutRowProps {
  shortcut: KeyboardShortcut;
  isMac: boolean;
  hasConflict: boolean;
  onEdit: () => void;
  onToggle: () => void;
  onReset: () => void;
  showDivider: boolean;
}

function ShortcutRow({
  shortcut,
  isMac,
  hasConflict,
  onEdit,
  onToggle,
  onReset,
  showDivider,
}: ShortcutRowProps) {
  const isCustomized =
    JSON.stringify(shortcut.keys) !== JSON.stringify(shortcut.defaultKeys);

  return (
    <>
      <div className='flex items-center justify-between gap-4 py-2'>
        <div className='flex-1 min-w-0'>
          <div className='flex items-center gap-2'>
            <span className='text-sm font-medium'>{shortcut.description}</span>
            {shortcut.context !== 'global' && (
              <Badge variant='outline' className='text-xs'>
                {shortcut.context}
              </Badge>
            )}
            {hasConflict && (
              <Badge variant='destructive' className='text-xs gap-1'>
                <AlertTriangle className='h-3 w-3' />
                Conflict
              </Badge>
            )}
            {isCustomized && (
              <Badge variant='secondary' className='text-xs'>
                Custom
              </Badge>
            )}
          </div>
        </div>

        <div className='flex items-center gap-2'>
          <div className='flex items-center gap-1'>
            {shortcut.keys.map((key, index) => (
              <React.Fragment key={index}>
                {index > 0 && (
                  <span className='text-xs text-muted-foreground'>+</span>
                )}
                <kbd
                  className={cn(
                    'px-2 py-1 text-xs font-semibold rounded border shadow-sm min-w-[2rem] text-center',
                    hasConflict
                      ? 'bg-destructive/10 border-destructive text-destructive'
                      : 'bg-background border-border',
                    !shortcut.enabled && 'opacity-50',
                  )}
                >
                  {formatKeyForDisplay(key, isMac)}
                </kbd>
              </React.Fragment>
            ))}
          </div>

          <div className='flex items-center gap-1'>
            {shortcut.editable && (
              <Button
                variant='ghost'
                size='sm'
                onClick={onEdit}
                className='h-8 w-8 p-0'
                disabled={!shortcut.enabled}
              >
                <Edit className='h-3.5 w-3.5' />
              </Button>
            )}
            {isCustomized && (
              <Button
                variant='ghost'
                size='sm'
                onClick={onReset}
                className='h-8 w-8 p-0'
              >
                <RotateCcw className='h-3.5 w-3.5' />
              </Button>
            )}
            <Switch
              checked={shortcut.enabled}
              onCheckedChange={onToggle}
              className='ml-2'
            />
          </div>
        </div>
      </div>
      {showDivider && <Separator />}
    </>
  );
}

interface EditShortcutDialogProps {
  shortcut: KeyboardShortcut | null;
  isMac: boolean;
  onClose: () => void;
  onSave: (keys: string[]) => void;
}

function EditShortcutDialog({
  shortcut,
  isMac,
  onClose,
  onSave,
}: EditShortcutDialogProps) {
  const { isCapturing, capturedKeys, startCapture, clearCapture } =
    useShortcutCapture();

  React.useEffect(() => {
    if (!shortcut) {
      clearCapture();
    }
  }, [shortcut, clearCapture]);

  const handleSave = () => {
    if (capturedKeys.length > 0) {
      onSave(capturedKeys);
    }
  };

  return (
    <Dialog open={!!shortcut} onOpenChange={() => onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Keyboard Shortcut</DialogTitle>
          <DialogDescription>
            {shortcut?.description}
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4 py-4'>
          <div className='space-y-2'>
            <Label>Current Shortcut</Label>
            <div className='flex items-center gap-1 p-3 rounded-md bg-muted'>
              {shortcut?.keys.map((key, index) => (
                <React.Fragment key={index}>
                  {index > 0 && (
                    <span className='text-xs text-muted-foreground mx-1'>+</span>
                  )}
                  <kbd className='px-2 py-1 text-xs font-semibold rounded border bg-background shadow-sm min-w-[2rem] text-center'>
                    {formatKeyForDisplay(key, isMac)}
                  </kbd>
                </React.Fragment>
              ))}
            </div>
          </div>

          <div className='space-y-2'>
            <Label>New Shortcut</Label>
            <div
              className={cn(
                'flex items-center justify-center gap-1 p-6 rounded-md border-2 border-dashed transition-colors cursor-pointer',
                isCapturing
                  ? 'border-primary bg-primary/5'
                  : 'border-muted hover:border-primary/50',
              )}
              onClick={startCapture}
            >
              {capturedKeys.length > 0 ? (
                capturedKeys.map((key, index) => (
                  <React.Fragment key={index}>
                    {index > 0 && (
                      <span className='text-xs text-muted-foreground mx-1'>+</span>
                    )}
                    <kbd className='px-2 py-1 text-xs font-semibold rounded border bg-background shadow-sm min-w-[2rem] text-center'>
                      {formatKeyForDisplay(key, isMac)}
                    </kbd>
                  </React.Fragment>
                ))
              ) : (
                <div className='text-center text-muted-foreground'>
                  <Keyboard className='h-8 w-8 mx-auto mb-2 opacity-50' />
                  <p className='text-sm'>
                    {isCapturing
                      ? 'Press your desired key combination...'
                      : 'Click to capture new shortcut'}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className='flex items-start gap-2 p-3 rounded-md bg-blue-50 dark:bg-blue-950/20'>
            <Info className='h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5' />
            <p className='text-xs text-blue-800 dark:text-blue-200'>
              Press and hold modifier keys (Cmd, Ctrl, Alt, Shift) along with a
              regular key to create your shortcut
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant='outline' onClick={clearCapture}>
            <X className='h-4 w-4 mr-2' />
            Clear
          </Button>
          <Button onClick={handleSave} disabled={capturedKeys.length === 0}>
            <Check className='h-4 w-4 mr-2' />
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface CheatSheetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shortcuts: KeyboardShortcut[];
  isMac: boolean;
}

function CheatSheetDialog({
  open,
  onOpenChange,
  shortcuts,
  isMac,
}: CheatSheetDialogProps) {
  const shortcutsByCategory = React.useMemo(() => {
    const grouped: Record<ShortcutCategory, KeyboardShortcut[]> = {
      navigation: [],
      actions: [],
      editing: [],
      window: [],
      messaging: [],
      orchestrators: [],
      channels: [],
    };

    shortcuts.forEach(shortcut => {
      grouped[shortcut.category].push(shortcut);
    });

    return grouped;
  }, [shortcuts]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-3xl max-h-[80vh] overflow-y-auto'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <Keyboard className='h-5 w-5' />
            Keyboard Shortcuts Cheat Sheet
          </DialogTitle>
          <DialogDescription>
            Quick reference for all enabled keyboard shortcuts
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-6 mt-4'>
          {Object.entries(shortcutsByCategory).map(
            ([category, categoryShortcuts]) => {
              if (categoryShortcuts.length === 0) {
                return null;
              }

              const config = CATEGORY_CONFIG[category as ShortcutCategory];
              const Icon = CATEGORY_ICONS[category as ShortcutCategory];

              return (
                <div key={category}>
                  <div className='flex items-center gap-2 mb-3'>
                    <Icon className='h-4 w-4 text-primary' />
                    <h3 className='text-sm font-semibold'>{config.label}</h3>
                  </div>
                  <div className='space-y-2'>
                    {categoryShortcuts.map(shortcut => (
                      <div
                        key={shortcut.id}
                        className='flex items-center justify-between py-2 px-3 rounded-md hover:bg-muted/50'
                      >
                        <span className='text-sm text-muted-foreground'>
                          {shortcut.description}
                        </span>
                        <div className='flex items-center gap-1'>
                          {shortcut.keys.map((key, index) => (
                            <React.Fragment key={index}>
                              {index > 0 && (
                                <span className='text-xs text-muted-foreground mx-1'>
                                  +
                                </span>
                              )}
                              <kbd className='px-2 py-1 text-xs font-semibold bg-background border border-border rounded shadow-sm min-w-[2rem] text-center'>
                                {formatKeyForDisplay(key, isMac)}
                              </kbd>
                            </React.Fragment>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            },
          )}
        </div>

        <div className='mt-6 pt-4 border-t text-xs text-muted-foreground'>
          <p>
            Press <kbd className='px-1.5 py-0.5 bg-muted rounded'>?</kbd> anytime to
            open this cheat sheet
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
