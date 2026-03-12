export type { TaskName } from '../config';

export interface CompletionRequest {
  prefix: string;
  suffix: string;
  language: string;
  filePath: string;
  maxTokens: number;
  temperature: number;
  ragContext?: string | undefined;
}

export interface CompletionResponse {
  text: string;
  finishReason: string;
}

export interface ProviderConfig {
  endpoint: string;
  model: string;
  apiKeyEnv: string; // env var NAME, not the value
}

export interface Provider {
  name: string;
  defaultEndpoint: string;
  defaultModel: string;
  buildShellCommand(request: CompletionRequest, config: ProviderConfig): string;
  parseResponse(stdout: string): CompletionResponse | null;
}

export interface EmbeddingRequest {
  input: string[];
  model: string;
}

export interface EmbeddingResponse {
  embeddings: (number[] | null)[];
}

export interface EmbeddingProvider {
  name: string;
  defaultEndpoint: string;
  defaultModel: string;
  buildShellCommand(request: EmbeddingRequest, config: ProviderConfig): string;
  parseResponse(stdout: string): EmbeddingResponse | null;
}
