import { GoogleGenAI } from "@google/genai";
import {
  TextGenerationError,
  type ProviderGenerateParams,
  type TextGenerationResult,
  type TextMessage,
  type ToolCall,
} from "../types";

type GeminiRole = "user" | "model";

type GeminiPart =
  | { text: string }
  | { functionCall: { name: string; args: Record<string, unknown> } }
  | { functionResponse: { name: string; response: Record<string, unknown> } };

type GeminiContent = {
  role: GeminiRole;
  parts: GeminiPart[];
};

function toGeminiRole(role: TextMessage["role"]): GeminiRole {
  return role === "assistant" ? "model" : "user";
}

function toGeminiMessages(messages: TextMessage[]): GeminiContent[] {
  return messages.map((message) => {
    const role = toGeminiRole(message.role);
    const parts: GeminiPart[] = [];

    // Handle tool result messages
    if (message.role === "tool" && message.tool_call_id) {
      // Extract function name from the assistant's tool call
      // We need to find the corresponding tool call to get the function name
      // For now, we'll include it in the response
      parts.push({
        functionResponse: {
          name: message.tool_call_id, // This should be the function name
          response: { result: message.content },
        },
      });
    }
    // Handle assistant messages with tool calls
    else if (message.role === "assistant" && message.tool_calls) {
      if (message.content) {
        parts.push({ text: message.content });
      }
      for (const toolCall of message.tool_calls) {
        parts.push({
          functionCall: {
            name: toolCall.name,
            args: JSON.parse(toolCall.arguments),
          },
        });
      }
    }
    // Regular text messages
    else {
      parts.push({ text: message.content });
    }

    return { role, parts };
  });
}

function extractTextFromCandidates(candidates: unknown): string {
  if (!Array.isArray(candidates)) return "";
  for (const candidate of candidates) {
    const content = (
      candidate as { content?: { parts?: Array<{ text?: string }> } }
    ).content;
    const parts = content?.parts;
    if (!Array.isArray(parts)) continue;
    for (const part of parts) {
      if (part?.text) {
        return part.text;
      }
    }
  }
  return "";
}

function extractToolCallsFromCandidates(candidates: unknown): ToolCall[] {
  const toolCalls: ToolCall[] = [];
  if (!Array.isArray(candidates)) return toolCalls;

  for (const candidate of candidates) {
    const content = (
      candidate as {
        content?: {
          parts?: Array<{
            functionCall?: { name: string; args: Record<string, unknown> };
          }>;
        };
      }
    ).content;
    const parts = content?.parts;
    if (!Array.isArray(parts)) continue;

    for (const part of parts) {
      if (part?.functionCall) {
        toolCalls.push({
          id: `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: part.functionCall.name,
          arguments: JSON.stringify(part.functionCall.args),
        });
      }
    }
  }

  return toolCalls;
}

function normalizeModelId(model: string): string {
  if (model.startsWith("models/")) {
    return model;
  }
  return `models/${model}`;
}

export async function generateWithGoogle(
  params: ProviderGenerateParams,
): Promise<TextGenerationResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new TextGenerationError(
      "GEMINI_API_KEY environment variable not set",
      500,
    );
  }

  const ai = new GoogleGenAI({ apiKey });

  const contents = toGeminiMessages(params.conversationMessages);

  const generationConfigEntries: Array<[string, number]> = [];
  if (params.maxTokens !== undefined) {
    generationConfigEntries.push(["maxOutputTokens", params.maxTokens]);
  }
  if (params.temperature !== undefined) {
    generationConfigEntries.push(["temperature", params.temperature]);
  }
  if (params.topP !== undefined) {
    generationConfigEntries.push(["topP", params.topP]);
  }

  const requestBody: Record<string, unknown> = {
    model: normalizeModelId(params.model),
    contents,
  };

  // Use systemInstruction parameter for system prompts (Gemini-specific)
  if (params.systemPrompt) {
    requestBody.systemInstruction = params.systemPrompt;
  }

  // Build config object for generation settings, tools, and toolConfig
  const config: Record<string, unknown> = {};

  if (generationConfigEntries.length > 0) {
    config.generationConfig = Object.fromEntries(generationConfigEntries);
  }

  // Add tools if provided - tools and toolConfig go inside config object
  if (params.tools !== undefined && params.tools.length > 0) {
    config.tools = [
      {
        functionDeclarations: params.tools.map((tool) => ({
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        })),
      },
    ];

    // Configure tool calling mode
    const allowedFunctionNames = params.tools.map((tool) => tool.name);
    config.toolConfig = {
      functionCallingConfig: {
        mode: "ANY", // AUTO, ANY, or NONE
        allowedFunctionNames, // Explicitly list which functions can be called
      },
    };
  }

  // Add config to request body if it has any settings
  if (Object.keys(config).length > 0) {
    requestBody.config = config;
  }

  const response = await ai.models.generateContent(requestBody as any);

  const text = extractTextFromCandidates(response.candidates) ?? "";
  const toolCalls = extractToolCallsFromCandidates(response.candidates);

  const usageMetadata = response.usageMetadata;
  const usage = usageMetadata
    ? {
        inputTokens: usageMetadata.promptTokenCount ?? 0,
        outputTokens: usageMetadata.candidatesTokenCount ?? 0,
        totalTokens: usageMetadata.totalTokenCount ?? 0,
      }
    : undefined;

  return {
    provider: "google",
    model: params.model,
    text,
    ...(toolCalls.length > 0 ? { toolCalls } : {}),
    ...(usage ? { usage } : {}),
    rawResponse: response,
  };
}
