/**
 * Security Questions Hook
 *
 * Hook for fetching and managing security questions.
 *
 * @module hooks/use-security-questions
 */

'use client';

import { useState, useEffect, useCallback } from 'react';

import type { SecurityQuestion } from '@/app/api/user/security-questions/route';

export interface UseSecurityQuestionsReturn {
  questions: SecurityQuestion[];
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

export function useSecurityQuestions(): UseSecurityQuestionsReturn {
  const [questions, setQuestions] = useState<SecurityQuestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchQuestions = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/user/security-questions');

      if (!response.ok) {
        throw new Error('Failed to fetch security questions');
      }

      const data = await response.json();
      setQuestions(data.data?.questions || []);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
      setQuestions([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  const refresh = useCallback(async () => {
    await fetchQuestions();
  }, [fetchQuestions]);

  return {
    questions,
    isLoading,
    error,
    refresh,
  };
}
