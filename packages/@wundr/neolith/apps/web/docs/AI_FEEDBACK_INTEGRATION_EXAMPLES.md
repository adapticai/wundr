# AI Feedback System - Integration Examples

## Quick Start

### 1. Add Feedback Buttons to AI Messages

```tsx
// In your AI chat message component
import { FeedbackButtons } from '@/components/ai/feedback-buttons';
import { FeedbackDialog } from '@/components/ai/feedback-dialog';
import { useState } from 'react';

function AIMessage({ message, workspaceId }) {
  const [showDetailedFeedback, setShowDetailedFeedback] = useState(false);

  return (
    <div className='ai-message'>
      {/* Message content */}
      <div className='message-content'>{message.content}</div>

      {/* Feedback buttons */}
      <div className='message-actions'>
        <FeedbackButtons
          responseId={message.id}
          workspaceId={workspaceId}
          onFeedbackSubmit={sentiment => {
            console.log('User feedback:', sentiment);
          }}
          onDetailedFeedback={() => setShowDetailedFeedback(true)}
        />
      </div>

      {/* Detailed feedback dialog */}
      <FeedbackDialog
        open={showDetailedFeedback}
        onOpenChange={setShowDetailedFeedback}
        responseId={message.id}
        workspaceId={workspaceId}
        onSubmit={() => {
          console.log('Detailed feedback submitted');
          setShowDetailedFeedback(false);
        }}
      />
    </div>
  );
}
```

### 2. Add Analytics to Admin Dashboard

```tsx
// In your workspace settings page
import { FeedbackSummary } from '@/components/ai/feedback-summary';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function WorkspaceSettings({ workspace }) {
  return (
    <div className='container mx-auto p-6'>
      <Tabs defaultValue='general'>
        <TabsList>
          <TabsTrigger value='general'>General</TabsTrigger>
          <TabsTrigger value='members'>Members</TabsTrigger>
          <TabsTrigger value='ai-feedback'>AI Feedback</TabsTrigger>
        </TabsList>

        <TabsContent value='general'>{/* General settings */}</TabsContent>

        <TabsContent value='members'>{/* Member management */}</TabsContent>

        <TabsContent value='ai-feedback'>
          <FeedbackSummary workspaceId={workspace.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

### 3. Programmatic Feedback Submission

```tsx
// Submit feedback programmatically
async function submitFeedback(responseId: string, workspaceId: string) {
  try {
    const response = await fetch('/api/ai/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        responseId,
        workspaceId,
        sentiment: 'POSITIVE',
        category: 'helpfulness',
        comment: 'This response was very helpful!',
        isAnonymous: false,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to submit feedback');
    }

    const data = await response.json();
    console.log('Feedback submitted:', data);
  } catch (error) {
    console.error('Error submitting feedback:', error);
  }
}
```

### 4. Fetch Feedback Statistics

```tsx
// Get feedback stats for analytics
async function getFeedbackStats(workspaceId: string) {
  try {
    const response = await fetch(`/api/ai/feedback/stats?workspaceId=${workspaceId}`);

    if (!response.ok) {
      throw new Error('Failed to fetch stats');
    }

    const data = await response.json();
    console.log('Stats:', data);
    // Returns: { overview, sentiments, categories, recentFeedback, trendData }
  } catch (error) {
    console.error('Error fetching stats:', error);
  }
}
```

### 5. Export Feedback Data

```tsx
// Export feedback as CSV
async function exportFeedbackCSV(workspaceId: string) {
  try {
    const response = await fetch(`/api/ai/feedback/export?workspaceId=${workspaceId}&format=csv`);

    if (!response.ok) {
      throw new Error('Failed to export feedback');
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `feedback-${new Date().toISOString()}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  } catch (error) {
    console.error('Error exporting feedback:', error);
  }
}
```

## Advanced Usage

### Custom Feedback Button with Analytics

```tsx
import { FeedbackButtons } from '@/components/ai/feedback-buttons';
import { getFeedbackStats } from '@/lib/ai/feedback-analytics';
import { useEffect, useState } from 'react';

function AIMessageWithAnalytics({ message, workspaceId }) {
  const [feedbackStats, setFeedbackStats] = useState(null);

  useEffect(() => {
    // Load feedback stats for this specific response
    getFeedbackStats(workspaceId, { responseId: message.id })
      .then(setFeedbackStats)
      .catch(console.error);
  }, [message.id, workspaceId]);

  return (
    <div>
      <div className='message-content'>{message.content}</div>

      <div className='flex items-center gap-4'>
        <FeedbackButtons responseId={message.id} workspaceId={workspaceId} />

        {feedbackStats && feedbackStats.total > 0 && (
          <span className='text-xs text-muted-foreground'>
            {feedbackStats.positive} positive, {feedbackStats.negative} negative
          </span>
        )}
      </div>
    </div>
  );
}
```

### Real-time Feedback Updates

```tsx
import { useState, useEffect } from 'react';
import useSWR from 'swr';

function FeedbackDashboard({ workspaceId }) {
  const { data, error, mutate } = useSWR(
    `/api/ai/feedback/stats?workspaceId=${workspaceId}`,
    url => fetch(url).then(r => r.json()),
    { refreshInterval: 30000 } // Refresh every 30 seconds
  );

  if (error) return <div>Failed to load feedback</div>;
  if (!data) return <div>Loading...</div>;

  return (
    <div>
      <h2>Real-time Feedback Stats</h2>
      <p>Total: {data.overview.total}</p>
      <p>Positive Rate: {data.overview.positiveRate}%</p>
      <button onClick={() => mutate()}>Refresh Now</button>
    </div>
  );
}
```

### Filter by Category

```tsx
import { useState } from 'react';
import { Select } from '@/components/ui/select';

function FilteredFeedbackList({ workspaceId }) {
  const [category, setCategory] = useState<string | undefined>();
  const [sentiment, setSentiment] = useState<string | undefined>();

  const fetchFeedback = async () => {
    const params = new URLSearchParams({ workspaceId });
    if (category) params.set('category', category);
    if (sentiment) params.set('sentiment', sentiment);

    const response = await fetch(`/api/ai/feedback?${params}`);
    return response.json();
  };

  return (
    <div>
      <div className='filters'>
        <Select value={category} onValueChange={setCategory}>
          <option value=''>All Categories</option>
          <option value='accuracy'>Accuracy</option>
          <option value='helpfulness'>Helpfulness</option>
          <option value='clarity'>Clarity</option>
          <option value='relevance'>Relevance</option>
          <option value='tone'>Tone</option>
          <option value='other'>Other</option>
        </Select>

        <Select value={sentiment} onValueChange={setSentiment}>
          <option value=''>All Sentiments</option>
          <option value='POSITIVE'>Positive</option>
          <option value='NEUTRAL'>Neutral</option>
          <option value='NEGATIVE'>Negative</option>
        </Select>
      </div>

      {/* Render filtered feedback list */}
    </div>
  );
}
```

## Server-Side Integration

### API Route with Feedback

```typescript
// In your AI chat API route
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  // Generate AI response
  const response = await generateAIResponse(/* ... */);

  // Return response with feedback metadata
  return NextResponse.json({
    id: response.id,
    content: response.text,
    metadata: {
      // Include info for feedback tracking
      canReceiveFeedback: true,
      feedbackEndpoint: '/api/ai/feedback',
      responseId: response.id,
    },
  });
}
```

### Webhook for Feedback Notifications

```typescript
// Send webhook when negative feedback received
import { prisma } from '@neolith/database';

export async function sendFeedbackWebhook(feedbackId: string) {
  const feedback = await prisma.aiFeedback.findUnique({
    where: { id: feedbackId },
    include: { user: true },
  });

  if (feedback?.sentiment === 'NEGATIVE') {
    // Send notification to team
    await fetch(process.env.SLACK_WEBHOOK_URL!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `Negative AI feedback received`,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*Category*: ${feedback.category}\n*Comment*: ${feedback.comment}`,
            },
          },
        ],
      }),
    });
  }
}
```

## Testing Examples

### Unit Test for Feedback Submission

```typescript
import { describe, it, expect } from 'vitest';
import { POST } from '@/app/api/ai/feedback/route';

