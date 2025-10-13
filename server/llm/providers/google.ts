import { GoogleGenAI } from "@google/genai";
import { TextGenerationError, type ProviderGenerateParams, type TextGenerationResult, type TextMessage } from "../types";

type GeminiRole = "user" | "model";

type GeminiContent = {
  role: GeminiRole;
  parts: Array<{ text: string }>;
};

function toGeminiRole(role: TextMessage["role"]): GeminiRole {
  return role === "assistant" ? "model" : "user";
}

function extractPrimaryText(candidates: unknown): string {
  if (!Array.isArray(candidates)) return "";
  for (const candidate of candidates) {
    const content = (candidate as { content?: { parts?: Array<{ text?: string }> } }).content;
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

  const contents: GeminiContent[] = params.conversationMessages.map((message) => ({
    role: toGeminiRole(message.role),
    parts: [{ text: message.content }],
  }));

  if (params.systemPrompt) {
    contents.unshift({
      role: "user",
      parts: [{ text: params.systemPrompt }],
    });
  }

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

  if (generationConfigEntries.length > 0) {
    requestBody.generationConfig = Object.fromEntries(generationConfigEntries);
  }

  const response = await ai.models.generateContent(requestBody as any);

  const text = extractPrimaryText(response.candidates) ?? "";
  const usageMetadata = (response.response ?? response)?.usageMetadata;
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
    ...(usage ? { usage } : {}),
    rawResponse: response,
  };
}
