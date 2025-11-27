"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { ChatMessage, ChatMessageProps } from "./chat-message"
import { Button } from "@/components/ui/button"
import { Loader2, Sparkles } from "lucide-react"

export interface Message extends Omit<ChatMessageProps, "timestamp"> {
  id: string
  timestamp: Date
}

export interface ChatContainerProps {
  messages: Message[]
  isLoading?: boolean
  onLoadMore?: () => void
  hasMore?: boolean
  emptyStateTitle?: string
  emptyStateDescription?: string
  className?: string
}

export function ChatContainer({
  messages,
  isLoading = false,
  onLoadMore,
  hasMore = false,
  emptyStateTitle = "Start a conversation",
  emptyStateDescription = "Send a message to begin creating your agent, deployment, or channel.",
  className,
}: ChatContainerProps) {
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const [shouldAutoScroll, setShouldAutoScroll] = React.useState(true)
  const lastMessageRef = React.useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new messages arrive
  React.useEffect(() => {
    if (shouldAutoScroll && lastMessageRef.current) {
      lastMessageRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages, shouldAutoScroll])

  // Detect if user scrolled up
  const handleScroll = React.useCallback(() => {
    if (!scrollRef.current) return

    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100

    setShouldAutoScroll(isNearBottom)
  }, [])

  // Scroll to bottom on mount
  React.useEffect(() => {
    if (lastMessageRef.current) {
      lastMessageRef.current.scrollIntoView({ behavior: "instant" })
    }
  }, [])

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      className={cn(
        "flex-1 overflow-y-auto overscroll-contain",
        className
      )}
    >
      <div className="flex flex-col gap-4 p-4 min-h-full">
        {/* Load More Button */}
        {hasMore && (
          <div className="flex justify-center py-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onLoadMore}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Loading...
                </>
              ) : (
                "Load previous messages"
              )}
            </Button>
          </div>
        )}

        {/* Empty State */}
        {messages.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center flex-1 text-center space-y-4 py-12">
            <div className="rounded-full bg-primary/10 p-6">
              <Sparkles className="h-12 w-12 text-primary" />
            </div>
            <div className="space-y-2 max-w-md">
              <h3 className="text-xl font-semibold tracking-tight">
                {emptyStateTitle}
              </h3>
              <p className="text-sm text-muted-foreground">
                {emptyStateDescription}
              </p>
            </div>
            <div className="flex flex-col gap-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                <span>Describe what you want to create</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                <span>Answer questions to refine the details</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                <span>Review and confirm when ready</span>
              </div>
            </div>
          </div>
        )}

        {/* Messages List */}
        {messages.map((message, index) => (
          <div
            key={message.id}
            ref={index === messages.length - 1 ? lastMessageRef : undefined}
          >
            <ChatMessage
              role={message.role}
              content={message.content}
              timestamp={message.timestamp}
              isTyping={message.isTyping}
              avatarUrl={message.avatarUrl}
              userName={message.userName}
            />
          </div>
        ))}
      </div>

      {/* Scroll to Bottom Button */}
      {!shouldAutoScroll && messages.length > 0 && (
        <div className="sticky bottom-4 flex justify-center pointer-events-none">
          <Button
            size="sm"
            variant="secondary"
            className="pointer-events-auto shadow-lg"
            onClick={() => {
              setShouldAutoScroll(true)
              lastMessageRef.current?.scrollIntoView({ behavior: "smooth" })
            }}
          >
            Scroll to bottom
          </Button>
        </div>
      )}
    </div>
  )
}
