import { Router, Request, Response } from "express";
import { generateText, getProviderAvailability } from "../llm/textService";
import {
  TextGenerationError,
  type TextGenerationRequest,
  type TextLLMProviderId,
  type TextMessage,
} from "../llm/types";

const router = Router();

function isProviderId(value: unknown): value is TextLLMProviderId {
  return value === "openai" || value === "anthropic" || value === "google" || value === "ollama";
}

function parseMessages(value: unknown): TextMessage[] {
  if (!Array.isArray(value)) {
    throw new TextGenerationError("messages must be an array", 400);
  }

  return value.map((message) => {
    if (!message || typeof message !== "object") {
      throw new TextGenerationError("Each message must be an object", 400);
    }

    const role = (message as { role?: unknown }).role;
    const content = (message as { content?: unknown }).content;

    if (typeof role !== "string" || typeof content !== "string") {
      throw new TextGenerationError(
        "Each message must include string role and content",
        400,
      );
    }

    if (role !== "system" && role !== "user" && role !== "assistant") {
      throw new TextGenerationError(`Unsupported message role: ${role}`, 400);
    }

    return {
      role: role as TextMessage["role"],
      content,
    };
  });
}

router.get("/text/providers", (_req: Request, res: Response) => {
  res.json({
    success: true,
    providers: getProviderAvailability(),
  });
});

router.post("/text/generate", async (req: Request, res: Response) => {
  try {
    const { provider, model, messages, maxTokens, temperature, topP } =
      req.body as Partial<TextGenerationRequest> & { messages: unknown };

    if (!isProviderId(provider)) {
      throw new TextGenerationError("Unsupported provider", 400);
    }

    if (typeof model !== "string" || model.trim().length === 0) {
      throw new TextGenerationError("Model is required", 400);
    }

    const parsedMessages = parseMessages(messages);

    const requestPayload: TextGenerationRequest = {
      provider,
      model,
      messages: parsedMessages,
    };

    if (typeof maxTokens === "number") {
      requestPayload.maxTokens = maxTokens;
    }
    if (typeof temperature === "number") {
      requestPayload.temperature = temperature;
    }
    if (typeof topP === "number") {
      requestPayload.topP = topP;
    }

    const result = await generateText(requestPayload);

    res.json({
      success: true,
      result,
    });
  } catch (error: unknown) {
    if (error instanceof TextGenerationError) {
      res.status(error.statusCode ?? 400).json({
        success: false,
        error: error.message,
      });
      return;
    }

    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({
      success: false,
      error: "Failed to generate text",
      details: errorMessage,
    });
  }
});

export default router;
