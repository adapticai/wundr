import type { ReactNode } from 'react';

export type ChatVariant = 'fullscreen' | 'panel' | 'dialog' | 'embedded';

export interface ChatPersona {
  name: string;
  avatar?: { src?: string; fallback?: string };
  greeting: string;
  suggestions?: string[];
  systemContext?: string;
}

export interface ProgressConfig {
  enabled: boolean;
  requiredFields: string[];
  optionalFields?: string[];
  labels?: Record<string, string>;
}

export interface UnifiedChatConfig {
  apiEndpoint: string;
  entityType?: string;
  variant: ChatVariant;
  persona: ChatPersona;
  progress?: ProgressConfig;
  showToolCalls?: boolean;
  showReasoning?: boolean;
  enableAttachments?: boolean;
  enableFeedback?: boolean;
  enableActions?: boolean;
  requestBody?: Record<string, unknown>;
  maxHeight?: string;
  onDataExtracted?: (data: Record<string, unknown>) => void;
  onReadyToCreate?: (data: Record<string, unknown>) => void;
}

export interface ExtractedData {
  fields: Record<string, unknown>;
  completionPercent: number;
  isReady: boolean;
  history: Array<{ timestamp: Date; fields: string[] }>;
}

// Suppress unused import warning — ReactNode may be used by consumers
export type { ReactNode };
