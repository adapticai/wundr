/**
 * AI Feedback Dialog Component
 *
 * Detailed feedback form with categories and comments
 *
 * @module components/ai/feedback-dialog
 */

'use client';

import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';

interface FeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  responseId: string;
  workspaceId: string;
  initialSentiment?: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
  onSubmit?: () => void;
}

const CATEGORIES = [
  { value: 'accuracy', label: 'Accuracy', description: 'Factually incorrect' },
  {
    value: 'helpfulness',
    label: 'Helpfulness',
    description: "Didn't solve my problem",
  },
  {
    value: 'clarity',
    label: 'Clarity',
    description: 'Hard to understand',
  },
  {
    value: 'relevance',
    label: 'Relevance',
    description: 'Off-topic or irrelevant',
  },
  { value: 'tone', label: 'Tone', description: 'Inappropriate tone' },
  { value: 'other', label: 'Other', description: 'Something else' },
];

export function FeedbackDialog({
  open,
  onOpenChange,
  responseId,
  workspaceId,
  initialSentiment = 'NEGATIVE',
  onSubmit,
}: FeedbackDialogProps) {
  const [sentiment, setSentiment] = useState<
    'POSITIVE' | 'NEGATIVE' | 'NEUTRAL'
  >(initialSentiment);
  const [category, setCategory] = useState<string>('');
  const [comment, setComment] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!category) {
      toast.error('Please select a category');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/ai/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          responseId,
          workspaceId,
          sentiment,
          category,
          comment: comment.trim() || undefined,
          isAnonymous,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit feedback');
      }

      toast.success('Feedback submitted', {
        description: 'Thank you for the detailed feedback!',
      });

      onSubmit?.();
      onOpenChange(false);

      // Reset form
      setCategory('');
      setComment('');
      setIsAnonymous(false);
    } catch (error) {
      console.error('Failed to submit feedback:', error);
      toast.error('Failed to submit feedback', {
        description: 'Please try again later',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-[500px]'>
        <DialogHeader>
          <DialogTitle>Provide Detailed Feedback</DialogTitle>
          <DialogDescription>
            Help us understand what went wrong so we can improve the AI
            responses.
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-6 py-4'>
          {/* Sentiment */}
          <div className='space-y-2'>
            <Label>Overall Rating</Label>
            <RadioGroup
              value={sentiment}
              onValueChange={v => setSentiment(v as any)}
            >
              <div className='flex items-center space-x-2'>
                <RadioGroupItem value='POSITIVE' id='positive' />
                <Label
                  htmlFor='positive'
                  className='font-normal cursor-pointer'
                >
                  Positive - Good response
                </Label>
              </div>
              <div className='flex items-center space-x-2'>
                <RadioGroupItem value='NEUTRAL' id='neutral' />
                <Label htmlFor='neutral' className='font-normal cursor-pointer'>
                  Neutral - Could be better
                </Label>
              </div>
              <div className='flex items-center space-x-2'>
                <RadioGroupItem value='NEGATIVE' id='negative' />
                <Label
                  htmlFor='negative'
                  className='font-normal cursor-pointer'
                >
                  Negative - Poor response
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Category */}
          <div className='space-y-2'>
            <Label>Issue Category *</Label>
            <RadioGroup value={category} onValueChange={setCategory}>
              {CATEGORIES.map(cat => (
                <div key={cat.value} className='flex items-start space-x-2'>
                  <RadioGroupItem
                    value={cat.value}
                    id={cat.value}
                    className='mt-1'
                  />
                  <Label
                    htmlFor={cat.value}
                    className='font-normal cursor-pointer flex-1'
                  >
                    <div className='font-medium'>{cat.label}</div>
                    <div className='text-sm text-muted-foreground'>
                      {cat.description}
                    </div>
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Comment */}
          <div className='space-y-2'>
            <Label htmlFor='comment'>Additional Comments (Optional)</Label>
            <Textarea
              id='comment'
              placeholder='Please provide more details about the issue...'
              value={comment}
              onChange={e => setComment(e.target.value)}
              rows={4}
              maxLength={2000}
            />
            <p className='text-xs text-muted-foreground'>
              {comment.length}/2000 characters
            </p>
          </div>

          {/* Anonymous option */}
          <div className='flex items-center space-x-2'>
            <input
              type='checkbox'
              id='anonymous'
              checked={isAnonymous}
              onChange={e => setIsAnonymous(e.target.checked)}
              className='h-4 w-4 rounded border-gray-300'
            />
            <Label htmlFor='anonymous' className='font-normal cursor-pointer'>
              Submit feedback anonymously
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button
            type='button'
            variant='outline'
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type='button' onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
