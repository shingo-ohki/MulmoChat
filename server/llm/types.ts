export type TextLLMProviderId = "openai" | "anthropic" | "google" | "ollama";

export interface TextMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ToolDefinition {
  type: "function";
  name: string;
  description?: string;
  parameters?: unknown;
}

export interface TextGenerationRequest {
  provider: TextLLMProviderId;
  model: string;
  messages: TextMessage[];
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  tools?: ToolDefinition[];
}

export interface ProviderGenerateParams {
  model: string;
  messages: TextMessage[];
  conversationMessages: TextMessage[];
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  tools?: ToolDefinition[];
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: string;
}

export interface TextGenerationResult {
  provider: TextLLMProviderId;
  model: string;
  text: string;
  toolCalls?: ToolCall[];
  usage?: Record<string, number>;
  rawResponse?: unknown;
}

export interface ProviderAvailability {
  provider: TextLLMProviderId;
  hasCredentials: boolean;
  defaultModel?: string;
  models?: string[];
}

export interface QueuedToolOutputPayload {
  callId: string;
  output: string;
  addedAt: number;
}

export interface TextSessionDefaults {
  maxTokens?: number;
  temperature?: number;
  topP?: number;
}

export interface TextSessionSnapshot {
  id: string;
  provider: TextLLMProviderId;
  model: string;
  messages: TextMessage[];
  queuedInstructions: string[];
  queuedToolOutputs: QueuedToolOutputPayload[];
  defaults: TextSessionDefaults;
  tools?: ToolDefinition[];
  createdAt: number;
  updatedAt: number;
}

export class TextGenerationError extends Error {
  statusCode: number | undefined;

  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = "TextGenerationError";
    this.statusCode = statusCode;
  }
}
