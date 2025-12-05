/**
 * Message Settings Component
 * @module components/settings/message-settings
 */
'use client';

import {
  MessageSquare,
  Send,
  Smile,
  Link,
  Image,
  FileText,
  MessageCircle,
  ThumbsUp,
  Clock,
  Quote,
  RotateCcw,
  Eye,
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

/**
 * Message formatting modes
 */
type FormattingMode = 'markdown' | 'plain' | 'rich';

/**
 * Quoted reply format options
 */
type QuotedReplyFormat = 'inline' | 'reference' | 'full';

/**
 * Link preview options
 */
type LinkPreviewMode = 'always' | 'hover' | 'manual' | 'never';

/**
 * Reaction display styles
 */
type ReactionDisplayStyle = 'compact' | 'comfortable' | 'detailed';

/**
 * Message preferences interface
 */
interface MessagePreferences {
  // Message Input
  messagePreviewLength: number; // 50-500 characters
  enterToSend: boolean;
  shiftEnterForNewLine: boolean;

  // Emoji and Formatting
  emojiAutoConvert: boolean;
  enableMarkdown: boolean;
  defaultFormattingMode: FormattingMode;

  // Link and Media
  linkPreviewMode: LinkPreviewMode;
  autoExpandImages: boolean;
  autoExpandVideos: boolean;
  loadLinksInBackground: boolean;

  // Message Display
  messageGroupingThreshold: number; // 1-10 minutes
  showMessageSeparators: boolean;
  compactMode: boolean;

  // Thread Display
  threadCollapseDefault: boolean;
  threadPreviewLines: number; // 1-5
  showThreadIndicators: boolean;

  // Reactions
  reactionDisplayStyle: ReactionDisplayStyle;
  showReactionTooltips: boolean;
  quickReactionsEnabled: boolean;

  // Quoted Replies
  quotedReplyFormat: QuotedReplyFormat;
  includeOriginalAttachments: boolean;
  highlightQuotedText: boolean;
}

/**
 * Emoji mappings for auto-convert
 */
const EMOJI_SHORTCUTS: Record<string, string> = {
  ':)': '🙂',
  ':-)': '🙂',
  ':D': '😄',
  ':-D': '😄',
  ':(': '😞',
  ':-(': '😞',
  ';)': '😉',
  ';-)': '😉',
  ':P': '😛',
  ':-P': '😛',
  ':O': '😮',
  ':-O': '😮',
  '<3': '❤️',
  '</3': '💔',
  ':+1:': '👍',
  ':-1:': '👎',
  ':fire:': '🔥',
  ':rocket:': '🚀',
  ':eyes:': '👀',
  ':tada:': '🎉',
};

export function MessageSettings() {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = React.useState(false);

  const [preferences, setPreferences] = React.useState<MessagePreferences>({
    messagePreviewLength: 150,
    enterToSend: true,
    shiftEnterForNewLine: true,
    emojiAutoConvert: true,
    enableMarkdown: true,
    defaultFormattingMode: 'markdown',
    linkPreviewMode: 'always',
    autoExpandImages: true,
    autoExpandVideos: false,
    loadLinksInBackground: true,
    messageGroupingThreshold: 5,
    showMessageSeparators: true,
    compactMode: false,
    threadCollapseDefault: false,
    threadPreviewLines: 2,
    showThreadIndicators: true,
    reactionDisplayStyle: 'comfortable',
    showReactionTooltips: true,
    quickReactionsEnabled: true,
    quotedReplyFormat: 'inline',
    includeOriginalAttachments: false,
    highlightQuotedText: true,
  });

  React.useEffect(() => {
    // Load saved preferences from localStorage or API
    const savedPreferences = localStorage.getItem('message-preferences');
    if (savedPreferences) {
      try {
        setPreferences(JSON.parse(savedPreferences));
      } catch (error) {
        console.error('Failed to parse saved preferences:', error);
      }
    }
  }, []);

  const updatePreference = <K extends keyof MessagePreferences>(
    key: K,
    value: MessagePreferences[K]
  ) => {
    setPreferences(prev => {
      const updated = { ...prev, [key]: value };
      // Save to localStorage
      localStorage.setItem('message-preferences', JSON.stringify(updated));
      return updated;
    });
  };

  const handleSavePreferences = async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/users/me/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: preferences }),
      });

      if (!response.ok) {
        throw new Error('Failed to save preferences');
      }

      toast({
        title: 'Saved',
        description: 'Message preferences saved successfully',
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
    const defaults: MessagePreferences = {
      messagePreviewLength: 150,
      enterToSend: true,
      shiftEnterForNewLine: true,
      emojiAutoConvert: true,
      enableMarkdown: true,
      defaultFormattingMode: 'markdown',
      linkPreviewMode: 'always',
      autoExpandImages: true,
      autoExpandVideos: false,
      loadLinksInBackground: true,
      messageGroupingThreshold: 5,
      showMessageSeparators: true,
      compactMode: false,
      threadCollapseDefault: false,
      threadPreviewLines: 2,
      showThreadIndicators: true,
      reactionDisplayStyle: 'comfortable',
      showReactionTooltips: true,
      quickReactionsEnabled: true,
      quotedReplyFormat: 'inline',
      includeOriginalAttachments: false,
      highlightQuotedText: true,
    };

    setPreferences(defaults);
    localStorage.setItem('message-preferences', JSON.stringify(defaults));

    toast({
      title: 'Reset Complete',
      description: 'All message settings have been reset to defaults',
    });
  };

  return (
    <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
      {/* Settings Panel */}
      <div className='lg:col-span-2 space-y-6'>
        <div>
          <h2 className='text-2xl font-bold'>Messages & Chat</h2>
          <p className='text-muted-foreground'>
            Customize how messages are displayed and how you interact with them.
          </p>
        </div>

        <Tabs defaultValue='input' className='w-full'>
          <TabsList className='grid w-full grid-cols-4'>
            <TabsTrigger value='input'>Input</TabsTrigger>
            <TabsTrigger value='display'>Display</TabsTrigger>
            <TabsTrigger value='media'>Media</TabsTrigger>
            <TabsTrigger value='interactions'>Interactions</TabsTrigger>
          </TabsList>

          {/* Input Tab */}
          <TabsContent value='input' className='space-y-4'>
            {/* Message Preview Length */}
            <Card>
              <CardHeader>
                <div className='flex items-center gap-2'>
                  <Eye className='h-5 w-5' />
                  <CardTitle>Message Preview</CardTitle>
                </div>
                <CardDescription>
                  Control how much of a message is shown in previews and
                  notifications.
                </CardDescription>
              </CardHeader>
              <CardContent className='space-y-4'>
                <div className='space-y-3'>
                  <div className='flex items-center justify-between'>
                    <Label htmlFor='preview-length'>
                      Preview Length ({preferences.messagePreviewLength}{' '}
                      characters)
                    </Label>
                    <span className='text-sm text-muted-foreground'>
                      {preferences.messagePreviewLength < 100
                        ? 'Short'
                        : preferences.messagePreviewLength < 250
                          ? 'Medium'
                          : 'Long'}
                    </span>
                  </div>
                  <Slider
                    id='preview-length'
                    min={50}
                    max={500}
                    step={10}
                    value={[preferences.messagePreviewLength]}
                    onValueChange={([value]) =>
                      updatePreference('messagePreviewLength', value)
                    }
                    className='w-full'
                  />
                  <p className='text-xs text-muted-foreground'>
                    Preview: &quot;
                    {sampleMessage.slice(0, preferences.messagePreviewLength)}
                    {sampleMessage.length > preferences.messagePreviewLength
                      ? '...'
                      : ''}
                    &quot;
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Send Behavior */}
            <Card>
              <CardHeader>
                <div className='flex items-center gap-2'>
                  <Send className='h-5 w-5' />
                  <CardTitle>Send Behavior</CardTitle>
                </div>
                <CardDescription>
                  Configure keyboard shortcuts for sending messages.
                </CardDescription>
              </CardHeader>
              <CardContent className='space-y-4'>
                <div className='flex items-center justify-between'>
                  <div className='space-y-0.5'>
                    <Label htmlFor='enter-to-send'>Enter to Send</Label>
                    <p className='text-sm text-muted-foreground'>
                      Press Enter to send message immediately
                    </p>
                  </div>
                  <Switch
                    id='enter-to-send'
                    checked={preferences.enterToSend}
                    onCheckedChange={checked =>
                      updatePreference('enterToSend', checked)
                    }
                  />
                </div>

                <Separator />

                <div className='flex items-center justify-between'>
                  <div className='space-y-0.5'>
                    <Label htmlFor='shift-enter'>
                      Shift+Enter for New Line
                    </Label>
                    <p className='text-sm text-muted-foreground'>
                      Use Shift+Enter to add line breaks
                    </p>
                  </div>
                  <Switch
                    id='shift-enter'
                    checked={preferences.shiftEnterForNewLine}
                    onCheckedChange={checked =>
                      updatePreference('shiftEnterForNewLine', checked)
                    }
                  />
                </div>

                <div className='rounded-lg bg-muted p-3 text-sm'>
                  <div className='font-medium mb-2'>Current Shortcuts:</div>
                  <ul className='space-y-1 text-muted-foreground'>
                    <li>
                      •{' '}
                      <kbd className='px-1.5 py-0.5 bg-background rounded text-xs'>
                        Enter
                      </kbd>
                      : {preferences.enterToSend ? 'Send message' : 'New line'}
                    </li>
                    <li>
                      •{' '}
                      <kbd className='px-1.5 py-0.5 bg-background rounded text-xs'>
                        Shift
                      </kbd>{' '}
                      +{' '}
                      <kbd className='px-1.5 py-0.5 bg-background rounded text-xs'>
                        Enter
                      </kbd>
                      :{' '}
                      {preferences.shiftEnterForNewLine
                        ? 'New line'
                        : 'Send message'}
                    </li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            {/* Emoji and Formatting */}
            <Card>
              <CardHeader>
                <div className='flex items-center gap-2'>
                  <Smile className='h-5 w-5' />
                  <CardTitle>Emoji & Formatting</CardTitle>
                </div>
                <CardDescription>
                  Enable automatic emoji conversion and text formatting.
                </CardDescription>
              </CardHeader>
              <CardContent className='space-y-4'>
                <div className='flex items-center justify-between'>
                  <div className='space-y-0.5'>
                    <Label htmlFor='emoji-convert'>
                      Auto-Convert Emoji Shortcuts
                    </Label>
                    <p className='text-sm text-muted-foreground'>
                      Convert text like :) to 🙂 automatically
                    </p>
                  </div>
                  <Switch
                    id='emoji-convert'
                    checked={preferences.emojiAutoConvert}
                    onCheckedChange={checked =>
                      updatePreference('emojiAutoConvert', checked)
                    }
                  />
                </div>

                {preferences.emojiAutoConvert && (
                  <div className='rounded-lg bg-muted p-3 text-sm space-y-2'>
                    <div className='font-medium'>Common Shortcuts:</div>
                    <div className='grid grid-cols-2 gap-2 text-xs text-muted-foreground'>
                      {Object.entries(EMOJI_SHORTCUTS)
                        .slice(0, 8)
                        .map(([shortcut, emoji]) => (
                          <div
                            key={shortcut}
                            className='flex items-center gap-2'
                          >
                            <code className='px-1.5 py-0.5 bg-background rounded'>
                              {shortcut}
                            </code>
                            <span>→</span>
                            <span className='text-base'>{emoji}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                <Separator />

                <div className='flex items-center justify-between'>
                  <div className='space-y-0.5'>
                    <Label htmlFor='enable-markdown'>Enable Markdown</Label>
                    <p className='text-sm text-muted-foreground'>
                      Use **bold**, _italic_, and `code` in messages
                    </p>
                  </div>
                  <Switch
                    id='enable-markdown'
                    checked={preferences.enableMarkdown}
                    onCheckedChange={checked =>
                      updatePreference('enableMarkdown', checked)
                    }
                  />
                </div>

                <div className='flex items-center justify-between'>
                  <div className='space-y-0.5'>
                    <Label htmlFor='formatting-mode'>Default Formatting</Label>
                    <p className='text-sm text-muted-foreground'>
                      Choose default message formatting mode
                    </p>
                  </div>
                  <Select
                    value={preferences.defaultFormattingMode}
                    onValueChange={(value: FormattingMode) =>
                      updatePreference('defaultFormattingMode', value)
                    }
                  >
                    <SelectTrigger id='formatting-mode' className='w-32'>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='plain'>Plain Text</SelectItem>
                      <SelectItem value='markdown'>Markdown</SelectItem>
                      <SelectItem value='rich'>Rich Text</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Display Tab */}
          <TabsContent value='display' className='space-y-4'>
            {/* Message Grouping */}
            <Card>
              <CardHeader>
                <div className='flex items-center gap-2'>
                  <Clock className='h-5 w-5' />
                  <CardTitle>Message Grouping</CardTitle>
                </div>
                <CardDescription>
                  Control how messages from the same user are grouped together.
                </CardDescription>
              </CardHeader>
              <CardContent className='space-y-4'>
                <div className='space-y-3'>
                  <div className='flex items-center justify-between'>
                    <Label htmlFor='grouping-threshold'>
                      Group messages within (
                      {preferences.messageGroupingThreshold} minutes)
                    </Label>
                    <span className='text-sm text-muted-foreground'>
                      {preferences.messageGroupingThreshold} min
                    </span>
                  </div>
                  <Slider
                    id='grouping-threshold'
                    min={1}
                    max={10}
                    step={1}
                    value={[preferences.messageGroupingThreshold]}
                    onValueChange={([value]) =>
                      updatePreference('messageGroupingThreshold', value)
                    }
                    className='w-full'
                  />
                  <p className='text-xs text-muted-foreground'>
                    Messages from the same user within this time frame will be
                    grouped together
                  </p>
                </div>

                <Separator />

                <div className='flex items-center justify-between'>
                  <div className='space-y-0.5'>
                    <Label htmlFor='message-separators'>
                      Show Message Separators
                    </Label>
                    <p className='text-sm text-muted-foreground'>
                      Display separators between message groups
                    </p>
                  </div>
                  <Switch
                    id='message-separators'
                    checked={preferences.showMessageSeparators}
                    onCheckedChange={checked =>
                      updatePreference('showMessageSeparators', checked)
                    }
                  />
                </div>

                <div className='flex items-center justify-between'>
                  <div className='space-y-0.5'>
                    <Label htmlFor='compact-mode'>Compact Mode</Label>
                    <p className='text-sm text-muted-foreground'>
                      Reduce spacing between messages
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
              </CardContent>
            </Card>

            {/* Thread Display */}
            <Card>
              <CardHeader>
                <div className='flex items-center gap-2'>
                  <MessageCircle className='h-5 w-5' />
                  <CardTitle>Thread Display</CardTitle>
                </div>
                <CardDescription>
                  Configure how message threads are displayed.
                </CardDescription>
              </CardHeader>
              <CardContent className='space-y-4'>
                <div className='flex items-center justify-between'>
                  <div className='space-y-0.5'>
                    <Label htmlFor='collapse-threads'>
                      Collapse Threads by Default
                    </Label>
                    <p className='text-sm text-muted-foreground'>
                      Show only thread summary instead of full replies
                    </p>
                  </div>
                  <Switch
                    id='collapse-threads'
                    checked={preferences.threadCollapseDefault}
                    onCheckedChange={checked =>
                      updatePreference('threadCollapseDefault', checked)
                    }
                  />
                </div>

                <Separator />

                <div className='space-y-3'>
                  <div className='flex items-center justify-between'>
                    <Label htmlFor='thread-preview'>
                      Thread Preview Lines ({preferences.threadPreviewLines})
                    </Label>
                    <span className='text-sm text-muted-foreground'>
                      {preferences.threadPreviewLines}{' '}
                      {preferences.threadPreviewLines === 1 ? 'line' : 'lines'}
                    </span>
                  </div>
                  <Slider
                    id='thread-preview'
                    min={1}
                    max={5}
                    step={1}
                    value={[preferences.threadPreviewLines]}
                    onValueChange={([value]) =>
                      updatePreference('threadPreviewLines', value)
                    }
                    className='w-full'
                  />
                  <p className='text-xs text-muted-foreground'>
                    Number of reply lines shown in collapsed thread preview
                  </p>
                </div>

                <Separator />

                <div className='flex items-center justify-between'>
                  <div className='space-y-0.5'>
                    <Label htmlFor='thread-indicators'>
                      Show Thread Indicators
                    </Label>
                    <p className='text-sm text-muted-foreground'>
                      Display visual indicators for threaded replies
                    </p>
                  </div>
                  <Switch
                    id='thread-indicators'
                    checked={preferences.showThreadIndicators}
                    onCheckedChange={checked =>
                      updatePreference('showThreadIndicators', checked)
                    }
                  />
                </div>
              </CardContent>
            </Card>

            {/* Quoted Replies */}
            <Card>
              <CardHeader>
                <div className='flex items-center gap-2'>
                  <Quote className='h-5 w-5' />
                  <CardTitle>Quoted Replies</CardTitle>
                </div>
                <CardDescription>
                  Customize how quoted messages appear in replies.
                </CardDescription>
              </CardHeader>
              <CardContent className='space-y-4'>
                <div className='flex items-center justify-between'>
                  <div className='space-y-0.5'>
                    <Label htmlFor='quoted-format'>Quote Format</Label>
                    <p className='text-sm text-muted-foreground'>
                      How quoted messages are displayed
                    </p>
                  </div>
                  <Select
                    value={preferences.quotedReplyFormat}
                    onValueChange={(value: QuotedReplyFormat) =>
                      updatePreference('quotedReplyFormat', value)
                    }
                  >
                    <SelectTrigger id='quoted-format' className='w-32'>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='inline'>Inline</SelectItem>
                      <SelectItem value='reference'>Reference</SelectItem>
                      <SelectItem value='full'>Full Quote</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                <div className='flex items-center justify-between'>
                  <div className='space-y-0.5'>
                    <Label htmlFor='include-attachments'>
                      Include Original Attachments
                    </Label>
                    <p className='text-sm text-muted-foreground'>
                      Show attachments from quoted messages
                    </p>
                  </div>
                  <Switch
                    id='include-attachments'
                    checked={preferences.includeOriginalAttachments}
                    onCheckedChange={checked =>
                      updatePreference('includeOriginalAttachments', checked)
                    }
                  />
                </div>

                <div className='flex items-center justify-between'>
                  <div className='space-y-0.5'>
                    <Label htmlFor='highlight-quoted'>
                      Highlight Quoted Text
                    </Label>
                    <p className='text-sm text-muted-foreground'>
                      Use visual highlighting for quoted content
                    </p>
                  </div>
                  <Switch
                    id='highlight-quoted'
                    checked={preferences.highlightQuotedText}
                    onCheckedChange={checked =>
                      updatePreference('highlightQuotedText', checked)
                    }
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Media Tab */}
          <TabsContent value='media' className='space-y-4'>
            {/* Link Previews */}
            <Card>
              <CardHeader>
                <div className='flex items-center gap-2'>
                  <Link className='h-5 w-5' />
                  <CardTitle>Link Previews</CardTitle>
                </div>
                <CardDescription>
                  Configure how links are previewed in messages.
                </CardDescription>
              </CardHeader>
              <CardContent className='space-y-4'>
                <div className='flex items-center justify-between'>
                  <div className='space-y-0.5'>
                    <Label htmlFor='link-preview-mode'>Preview Mode</Label>
                    <p className='text-sm text-muted-foreground'>
                      When to show link previews
                    </p>
                  </div>
                  <Select
                    value={preferences.linkPreviewMode}
                    onValueChange={(value: LinkPreviewMode) =>
                      updatePreference('linkPreviewMode', value)
                    }
                  >
                    <SelectTrigger id='link-preview-mode' className='w-32'>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='always'>Always</SelectItem>
                      <SelectItem value='hover'>On Hover</SelectItem>
                      <SelectItem value='manual'>Manual</SelectItem>
                      <SelectItem value='never'>Never</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                <div className='flex items-center justify-between'>
                  <div className='space-y-0.5'>
                    <Label htmlFor='load-background'>
                      Load Links in Background
                    </Label>
                    <p className='text-sm text-muted-foreground'>
                      Preload link metadata for faster previews
                    </p>
                  </div>
                  <Switch
                    id='load-background'
                    checked={preferences.loadLinksInBackground}
                    onCheckedChange={checked =>
                      updatePreference('loadLinksInBackground', checked)
                    }
                  />
                </div>
              </CardContent>
            </Card>

            {/* Image and Video Display */}
            <Card>
              <CardHeader>
                <div className='flex items-center gap-2'>
                  <Image className='h-5 w-5' />
                  <CardTitle>Image & Video Display</CardTitle>
                </div>
                <CardDescription>
                  Control how images and videos are displayed in messages.
                </CardDescription>
              </CardHeader>
              <CardContent className='space-y-4'>
                <div className='flex items-center justify-between'>
                  <div className='space-y-0.5'>
                    <Label htmlFor='auto-expand-images'>
                      Auto-Expand Images
                    </Label>
                    <p className='text-sm text-muted-foreground'>
                      Show images at full size automatically
                    </p>
                  </div>
                  <Switch
                    id='auto-expand-images'
                    checked={preferences.autoExpandImages}
                    onCheckedChange={checked =>
                      updatePreference('autoExpandImages', checked)
                    }
                  />
                </div>

                <Separator />

                <div className='flex items-center justify-between'>
                  <div className='space-y-0.5'>
                    <Label htmlFor='auto-expand-videos'>
                      Auto-Expand Videos
                    </Label>
                    <p className='text-sm text-muted-foreground'>
                      Show video players automatically
                    </p>
                  </div>
                  <Switch
                    id='auto-expand-videos'
                    checked={preferences.autoExpandVideos}
                    onCheckedChange={checked =>
                      updatePreference('autoExpandVideos', checked)
                    }
                  />
                </div>

                <div className='rounded-lg bg-amber-500/10 border border-amber-500/20 p-3'>
                  <p className='text-sm text-amber-700 dark:text-amber-400'>
                    Note: Auto-expanding media may use more bandwidth and affect
                    performance
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Interactions Tab */}
          <TabsContent value='interactions' className='space-y-4'>
            {/* Reactions */}
            <Card>
              <CardHeader>
                <div className='flex items-center gap-2'>
                  <ThumbsUp className='h-5 w-5' />
                  <CardTitle>Reactions</CardTitle>
                </div>
                <CardDescription>
                  Customize how emoji reactions are displayed and managed.
                </CardDescription>
              </CardHeader>
              <CardContent className='space-y-4'>
                <div className='flex items-center justify-between'>
                  <div className='space-y-0.5'>
                    <Label htmlFor='reaction-style'>Display Style</Label>
                    <p className='text-sm text-muted-foreground'>
                      How reactions appear on messages
                    </p>
                  </div>
                  <Select
                    value={preferences.reactionDisplayStyle}
                    onValueChange={(value: ReactionDisplayStyle) =>
                      updatePreference('reactionDisplayStyle', value)
                    }
                  >
                    <SelectTrigger id='reaction-style' className='w-32'>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='compact'>Compact</SelectItem>
                      <SelectItem value='comfortable'>Comfortable</SelectItem>
                      <SelectItem value='detailed'>Detailed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                <div className='flex items-center justify-between'>
                  <div className='space-y-0.5'>
                    <Label htmlFor='reaction-tooltips'>
                      Show Reaction Tooltips
                    </Label>
                    <p className='text-sm text-muted-foreground'>
                      Display who reacted when hovering over reactions
                    </p>
                  </div>
                  <Switch
                    id='reaction-tooltips'
                    checked={preferences.showReactionTooltips}
                    onCheckedChange={checked =>
                      updatePreference('showReactionTooltips', checked)
                    }
                  />
                </div>

                <div className='flex items-center justify-between'>
                  <div className='space-y-0.5'>
                    <Label htmlFor='quick-reactions'>Quick Reactions Bar</Label>
                    <p className='text-sm text-muted-foreground'>
                      Show frequently used reactions on hover
                    </p>
                  </div>
                  <Switch
                    id='quick-reactions'
                    checked={preferences.quickReactionsEnabled}
                    onCheckedChange={checked =>
                      updatePreference('quickReactionsEnabled', checked)
                    }
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Save Button */}
        <div className='flex justify-end gap-3'>
          <Button variant='outline' onClick={handleResetToDefaults}>
            <RotateCcw className='h-4 w-4 mr-2' />
            Reset to Defaults
          </Button>
          <Button onClick={handleSavePreferences} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save All Changes'}
          </Button>
        </div>
      </div>

      {/* Live Preview Panel */}
      <div className='lg:col-span-1'>
        <div className='sticky top-6'>
          <Card>
            <CardHeader>
              <div className='flex items-center gap-2'>
                <MessageSquare className='h-5 w-5' />
                <CardTitle>Live Preview</CardTitle>
              </div>
              <CardDescription>See how messages will appear</CardDescription>
            </CardHeader>
            <CardContent>
              <MessagePreview preferences={preferences} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

/**
 * Sample message for preview demonstrations
 */
const sampleMessage =
  'This is a sample message that demonstrates how the message preview will look with your current settings. It includes enough text to show truncation behavior when the preview length is adjusted.';

/**
 * Message Preview Component
 * Shows a live preview of how messages will appear with current settings
 */
interface MessagePreviewProps {
  preferences: MessagePreferences;
}

function MessagePreview({ preferences }: MessagePreviewProps) {
  const demoText = preferences.enableMarkdown
    ? "Check out this **important update**! We just launched _something amazing_. Here's a quick example: `npm install awesome-package`"
    : "Check out this important update! We just launched something amazing. Here's a quick example: npm install awesome-package";

  const convertedEmoji = preferences.emojiAutoConvert
    ? 'Great work :) Looking forward to this! :D'
    : 'Great work :) Looking forward to this! :D';

  const compactClass = preferences.compactMode ? 'space-y-1' : 'space-y-3';

  return (
    <div className='space-y-4'>
      {/* Message Display Preview */}
      <div className={cn('rounded-lg border bg-background p-3', compactClass)}>
        {/* Main Message */}
        <div className='flex gap-2'>
          <div className='h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0'>
            <span className='text-xs font-semibold'>JD</span>
          </div>
          <div className='flex-1 min-w-0'>
            <div className='flex items-baseline gap-2 mb-1'>
              <span className='text-sm font-semibold'>John Doe</span>
              <span className='text-xs text-muted-foreground'>2:30 PM</span>
            </div>
            <div className='text-sm'>
              {preferences.enableMarkdown ? (
                <FormattedText text={demoText} />
              ) : (
                demoText
              )}
            </div>

            {/* Reactions Preview */}
            {preferences.quickReactionsEnabled && (
              <div className='mt-2 flex gap-1'>
                {preferences.reactionDisplayStyle === 'compact' && (
                  <>
                    <ReactionBubble emoji='👍' count={3} size='sm' />
                    <ReactionBubble emoji='❤️' count={1} size='sm' />
                  </>
                )}
                {preferences.reactionDisplayStyle === 'comfortable' && (
                  <>
                    <ReactionBubble emoji='👍' count={3} size='md' />
                    <ReactionBubble emoji='❤️' count={1} size='md' />
                  </>
                )}
                {preferences.reactionDisplayStyle === 'detailed' && (
                  <>
                    <ReactionBubble
                      emoji='👍'
                      count={3}
                      size='lg'
                      showUsers={preferences.showReactionTooltips}
                    />
                    <ReactionBubble
                      emoji='❤️'
                      count={1}
                      size='lg'
                      showUsers={preferences.showReactionTooltips}
                    />
                  </>
                )}
              </div>
            )}

            {/* Thread Preview */}
            {preferences.showThreadIndicators &&
              !preferences.threadCollapseDefault && (
                <div className='mt-2 ml-4 border-l-2 border-primary/30 pl-3 py-1'>
                  <div className='text-xs text-muted-foreground'>
                    2 replies • Last reply 5m ago
                  </div>
                </div>
              )}
          </div>
        </div>

        {preferences.showMessageSeparators &&
          preferences.messageGroupingThreshold > 3 && (
            <div className='h-px bg-border my-2' />
          )}

        {/* Grouped Message (within threshold) */}
        <div className='flex gap-2'>
          <div className='w-8' /> {/* Spacer for grouped message */}
          <div className='flex-1 min-w-0'>
            <div className='text-sm'>{convertedEmoji}</div>
          </div>
        </div>

        {/* Quoted Reply Preview */}
        {preferences.quotedReplyFormat !== 'reference' && (
          <>
            {preferences.showMessageSeparators && (
              <div className='h-px bg-border my-2' />
            )}
            <div className='flex gap-2'>
              <div className='h-8 w-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0'>
                <span className='text-xs font-semibold'>AS</span>
              </div>
              <div className='flex-1 min-w-0'>
                <div className='flex items-baseline gap-2 mb-1'>
                  <span className='text-sm font-semibold'>Alice Smith</span>
                  <span className='text-xs text-muted-foreground'>2:35 PM</span>
                </div>

                {/* Quote */}
                <div
                  className={cn(
                    'text-xs border-l-2 pl-2 mb-2',
                    preferences.highlightQuotedText
                      ? 'border-primary/50 bg-primary/5 py-1'
                      : 'border-muted-foreground/30'
                  )}
                >
                  <div className='text-muted-foreground font-medium'>
                    John Doe:
                  </div>
                  <div className='text-muted-foreground line-clamp-2'>
                    {demoText.slice(0, 80)}...
                  </div>
                </div>

                <div className='text-sm'>Thanks for sharing this!</div>
              </div>
            </div>
          </>
        )}

        {/* Image Preview */}
        {preferences.autoExpandImages && (
          <>
            {preferences.showMessageSeparators && (
              <div className='h-px bg-border my-2' />
            )}
            <div className='flex gap-2'>
              <div className='h-8 w-8 rounded-full bg-accent flex items-center justify-center flex-shrink-0'>
                <span className='text-xs font-semibold'>MJ</span>
              </div>
              <div className='flex-1 min-w-0'>
                <div className='flex items-baseline gap-2 mb-1'>
                  <span className='text-sm font-semibold'>Mike Johnson</span>
                  <span className='text-xs text-muted-foreground'>2:40 PM</span>
                </div>
                <div className='text-sm mb-2'>Here&apos;s a screenshot!</div>
                <div className='rounded-md bg-muted h-24 w-32 flex items-center justify-center'>
                  <Image className='h-8 w-8 text-muted-foreground' />
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Link Preview */}
      {preferences.linkPreviewMode !== 'never' && (
        <div className='rounded-lg border bg-card p-3'>
          <div className='text-xs font-medium text-muted-foreground mb-2'>
            Link Preview
            {preferences.linkPreviewMode === 'hover' && ' (On Hover)'}
            {preferences.linkPreviewMode === 'manual' && ' (Manual)'}
          </div>
          <div className='flex gap-3'>
            <div className='rounded bg-muted h-16 w-16 flex-shrink-0 flex items-center justify-center'>
              <Link className='h-6 w-6 text-muted-foreground' />
            </div>
            <div className='flex-1 min-w-0'>
              <div className='text-sm font-medium truncate'>
                Example Website
              </div>
              <div className='text-xs text-muted-foreground line-clamp-2'>
                This is how link previews will appear in your messages
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Settings Summary */}
      <div className='space-y-2 text-xs'>
        <div className='font-medium text-muted-foreground'>
          Active Settings:
        </div>
        <div className='space-y-1'>
          <div className='flex justify-between'>
            <span className='text-muted-foreground'>Send:</span>
            <span>{preferences.enterToSend ? 'Enter' : 'Shift+Enter'}</span>
          </div>
          <div className='flex justify-between'>
            <span className='text-muted-foreground'>Format:</span>
            <span className='capitalize'>
              {preferences.defaultFormattingMode}
            </span>
          </div>
          <div className='flex justify-between'>
            <span className='text-muted-foreground'>Grouping:</span>
            <span>{preferences.messageGroupingThreshold}min</span>
          </div>
          <div className='flex justify-between'>
            <span className='text-muted-foreground'>Emoji Convert:</span>
            <span>{preferences.emojiAutoConvert ? 'On' : 'Off'}</span>
          </div>
          <div className='flex justify-between'>
            <span className='text-muted-foreground'>Link Previews:</span>
            <span className='capitalize'>{preferences.linkPreviewMode}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Formatted Text Component
 * Renders text with markdown-like formatting
 */
function FormattedText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|_[^_]+_|`[^`]+`)/g);

  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i}>{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith('_') && part.endsWith('_')) {
          return <em key={i}>{part.slice(1, -1)}</em>;
        }
        if (part.startsWith('`') && part.endsWith('`')) {
          return (
            <code
              key={i}
              className='rounded bg-muted px-1 py-0.5 font-mono text-xs'
            >
              {part.slice(1, -1)}
            </code>
          );
        }
        return part;
      })}
    </>
  );
}

/**
 * Reaction Bubble Component
 */
interface ReactionBubbleProps {
  emoji: string;
  count: number;
  size: 'sm' | 'md' | 'lg';
  showUsers?: boolean;
}

function ReactionBubble({
  emoji,
  count,
  size,
  showUsers,
}: ReactionBubbleProps) {
  const sizeClasses = {
    sm: 'text-xs px-1.5 py-0.5',
    md: 'text-sm px-2 py-1',
    lg: 'text-sm px-2.5 py-1',
  };

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 rounded-full border bg-muted/50 hover:bg-muted transition-colors cursor-pointer',
        sizeClasses[size]
      )}
      title={showUsers ? 'John, Alice, Mike' : undefined}
    >
      <span>{emoji}</span>
      <span className='text-xs font-medium'>{count}</span>
    </div>
  );
}
