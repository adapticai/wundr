'use client';

import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
} from 'react';

// Types
export type WizardMode = 'chat' | 'edit';

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  metadata?: {
    entityType?: string;
    extractedData?: Partial<ExtractedEntityData>;
  };
}

export interface ExtractedEntityData {
  // Agent fields
  name?: string;
  title?: string;
  department?: string;
  description?: string;
  objective?: string;
  responsibilities?: string[];
  tools?: string[];
  kpis?: string[];

  // Deployment fields
  deploymentName?: string;
  environment?: string;
  region?: string;
  resources?: {
    cpu?: string;
    memory?: string;
    storage?: string;
  };

  // Channel fields
  channelName?: string;
  channelType?: string;
  participants?: string[];

  // Workflow fields
  workflowName?: string;
  trigger?: string;
  actions?: Array<{
    type: string;
    config: Record<string, unknown>;
  }>;

  // Common fields
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface WizardState {
  entityType: 'agent' | 'deployment' | 'channel' | 'workflow' | null;
  mode: WizardMode;
  messages: Message[];
  extractedData: ExtractedEntityData;
  isLoading: boolean;
  error: string | null;
  isDirty: boolean;
  conversationId: string | null;
}

type WizardAction =
  | { type: 'SET_ENTITY_TYPE'; payload: WizardState['entityType'] }
  | { type: 'SET_MODE'; payload: WizardMode }
  | { type: 'ADD_MESSAGE'; payload: Message }
  | { type: 'UPDATE_EXTRACTED_DATA'; payload: Partial<ExtractedEntityData> }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'RESET_WIZARD' }
  | { type: 'RESTORE_STATE'; payload: Partial<WizardState> }
  | { type: 'UPDATE_FIELD'; payload: { field: string; value: unknown } }
  | { type: 'SET_CONVERSATION_ID'; payload: string };

interface WizardContextValue {
  state: WizardState;
  sendMessage: (content: string) => void;
  updateField: (field: string, value: unknown) => void;
  updateExtractedData: (data: Partial<ExtractedEntityData>) => void;
  switchMode: (mode: WizardMode) => void;
  resetWizard: () => void;
  setEntityType: (type: WizardState['entityType']) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setConversationId: (id: string) => void;
}

// Initial state
const initialState: WizardState = {
  entityType: null,
  mode: 'chat',
  messages: [],
  extractedData: {},
  isLoading: false,
  error: null,
  isDirty: false,
  conversationId: null,
};

// Reducer
function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case 'SET_ENTITY_TYPE':
      return {
        ...state,
        entityType: action.payload,
        isDirty: true,
      };

    case 'SET_MODE':
      return {
        ...state,
        mode: action.payload,
      };

    case 'ADD_MESSAGE':
      return {
        ...state,
        messages: [...state.messages, action.payload],
        isDirty: true,
      };

    case 'UPDATE_EXTRACTED_DATA':
      return {
        ...state,
        extractedData: {
          ...state.extractedData,
          ...action.payload,
        },
        isDirty: true,
      };

    case 'UPDATE_FIELD':
      return {
        ...state,
        extractedData: {
          ...state.extractedData,
          [action.payload.field]: action.payload.value,
        },
        isDirty: true,
      };

    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload,
      };

    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload,
        isLoading: false,
      };

    case 'SET_CONVERSATION_ID':
      return {
        ...state,
        conversationId: action.payload,
      };

    case 'RESET_WIZARD':
      return {
        ...initialState,
      };

    case 'RESTORE_STATE':
      return {
        ...state,
        ...action.payload,
        isDirty: false,
      };

    default:
      return state;
  }
}

// Context
const WizardContext = createContext<WizardContextValue | undefined>(undefined);

// Storage helpers
const STORAGE_KEY = 'wizard_draft';
const STORAGE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

interface StoredWizardState extends WizardState {
  timestamp: number;
}

function saveToLocalStorage(state: WizardState): void {
  // Guard against SSR or environments without localStorage
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return;
  }

  try {
    const dataToStore: StoredWizardState = {
      ...state,
      timestamp: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToStore));
  } catch (error) {
    console.error('Failed to save wizard state to localStorage:', error);
  }
}

