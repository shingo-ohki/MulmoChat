export type TextLLMProviderId = "openai" | "anthropic" | "google" | "ollama";

export interface TextMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface TextGenerationRequest {
  provider: TextLLMProviderId;
  model: string;
  messages: TextMessage[];
  maxTokens?: number;
  temperature?: number;
  topP?: number;
}

export interface ProviderGenerateParams {
  model: string;
  messages: TextMessage[];
  conversationMessages: TextMessage[];
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
}

export interface TextGenerationResult {
  provider: TextLLMProviderId;
  model: string;
  text: string;
  usage?: Record<string, number>;
  rawResponse?: unknown;
}

export interface ProviderAvailability {
  provider: TextLLMProviderId;
  hasCredentials: boolean;
  defaultModel?: string;
  models?: string[];
}

export class TextGenerationError extends Error {
  statusCode: number | undefined;

  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = "TextGenerationError";
    this.statusCode = statusCode;
  }
}
