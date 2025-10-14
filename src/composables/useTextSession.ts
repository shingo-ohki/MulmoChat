import { ref } from "vue";
import type { StartApiResponse } from "../../server/types";
import {
  type RealtimeSessionEventHandlers,
  type RealtimeSessionOptions,
  type UseRealtimeSessionReturn,
} from "./useRealtimeSession";
import { resolveTextModelId, DEFAULT_TEXT_MODEL } from "../config/textModels";

interface TextMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface QueuedToolOutput {
  callId: string;
  output: string;
}

export type UseTextSessionOptions = RealtimeSessionOptions;
export type UseTextSessionReturn = UseRealtimeSessionReturn;

let fallbackCallIdCounter = 0;

const createCallId = () =>
  globalThis.crypto?.randomUUID?.() ??
  `text-${Date.now()}-${++fallbackCallIdCounter}`;

async function fetchStartResponse(): Promise<StartApiResponse | null> {
  try {
    const response = await fetch("/api/start", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }

    return (await response.json()) as StartApiResponse;
  } catch (error) {
    console.warn("Failed to fetch start response for text session", error);
    return null;
  }
}

function buildSystemMessages(
  instructions: string,
  queuedInstructions: readonly string[],
  queuedOutputs: readonly QueuedToolOutput[],
): TextMessage[] {
  const messages: TextMessage[] = [];

  const trimmedInstructions = instructions.trim();
  if (trimmedInstructions) {
    messages.push({ role: "system", content: trimmedInstructions });
  }

  for (const pending of queuedInstructions) {
    const trimmed = pending.trim();
    if (trimmed) {
      messages.push({ role: "system", content: trimmed });
    }
  }

  for (const output of queuedOutputs) {
    const content = `Tool output (${output.callId}): ${output.output}`;
    messages.push({ role: "system", content });
  }

  return messages;
}

export function useTextSession(
  options: UseTextSessionOptions,
): UseTextSessionReturn {
  let handlers: RealtimeSessionEventHandlers = {
    ...(options.handlers ?? {}),
  };

  const registerEventHandlers = (
    newHandlers: Partial<RealtimeSessionEventHandlers>,
  ) => {
    handlers = {
      ...handlers,
      ...newHandlers,
    };
  };

  const chatActive = ref(false);
  const conversationActive = ref(false);
  const connecting = ref(false);
  const isMuted = ref(false);
  const startResponse = ref<StartApiResponse | null>(null);
  const conversationMessages = ref<TextMessage[]>([]);
  const queuedInstructions = ref<string[]>([]);
  const queuedToolOutputs = ref<QueuedToolOutput[]>([]);

  const ensureStartResponse = async () => {
    if (startResponse.value) return;
    const result = await fetchStartResponse();
    if (result) {
      startResponse.value = result;
    }
  };

  const startChat = async () => {
    if (chatActive.value || connecting.value) return;

    connecting.value = true;
    try {
      await ensureStartResponse();
      chatActive.value = true;
    } catch (error) {
      handlers.onError?.(error);
    } finally {
      connecting.value = false;
    }
  };

  const stopChat = () => {
    chatActive.value = false;
    conversationActive.value = false;
    conversationMessages.value = [];
    queuedInstructions.value = [];
    queuedToolOutputs.value = [];
  };

  const sendUserMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) {
      return false;
    }

    if (!chatActive.value) {
      await startChat();
      if (!chatActive.value) {
        return false;
      }
    }

    await ensureStartResponse();

    const instructions = options.buildInstructions({
      startResponse: startResponse.value,
    });

    const consumedInstructionCount = queuedInstructions.value.length;
    const consumedOutputCount = queuedToolOutputs.value.length;
    const pendingInstructions = queuedInstructions.value.slice();
    const pendingOutputs = queuedToolOutputs.value.slice();

    const systemMessages = buildSystemMessages(
      instructions,
      pendingInstructions,
      pendingOutputs,
    );

    const { provider, model } = resolveTextModelId(
      options.getModelId?.({ startResponse: startResponse.value }) ??
        DEFAULT_TEXT_MODEL.rawId,
    );

    const messages: TextMessage[] = [
      ...systemMessages,
      ...conversationMessages.value,
      { role: "user", content: trimmed },
    ];

    conversationActive.value = true;
    handlers.onConversationStarted?.();

    try {
      const response = await fetch("/api/text/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          provider,
          model,
          messages,
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      const payload = (await response.json()) as {
        success?: boolean;
        result?: { text?: string };
        error?: unknown;
        details?: unknown;
      };

      if (!payload.success || !payload.result?.text) {
        throw new Error(
          typeof payload.error === "string"
            ? payload.error
            : "Text generation failed",
        );
      }

      const assistantText = payload.result.text;

      handlers.onTextDelta?.(assistantText);
      handlers.onTextCompleted?.();

      conversationMessages.value = [
        ...conversationMessages.value,
        { role: "user", content: trimmed },
        { role: "assistant", content: assistantText },
      ];

      if (queuedInstructions.value.length === consumedInstructionCount) {
        queuedInstructions.value = [];
      } else if (consumedInstructionCount > 0) {
        queuedInstructions.value = queuedInstructions.value.slice(
          consumedInstructionCount,
        );
      }

      if (queuedToolOutputs.value.length === consumedOutputCount) {
        queuedToolOutputs.value = [];
      } else if (consumedOutputCount > 0) {
        queuedToolOutputs.value =
          queuedToolOutputs.value.slice(consumedOutputCount);
      }

      const callId = createCallId();
      handlers.onToolCall?.(
        {
          type: "response.function_call_arguments.done",
          name: "text-response",
          call_id: callId,
        },
        callId,
        JSON.stringify({
          text: assistantText,
          role: "assistant",
          transportKind: "text-rest",
        }),
      );

      return true;
    } catch (error) {
      console.error("Text session request failed", error);
      handlers.onError?.(error);
      return false;
    } finally {
      conversationActive.value = false;
      handlers.onConversationFinished?.();
    }
  };

  const sendFunctionCallOutput = (callId: string, output: string) => {
    queuedToolOutputs.value = [
      ...queuedToolOutputs.value,
      {
        callId,
        output,
      },
    ];
    return true;
  };

  const sendInstructions = (instructions: string) => {
    queuedInstructions.value = [...queuedInstructions.value, instructions];
    return true;
  };

  const isDataChannelOpen = () => !conversationActive.value;

  const setMute = (muted: boolean) => {
    isMuted.value = muted;
  };

  const setLocalAudioEnabled: UseRealtimeSessionReturn["setLocalAudioEnabled"] =
    (__enabled) => {
      /* Text session does not manage local audio */
    };

  const attachRemoteAudioElement: UseRealtimeSessionReturn["attachRemoteAudioElement"] =
    (__audio) => {
      /* No remote audio for text session */
    };

  return {
    chatActive,
    conversationActive,
    connecting,
    isMuted,
    startResponse,
    isDataChannelOpen,
    startChat,
    stopChat,
    sendUserMessage,
    sendFunctionCallOutput,
    sendInstructions,
    setMute,
    setLocalAudioEnabled,
    attachRemoteAudioElement,
    registerEventHandlers,
  };
}
