import Anthropic from "@anthropic-ai/sdk";
import type { MessageCreateParamsNonStreaming } from "@anthropic-ai/sdk/resources/messages";
import {
  TextGenerationError,
  type ProviderGenerateParams,
  type TextGenerationResult,
  type TextMessage,
} from "../types";

type AnthropicRole = "user" | "assistant";

function toAnthropicMessages(messages: TextMessage[]) {
  return messages.map((message) => {
    const role: AnthropicRole =
      message.role === "assistant" ? "assistant" : "user";
    return {
      role,
      content: [
        {
          type: "text" as const,
          text: message.content,
        },
      ],
    };
  });
}

export async function generateWithAnthropic(
  params: ProviderGenerateParams,
): Promise<TextGenerationResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new TextGenerationError(
      "ANTHROPIC_API_KEY environment variable not set",
      500,
    );
  }

  const client = new Anthropic({ apiKey });

  const messageParams: MessageCreateParamsNonStreaming = {
    model: params.model,
    max_tokens: params.maxTokens ?? 1024,
    messages: toAnthropicMessages(params.conversationMessages),
  };

  if (params.temperature !== undefined) {
    messageParams.temperature = params.temperature;
  }
  if (params.topP !== undefined) {
    messageParams.top_p = params.topP;
  }
  if (params.systemPrompt) {
    messageParams.system = params.systemPrompt;
  }

  const response = await client.messages.create(messageParams);

  const text = response.content
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("");

  const usage = response.usage
    ? {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        totalTokens:
          (response.usage.input_tokens ?? 0) +
          (response.usage.output_tokens ?? 0),
      }
    : undefined;

  return {
    provider: "anthropic",
    model: params.model,
    text,
    ...(usage ? { usage } : {}),
    rawResponse: response,
  };
}
