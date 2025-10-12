import type { Ref } from "vue";

export type SessionStatus = "idle" | "connecting" | "connected" | "error";

export interface SessionCapabilities {
  audio: boolean;
  tools: boolean;
  streaming: boolean;
}

export interface SessionConnectOptions {
  // Placeholder for adapter-specific connection data (prompts, keys, etc.).
  [key: string]: unknown;
}

export interface SessionToolOutputPayload {
  callId: string;
  output: string;
}

export interface SessionEventHandlers {
  onTextDelta?: (delta: string) => void;
  onTextCompleted?: () => void;
  onToolCallArgumentsDelta?: (callId: string, delta: string) => void;
  onToolCallArgumentsDone?: (
    callId: string,
    args: string,
    meta: { truncated: boolean; name?: string; rawMessage?: unknown },
  ) => void;
  onConversationCreated?: () => void;
  onConversationFinished?: () => void;
  onError?: (error: unknown) => void;
  onSpeechStarted?: () => void;
  onSpeechStopped?: () => void;
  onDataChannelOpened?: () => void;
}

export interface SessionAdapter {
  status: Ref<SessionStatus>;
  capabilities: SessionCapabilities;
  registerEventHandlers: (handlers: Partial<SessionEventHandlers>) => void;
  connect: (options: SessionConnectOptions) => Promise<void>;
  disconnect: () => void;
  sendUserMessage: (content: string) => Promise<void>;
  sendToolOutput: (payload: SessionToolOutputPayload) => Promise<void>;
  setAudioEnabled: (enabled: boolean) => void;
}
