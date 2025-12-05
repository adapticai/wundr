/**
 * Security Questions Section Component
 *
 * Allows users to set up and manage security questions for account recovery.
 *
 * @module components/settings/security/SecurityQuestionsSection
 */

'use client';

import { HelpCircle, Plus, Trash2, Loader2 } from 'lucide-react';
import { useState } from 'react';

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
import { useSecurityQuestions } from '@/hooks/use-security-questions';
import { useToast } from '@/hooks/use-toast';

interface QuestionInput {
  question: string;
  answer: string;
}

export function SecurityQuestionsSection() {
  const { questions, isLoading, refresh } = useSecurityQuestions();
  const { toast } = useToast();
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [questionInputs, setQuestionInputs] = useState<QuestionInput[]>([
    { question: '', answer: '' },
    { question: '', answer: '' },
  ]);

  const handleAddQuestion = () => {
    if (questionInputs.length < 5) {
      setQuestionInputs([...questionInputs, { question: '', answer: '' }]);
    }
  };

  const handleRemoveQuestion = (index: number) => {
    if (questionInputs.length > 2) {
      setQuestionInputs(questionInputs.filter((_, i) => i !== index));
    }
  };

  const handleQuestionChange = (
    index: number,
    field: 'question' | 'answer',
    value: string
  ) => {
    const updated = [...questionInputs];
    updated[index][field] = value;
    setQuestionInputs(updated);
  };

  const handleSave = async () => {
    // Validate
    const validQuestions = questionInputs.filter(
      q => q.question.trim() && q.answer.trim()
    );

    if (validQuestions.length < 2) {
      toast({
        title: 'Validation Error',
        description: 'Please provide at least 2 security questions',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch('/api/user/security-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questions: validQuestions }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save security questions');
      }

      toast({
        title: 'Success',
        description: 'Security questions saved successfully',
      });

      setShowSetupModal(false);
      setQuestionInputs([
        { question: '', answer: '' },
        { question: '', answer: '' },
      ]);
      await refresh();
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error
            ? error.message
            : 'Failed to save security questions',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className='flex items-center gap-2'>
            <HelpCircle className='h-5 w-5' />
            <CardTitle>Security Questions</CardTitle>
          </div>
          <CardDescription>
            Set up security questions for account recovery
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className='flex items-center justify-center p-8'>
              <Loader2 className='h-6 w-6 animate-spin text-muted-foreground' />
            </div>
          ) : questions.length === 0 ? (
            <div className='space-y-4'>
              <p className='text-sm text-muted-foreground'>
                No security questions configured. Set up security questions to
                help recover your account if you forget your password.
              </p>
              <Button onClick={() => setShowSetupModal(true)}>
                Set Up Security Questions
              </Button>
            </div>
          ) : (
            <div className='space-y-4'>
              <div className='space-y-2'>
                {questions.map((q, index) => (
                  <div key={q.id} className='rounded-lg border p-3'>
                    <p className='text-sm'>
                      <span className='font-medium'>{index + 1}.</span>{' '}
                      {q.question}
                    </p>
                  </div>
                ))}
              </div>
              <Button variant='outline' onClick={() => setShowSetupModal(true)}>
                Update Questions
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showSetupModal} onOpenChange={setShowSetupModal}>
        <DialogContent className='max-w-2xl max-h-[80vh] overflow-y-auto'>
          <DialogHeader>
            <DialogTitle>Set Up Security Questions</DialogTitle>
            <DialogDescription>
              Choose questions and answers that you'll remember. Answers are
              case-insensitive.
            </DialogDescription>
          </DialogHeader>

          <div className='space-y-4 py-4'>
            {questionInputs.map((input, index) => (
              <div key={index} className='space-y-3 rounded-lg border p-4'>
                <div className='flex items-center justify-between'>
                  <Label className='text-sm font-medium'>
                    Question {index + 1}
                  </Label>
                  {questionInputs.length > 2 && (
                    <Button
                      variant='ghost'
                      size='sm'
                      onClick={() => handleRemoveQuestion(index)}
                      className='h-auto p-1 text-destructive hover:text-destructive'
                    >
                      <Trash2 className='h-4 w-4' />
                    </Button>
                  )}
                </div>
                <Input
                  placeholder='Enter your security question'
                  value={input.question}
                  onChange={e =>
                    handleQuestionChange(index, 'question', e.target.value)
                  }
                />
                <Input
                  type='password'
                  placeholder='Enter your answer'
                  value={input.answer}
                  onChange={e =>
                    handleQuestionChange(index, 'answer', e.target.value)
                  }
                />
              </div>
            ))}

            {questionInputs.length < 5 && (
              <Button
                variant='outline'
                size='sm'
                onClick={handleAddQuestion}
                className='w-full'
              >
                <Plus className='mr-2 h-4 w-4' />
                Add Another Question
              </Button>
            )}
          </div>

          <DialogFooter>
            <Button
              variant='outline'
              onClick={() => setShowSetupModal(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                  Saving...
                </>
              ) : (
                'Save Questions'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
