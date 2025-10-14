import {
  TextGenerationError,
  type ProviderGenerateParams,
  type TextGenerationResult,
} from "../types";

interface OllamaChatResponse {
  message?: {
    role?: string;
    content?: string;
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
  const response = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: params.model,
      stream: false,
      messages: params.messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
      options: {
        temperature: params.temperature,
        num_predict: params.maxTokens,
        top_p: params.topP,
      },
    }),
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

  return {
    provider: "ollama",
    model: params.model,
    text,
    rawResponse: data,
  };
}
