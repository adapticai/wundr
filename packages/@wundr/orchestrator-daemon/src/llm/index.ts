/**
 * LLM Client Exports
 *
 * Central export point for LLM clients used in the orchestrator-daemon.
 */

export { OpenAIClient, createOpenAIClient } from './openai-client';
export type { OpenAIClientConfig } from './openai-client';

// Direct OpenAI SDK wrapper (backup to @adaptic/lumic-utils)
export { llmCall, createLLMCall } from './direct-openai';
export type { LLMCallParams, LLMCallResponse } from './direct-openai';
