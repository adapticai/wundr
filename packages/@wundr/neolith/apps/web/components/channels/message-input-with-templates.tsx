'use client';

import { MessageInput } from '@/components/chat/message-input';
import { TemplateSelector } from './template-selector';
import { useState, useCallback } from 'react';

import type { User } from '@/types/chat';

/**
 * Enhanced Message Input with Template Support
 *
 * This component wraps the MessageInput with template functionality
 * Example integration showing how to add template selector to message composition
 */
interface MessageInputWithTemplatesProps {
  channelId: string;
  channelName?: string;
  parentId?: string;
  currentUser: User;
  placeholder?: string;
  maxLength?: number;
  onSend: (content: string, mentions: string[], attachments: File[]) => void;
  onTyping?: () => void;
  onStopTyping?: () => void;
  disabled?: boolean;
  className?: string;
  isChannelAdmin?: boolean;
}

export function MessageInputWithTemplates({
  channelId,
  channelName,
  parentId,
  currentUser,
  placeholder,
  maxLength = 4000,
  onSend,
  onTyping,
  onStopTyping,
  disabled = false,
  className,
  isChannelAdmin = false,
}: MessageInputWithTemplatesProps) {
  const [templateContent, setTemplateContent] = useState<string | null>(null);

  const handleTemplateSelect = useCallback((content: string) => {
    // Set the template content which can be used to populate the message input
    setTemplateContent(content);
    // In a real implementation, you would pass this to MessageInput
    // This could be done by modifying MessageInput to accept a controlled value prop
    // or by using a ref to directly set the textarea value
  }, []);

  return (
    <div className={className}>
      {/* Template Selector Button */}
      <div className="flex items-center gap-2 px-4 pb-2">
        <TemplateSelector
          channelId={channelId}
          onSelectTemplate={handleTemplateSelect}
          isAdmin={isChannelAdmin}
          disabled={disabled}
        />
        <span className="text-xs text-muted-foreground">
          Click to insert a message template
        </span>
      </div>

      {/* Message Input */}
      <MessageInput
        channelId={channelId}
        channelName={channelName}
        parentId={parentId}
        currentUser={currentUser}
        placeholder={placeholder}
        maxLength={maxLength}
        onSend={onSend}
        onTyping={onTyping}
        onStopTyping={onStopTyping}
        disabled={disabled}
      />

      {/* Template preview (if selected) */}
      {templateContent && (
        <div className="mx-4 mb-2 p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <p className="text-xs font-medium text-blue-900 dark:text-blue-100 mb-1">
                Template Preview
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-300 whitespace-pre-wrap">
                {templateContent}
              </p>
            </div>
            <button
              onClick={() => setTemplateContent(null)}
              className="text-blue-700 dark:text-blue-300 hover:text-blue-900 dark:hover:text-blue-100"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * INTEGRATION NOTES:
 *
 * To fully integrate templates with MessageInput, you have two options:
 *
 * 1. RECOMMENDED: Modify MessageInput to accept a controlled value prop
 *    - Add `value?: string` and `onChange?: (value: string) => void` props to MessageInput
 *    - Make the textarea a controlled component
 *    - Then use: <MessageInput value={templateContent || ''} onChange={setContent} />
 *
 * 2. Use a ref to imperatively set the textarea value:
 *    - Add `ref` forwarding to MessageInput to expose the textarea ref
 *    - Use useImperativeHandle to expose a method like `insertContent(content: string)`
 *    - Call this method when a template is selected
 *
 * Example of Option 1 (Controlled Component):
 *
 * ```tsx
 * // In this component:
 * const [content, setContent] = useState('');
 *
 * const handleTemplateSelect = (templateContent: string) => {
 *   setContent(templateContent);
 * };
 *
 * return (
 *   <MessageInput
 *     {...props}
 *     value={content}
 *     onChange={setContent}
 *   />
 * );
 * ```
 *
 * Example of Option 2 (Ref Method):
 *
 * ```tsx
 * // In this component:
 * const messageInputRef = useRef<MessageInputRef>(null);
 *
 * const handleTemplateSelect = (content: string) => {
 *   messageInputRef.current?.insertContent(content);
 * };
 *
 * return (
 *   <MessageInput
 *     ref={messageInputRef}
 *     {...props}
 *   />
 * );
 * ```
 */
