import { ref, type Ref } from "vue";
import type {
  SessionAdapter,
  SessionCapabilities,
  SessionConnectOptions,
  SessionEventHandlers,
  SessionStatus,
} from "../session/types";

export interface UseSessionOptions {
  adapter: SessionAdapter;
}

export interface UseSessionReturn {
  status: Ref<SessionStatus>;
  capabilities: SessionCapabilities;
  conversationActive: Ref<boolean>;
  connect: (options: SessionConnectOptions) => Promise<void>;
  disconnect: () => void;
  sendUserMessage: (content: string) => Promise<void>;
  sendToolOutput: SessionAdapter["sendToolOutput"];
  setAudioEnabled: (enabled: boolean) => void;
  registerEventHandlers: (handlers: Partial<SessionEventHandlers>) => void;
}

export function useSession(options: UseSessionOptions): UseSessionReturn {
  const { adapter } = options;
  const conversationActive = ref(false);

  const connect = async (connectOptions: SessionConnectOptions) => {
    await adapter.connect(connectOptions);
  };

  const disconnect = () => {
    adapter.disconnect();
  };

  const sendUserMessage = async (content: string) => {
    await adapter.sendUserMessage(content);
  };

  const sendToolOutput: SessionAdapter["sendToolOutput"] = async (payload) => {
    await adapter.sendToolOutput(payload);
  };

  const setAudioEnabled = (enabled: boolean) => {
    adapter.setAudioEnabled(enabled);
  };

  const registerEventHandlers = (handlers: Partial<SessionEventHandlers>) => {
    adapter.registerEventHandlers(handlers);
  };

  return {
    status: adapter.status,
    capabilities: adapter.capabilities,
    conversationActive,
    connect,
    disconnect,
    sendUserMessage,
    sendToolOutput,
    setAudioEnabled,
    registerEventHandlers,
  };
}
