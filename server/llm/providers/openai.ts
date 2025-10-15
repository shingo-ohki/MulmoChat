import {
  TextGenerationError,
  type ProviderGenerateParams,
  type TextGenerationResult,
} from "../types";

const OPENAI_CHAT_COMPLETIONS_URL =
  "https://api.openai.com/v1/chat/completions";

interface OpenAIToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

interface OpenAIChatCompletionResponse {
  choices: Array<{
    message: {
      role: string;
      content?: string;
      tool_calls?: OpenAIToolCall[];
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

export async function generateWithOpenAI(
  params: ProviderGenerateParams,
): Promise<TextGenerationResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new TextGenerationError(
      "OPENAI_API_KEY environment variable not set",
      500,
    );
  }

  const requestBody: Record<string, unknown> = {
    model: params.model,
    messages: params.messages.map((message) => {
      const baseMessage: Record<string, unknown> = {
        role: message.role,
        content: message.content,
      };

      // Include tool_call_id for tool messages
      if (message.role === "tool" && message.tool_call_id) {
        baseMessage.tool_call_id = message.tool_call_id;
      }

      // Include tool_calls for assistant messages
      if (message.role === "assistant" && message.tool_calls) {
        baseMessage.tool_calls = message.tool_calls.map((tc) => ({
          id: tc.id,
          type: "function",
          function: {
            name: tc.name,
            arguments: tc.arguments,
          },
        }));
      }

      return baseMessage;
    }),
  };

  if (params.maxTokens !== undefined) {
    requestBody.max_tokens = params.maxTokens;
  }
  if (params.temperature !== undefined) {
    requestBody.temperature = params.temperature;
  }
  if (params.topP !== undefined) {
    requestBody.top_p = params.topP;
  }
  if (params.tools !== undefined && params.tools.length > 0) {
    // Convert from Realtime API format to Chat Completions format
    requestBody.tools = params.tools.map((tool) => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));
  }

  const response = await fetch(OPENAI_CHAT_COMPLETIONS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new TextGenerationError(
      `OpenAI API error: ${response.status} ${response.statusText} - ${errorText}`,
      response.status,
    );
  }

  const data = (await response.json()) as OpenAIChatCompletionResponse;
  const message = data.choices?.[0]?.message;
  const text = message?.content ?? "";
  const toolCalls = message?.tool_calls?.map((tc) => ({
    id: tc.id,
    name: tc.function.name,
    arguments: tc.function.arguments,
  }));

  const usage = data.usage
    ? {
        promptTokens: data.usage.prompt_tokens ?? 0,
        completionTokens: data.usage.completion_tokens ?? 0,
        totalTokens: data.usage.total_tokens ?? 0,
      }
    : undefined;

  return {
    provider: "openai",
    model: params.model,
    text,
    ...(toolCalls && toolCalls.length > 0 ? { toolCalls } : {}),
    ...(usage ? { usage } : {}),
    rawResponse: data,
  };
}
