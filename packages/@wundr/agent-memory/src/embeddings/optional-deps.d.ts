/**
 * Type declarations for optional peer dependencies.
 * These modules are dynamically imported and may not be installed.
 */

declare module '@huggingface/transformers' {
  export function pipeline(
    task: string,
    model: string,
    options?: Record<string, unknown>
  ): Promise<
    (
      text: string,
      options?: Record<string, unknown>
    ) => Promise<{ data: Float32Array }>
  >;
}

declare module 'node-llama-cpp' {
  export enum LlamaLogLevel {
    error = 'error',
  }
  export function getLlama(options?: Record<string, unknown>): Promise<{
    loadModel(options: { modelPath: string }): Promise<{
      createEmbeddingContext(): Promise<{
        getEmbeddingFor(text: string): Promise<{ vector: Float32Array }>;
      }>;
      close?: () => void;
    }>;
    close?: () => void;
  }>;
  export function resolveModelFile(
    modelPath: string,
    cacheDir?: string
  ): Promise<string>;
}
