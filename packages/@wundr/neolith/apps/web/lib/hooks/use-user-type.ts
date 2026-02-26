'use client';

import { useState, useEffect } from 'react';

type UserType = 'human' | 'orchestrator';

interface UserTypeState {
  userType: UserType | null;
  isOrchestrator: boolean;
  orchestratorId?: string;
  isLoading: boolean;
  error: string | null;
}

export function useUserType(): UserTypeState {
  const [state, setState] = useState<UserTypeState>({
    userType: null,
    isOrchestrator: false,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    async function fetchUserType() {
      try {
        const response = await fetch('/api/auth/user-type');
        if (!response.ok) {
          throw new Error('Failed to fetch user type');
        }
        const data = await response.json();
        setState({
          userType: data.userType,
          isOrchestrator: data.isOrchestrator,
          orchestratorId: data.orchestratorId,
          isLoading: false,
          error: null,
        });
      } catch (err) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: err instanceof Error ? err.message : 'Unknown error',
        }));
      }
    }

    fetchUserType();
  }, []);

  return state;
}
