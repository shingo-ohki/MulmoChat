import {
  TextGenerationError,
  type ProviderGenerateParams,
  type TextGenerationResult,
  type ToolCall,
} from "../types";

interface OllamaToolCall {
  function: {
    name: string;
    arguments: Record<string, unknown>;
  };
}

interface OllamaChatResponse {
  message?: {
    role?: string;
    content?: string;
    tool_calls?: OllamaToolCall[];
  };
  response?: string;
  model?: string;
  total_duration?: number;
  load_duration?: number;
}

function getOllamaBaseUrl(): string {
  return (
    process.env.OLLAMA_BASE_URL?.replace(/\/?$/, "") ?? "http://127.0.0.1:11434"
  );
}

export async function generateWithOllama(
  params: ProviderGenerateParams,
): Promise<TextGenerationResult> {
  const baseUrl = getOllamaBaseUrl();

  const requestBody: Record<string, unknown> = {
    model: params.model,
    stream: false,
    messages: params.messages.map((message) => {
      const baseMessage: Record<string, unknown> = {
        role: message.role,
        content: message.content,
      };

      // Include tool_call_id for tool messages
      if (message.role === "tool" && message.tool_call_id) {
        // Ollama doesn't have native tool_call_id support, format in content
        baseMessage.content = `Tool result for ${message.tool_call_id}: ${message.content}`;
      }

      // Include tool_calls for assistant messages
      if (message.role === "assistant" && message.tool_calls) {
        baseMessage.tool_calls = message.tool_calls.map((tc) => ({
          function: {
            name: tc.name,
            arguments: JSON.parse(tc.arguments),
          },
        }));
      }

      return baseMessage;
    }),
    options: {
      temperature: params.temperature,
      num_predict: params.maxTokens,
      top_p: params.topP,
    },
  };

  // Add tools if provided (Ollama supports OpenAI-compatible tool format)
  if (params.tools !== undefined && params.tools.length > 0) {
    requestBody.tools = params.tools.map((tool) => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));
  }

  const response = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new TextGenerationError(
      `Ollama API error: ${response.status} ${response.statusText} - ${errorText}`,
      response.status,
    );
  }

  const data = (await response.json()) as OllamaChatResponse;
  const text = data.message?.content ?? data.response ?? "";

  // Extract tool calls if present
  const toolCalls: ToolCall[] = [];
  if (data.message?.tool_calls) {
    for (const tc of data.message.tool_calls) {
      toolCalls.push({
        id: `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: tc.function.name,
        arguments: JSON.stringify(tc.function.arguments),
      });
    }
  }

  return {
    provider: "ollama",
    model: params.model,
    text,
    ...(toolCalls.length > 0 ? { toolCalls } : {}),
    rawResponse: data,
  };
}