function loadFromLocalStorage(): Partial<WizardState> | null {
  // Guard against SSR or environments without localStorage
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return null;
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;

    const data: StoredWizardState = JSON.parse(stored);
    const age = Date.now() - data.timestamp;

    // Clear expired data
    if (age > STORAGE_EXPIRY) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { timestamp, ...wizardState } = data;
    return wizardState;
  } catch (error) {
    console.error('Failed to load wizard state from localStorage:', error);
    return null;
  }
}

function clearLocalStorage(): void {
  // Guard against SSR or environments without localStorage
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return;
  }

  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear wizard state from localStorage:', error);
  }
}

// Provider component
interface WizardProviderProps {
  children: React.ReactNode;
  autoRestore?: boolean;
}

export function WizardProvider({
  children,
  autoRestore = true,
}: WizardProviderProps) {
  const [state, dispatch] = useReducer(wizardReducer, initialState);

  // Restore from localStorage on mount
  useEffect(() => {
    if (autoRestore) {
      const stored = loadFromLocalStorage();
      if (stored) {
        dispatch({ type: 'RESTORE_STATE', payload: stored });
      }
    }
  }, [autoRestore]);

  // Auto-save to localStorage when state changes
  useEffect(() => {
    if (state.isDirty) {
      saveToLocalStorage(state);
    }
  }, [state]);

  // Context actions
  const sendMessage = useCallback((content: string) => {
    const message: Message = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
      role: 'user',
      content,
      timestamp: Date.now(),
    };
    dispatch({ type: 'ADD_MESSAGE', payload: message });
  }, []);

  const updateField = useCallback((field: string, value: unknown) => {
    dispatch({ type: 'UPDATE_FIELD', payload: { field, value } });
  }, []);

  const updateExtractedData = useCallback(
    (data: Partial<ExtractedEntityData>) => {
      dispatch({ type: 'UPDATE_EXTRACTED_DATA', payload: data });
    },
    []
  );

  const switchMode = useCallback((mode: WizardMode) => {
    dispatch({ type: 'SET_MODE', payload: mode });
  }, []);

  const resetWizard = useCallback(() => {
    dispatch({ type: 'RESET_WIZARD' });
    clearLocalStorage();
  }, []);

  const setEntityType = useCallback((type: WizardState['entityType']) => {
    dispatch({ type: 'SET_ENTITY_TYPE', payload: type });
  }, []);

  const setLoading = useCallback((loading: boolean) => {
    dispatch({ type: 'SET_LOADING', payload: loading });
  }, []);

  const setError = useCallback((error: string | null) => {
    dispatch({ type: 'SET_ERROR', payload: error });
  }, []);

  const setConversationId = useCallback((id: string) => {
    dispatch({ type: 'SET_CONVERSATION_ID', payload: id });
  }, []);

  const value: WizardContextValue = {
    state,
    sendMessage,
    updateField,
    updateExtractedData,
    switchMode,
    resetWizard,
    setEntityType,
    setLoading,
    setError,
    setConversationId,
  };

  return (
    <WizardContext.Provider value={value}>{children}</WizardContext.Provider>
  );
}

// Hook for consuming the context
export function useWizard(): WizardContextValue {
  const context = useContext(WizardContext);
  if (context === undefined) {
    throw new Error('useWizard must be used within a WizardProvider');
  }
  return context;
}

// Utility hook for checking if wizard has unsaved changes
export function useWizardUnsavedChanges(): boolean {
  const { state } = useWizard();
  return state.isDirty && state.messages.length > 0;
}

// Utility hook for getting wizard completion status
export function useWizardCompletionStatus(): {
  isComplete: boolean;
  canSwitchToEdit: boolean;
  missingRequiredFields: boolean;
} {
  const { state } = useWizard();

  const hasMinimumData = (): boolean => {
    const { extractedData, entityType } = state;

    switch (entityType) {
      case 'agent':
        return !!(
          extractedData.name &&
          extractedData.title &&
          extractedData.description
        );
      case 'deployment':
        return !!(extractedData.deploymentName && extractedData.environment);
      case 'channel':
        return !!(extractedData.channelName && extractedData.channelType);
      case 'workflow':
        return !!(extractedData.workflowName && extractedData.trigger);
      default:
        return false;
    }
  };

  return {
    isComplete: hasMinimumData(),
    canSwitchToEdit: state.messages.length > 0 && hasMinimumData(),
    missingRequiredFields: !hasMinimumData(),
  };
}
