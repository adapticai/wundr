/**
 * AI Configuration
 * Settings for AI models and system prompts
 */

export const AI_CONFIG = {
  defaultModel: 'claude-sonnet-4-20250514',
  maxTokens: 4096,
  temperature: 0.7,
  systemPrompts: {
    workspace: `You are an AI assistant helping users create and manage workspaces.
Your role is to extract workspace information from natural language and guide users through the setup process.
Be concise, helpful, and ask clarifying questions when needed.`,

    orchestrator: `You are an AI assistant helping users configure orchestrators.
Your role is to understand orchestration requirements and help design effective automation flows.
Focus on extracting key configuration parameters and suggesting best practices.`,

    'session-manager': `You are an AI assistant helping users manage sessions.
Your role is to understand session requirements and help configure session management settings.
Be clear about data retention, timeout policies, and security considerations.`,
  },
} as const;

export type SystemPromptKey = keyof typeof AI_CONFIG.systemPrompts;

/**
 * Get system prompt for a specific entity type
 */
export function getSystemPrompt(entityType: SystemPromptKey): string {
  return (
    AI_CONFIG.systemPrompts[entityType] || AI_CONFIG.systemPrompts.workspace
  );
}

/**
 * Get default chat configuration
 */
export function getDefaultChatConfig() {
  return {
    model: AI_CONFIG.defaultModel,
    maxTokens: AI_CONFIG.maxTokens,
    temperature: AI_CONFIG.temperature,
  };
}
