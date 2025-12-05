/**
 * AI Assistant Widget Store
 *
 * Manages the state of the floating AI assistant widget including:
 * - Widget open/closed state
 * - Widget position (draggable)
 * - Widget size (minimized/maximized)
 * - User preferences persistence
 * - Active conversation context
 *
 * @module lib/stores/widget-store
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

/**
 * Widget position on screen
 */
export interface WidgetPosition {
  x: number;
  y: number;
}

/**
 * Widget size state
 */
export type WidgetSize = 'minimized' | 'normal' | 'maximized';

/**
 * Quick action definition
 */
export interface QuickAction {
  id: string;
  label: string;
  icon: string;
  prompt: string;
  category?: string;
}

/**
 * Widget store state
 */
interface WidgetState {
  // Display state
  isOpen: boolean;
  size: WidgetSize;
  position: WidgetPosition | null;

  // Conversation state
  activeConversationId: string | null;
  contextData: Record<string, unknown> | null;

  // Quick actions
  quickActions: QuickAction[];

  // User preferences
  preferences: {
    autoOpen: boolean;
    rememberPosition: boolean;
    showQuickActions: boolean;
    defaultSize: WidgetSize;
  };

  // Actions
  open: () => void;
  close: () => void;
  toggle: () => void;
  setSize: (size: WidgetSize) => void;
  minimize: () => void;
  maximize: () => void;
  setPosition: (position: WidgetPosition) => void;
  resetPosition: () => void;
  setActiveConversation: (conversationId: string | null) => void;
  setContextData: (data: Record<string, unknown> | null) => void;
  updatePreferences: (preferences: Partial<WidgetState['preferences']>) => void;
  addQuickAction: (action: QuickAction) => void;
  removeQuickAction: (actionId: string) => void;
  reset: () => void;
}

/**
 * Default position (bottom-right corner)
 */
const DEFAULT_POSITION: WidgetPosition = {
  x: typeof window !== 'undefined' ? window.innerWidth - 420 : 0,
  y: typeof window !== 'undefined' ? window.innerHeight - 600 : 0,
};

/**
 * Default quick actions
 */
const DEFAULT_QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'explain-code',
    label: 'Explain Code',
    icon: 'Code',
    prompt: 'Explain this code to me',
    category: 'development',
  },
  {
    id: 'write-tests',
    label: 'Write Tests',
    icon: 'TestTube',
    prompt: 'Help me write tests for this',
    category: 'development',
  },
  {
    id: 'debug-issue',
    label: 'Debug Issue',
    icon: 'Bug',
    prompt: 'Help me debug this issue',
    category: 'development',
  },
  {
    id: 'improve-code',
    label: 'Improve Code',
    icon: 'Sparkles',
    prompt: 'Suggest improvements for this code',
    category: 'development',
  },
  {
    id: 'summarize',
    label: 'Summarize',
    icon: 'FileText',
    prompt: 'Summarize this for me',
    category: 'productivity',
  },
  {
    id: 'translate',
    label: 'Translate',
    icon: 'Languages',
    prompt: 'Translate this',
    category: 'productivity',
  },
];

/**
 * Initial state
 */
const initialState = {
  isOpen: false,
  size: 'normal' as WidgetSize,
  position: null,
  activeConversationId: null,
  contextData: null,
  quickActions: DEFAULT_QUICK_ACTIONS,
  preferences: {
    autoOpen: false,
    rememberPosition: true,
    showQuickActions: true,
    defaultSize: 'normal' as WidgetSize,
  },
};

/**
 * AI Assistant Widget Store
 */
export const useWidgetStore = create<WidgetState>()(
  devtools(
    persist(
      (set, get) => ({
        ...initialState,

        open: () => {
          const { preferences } = get();
          set({
            isOpen: true,
            size: preferences.defaultSize,
          });
        },

        close: () => {
          set({ isOpen: false });
        },

        toggle: () => {
          const { isOpen } = get();
          if (isOpen) {
            get().close();
          } else {
            get().open();
          }
        },

        setSize: size => {
          set({ size });
        },

        minimize: () => {
          set({ size: 'minimized' });
        },

        maximize: () => {
          set({ size: 'maximized' });
        },

        setPosition: position => {
          set({ position });
        },

        resetPosition: () => {
          set({ position: DEFAULT_POSITION });
        },

        setActiveConversation: conversationId => {
          set({ activeConversationId: conversationId });
        },

        setContextData: data => {
          set({ contextData: data });
        },

        updatePreferences: preferences => {
          set(state => ({
            preferences: {
              ...state.preferences,
              ...preferences,
            },
          }));
        },

        addQuickAction: action => {
          set(state => ({
            quickActions: [...state.quickActions, action],
          }));
        },

        removeQuickAction: actionId => {
          set(state => ({
            quickActions: state.quickActions.filter(a => a.id !== actionId),
          }));
        },

        reset: () => {
          set(initialState);
        },
      }),
      {
        name: 'ai-widget-store',
        partialize: state => ({
          position: state.preferences.rememberPosition ? state.position : null,
          preferences: state.preferences,
          quickActions: state.quickActions,
        }),
      }
    ),
    { name: 'WidgetStore' }
  )
);

/**
 * Selectors
 */
export const selectIsOpen = (state: WidgetState) => state.isOpen;
export const selectSize = (state: WidgetState) => state.size;
export const selectPosition = (state: WidgetState) =>
  state.position || DEFAULT_POSITION;
export const selectQuickActions = (state: WidgetState) => state.quickActions;
export const selectPreferences = (state: WidgetState) => state.preferences;
