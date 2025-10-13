import { TextGenerationError, type ProviderGenerateParams, type TextGenerationResult } from "../types";

const OPENAI_CHAT_COMPLETIONS_URL = "https://api.openai.com/v1/chat/completions";

interface OpenAIChatCompletionResponse {
  choices: Array<{
    message: {
      role: string;
      content?: string;
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
    throw new TextGenerationError("OPENAI_API_KEY environment variable not set", 500);
  }

  const response = await fetch(OPENAI_CHAT_COMPLETIONS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: params.model,
      messages: params.messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
      max_tokens: params.maxTokens,
      temperature: params.temperature,
      top_p: params.topP,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new TextGenerationError(
      `OpenAI API error: ${response.status} ${response.statusText} - ${errorText}`,
      response.status,
    );
  }

  const data = (await response.json()) as OpenAIChatCompletionResponse;
  const text = data.choices?.[0]?.message?.content ?? "";

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
    ...(usage ? { usage } : {}),
    rawResponse: data,
  };
}
