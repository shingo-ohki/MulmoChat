import { ref } from "vue";
import type {
  SessionAdapter,
  SessionCapabilities,
  SessionConnectOptions,
  SessionEventHandlers,
  SessionStatus,
  SessionToolOutputPayload,
} from "./types";

const realtimeCapabilities: SessionCapabilities = {
  audio: true,
  tools: true,
  streaming: true,
};

export function createRealtimeWebRtcSession(): SessionAdapter {
  const status = ref<SessionStatus>("idle");
  let handlers: Partial<SessionEventHandlers> = {};

  return {
    status,
    capabilities: realtimeCapabilities,
    registerEventHandlers(newHandlers: Partial<SessionEventHandlers>) {
      handlers = { ...handlers, ...newHandlers };
    },
    async connect(options: SessionConnectOptions): Promise<void> {
      void options;
      status.value = "connecting";
      // TODO: integrate existing WebRTC session setup.
      status.value = "connected";
      if (handlers.onDataChannelOpened) {
        handlers.onDataChannelOpened();
      }
    },
    disconnect(): void {
      status.value = "idle";
      // TODO: integrate existing WebRTC teardown.
    },
    async sendUserMessage(content: string): Promise<void> {
      void content;
      // TODO: integrate existing user message sending logic.
    },
    async sendToolOutput(payload: SessionToolOutputPayload): Promise<void> {
      void payload;
      // TODO: integrate tool output dispatch via data channel.
    },
    setAudioEnabled(enabled: boolean): void {
      void enabled;
      // TODO: integrate existing mute/unmute behavior.
    },
  };
}