describe('AI Feedback API', () => {
  it('should submit positive feedback', async () => {
    const request = new Request('http://localhost:3000/api/ai/feedback', {
      method: 'POST',
      body: JSON.stringify({
        responseId: 'test_response_123',
        sentiment: 'POSITIVE',
        workspaceId: 'test_workspace',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.feedback.sentiment).toBe('POSITIVE');
  });
});
```

### Integration Test for Analytics

```typescript
import { getFeedbackStats } from '@/lib/ai/feedback-analytics';

describe('Feedback Analytics', () => {
  it('should calculate positive rate correctly', async () => {
    const stats = await getFeedbackStats('test_workspace');

    expect(stats.total).toBeGreaterThan(0);
    expect(stats.positiveRate).toBeGreaterThanOrEqual(0);
    expect(stats.positiveRate).toBeLessThanOrEqual(100);
  });
});
```

## Best Practices

1. **Always provide workspaceId** - All operations are workspace-scoped
2. **Handle errors gracefully** - Show user-friendly error messages
3. **Use anonymous option carefully** - For sensitive feedback
4. **Prompt for details on negative** - Get actionable feedback
5. **Track trends over time** - Monitor feedback patterns
6. **Export regularly** - Backup feedback data
7. **Set up alerts** - Notify team of negative spikes
8. **Close the loop** - Show users how feedback improved AI

## Common Patterns

### Inline Feedback

```tsx
<div className='flex items-center gap-2'>
  <AIResponse content={content} />
  <FeedbackButtons size='sm' {...props} />
</div>
```

### Modal Feedback

```tsx
<Dialog>
  <DialogTrigger>Leave Feedback</DialogTrigger>
  <DialogContent>
    <FeedbackDialog {...props} />
  </DialogContent>
</Dialog>
```

### Card-based Analytics

```tsx
<Card>
  <CardHeader>
    <CardTitle>AI Feedback</CardTitle>
  </CardHeader>
  <CardContent>
    <FeedbackSummary workspaceId={workspaceId} />
  </CardContent>
</Card>
```
