import { computed, type ComputedRef, type Ref, unref } from "vue";
import {
  useRealtimeSession,
  type RealtimeSessionOptions,
  type UseRealtimeSessionReturn,
} from "./useRealtimeSession";

type MaybeRef<T> = T | Ref<T>;

export type SessionTransportKind = "voice-realtime";

export interface SessionTransportCapabilities {
  supportsAudioInput: boolean;
  supportsAudioOutput: boolean;
  supportsText: boolean;
}

export interface UseSessionTransportOptions extends RealtimeSessionOptions {
  transportKind?: MaybeRef<SessionTransportKind>;
}

export interface UseSessionTransportReturn extends UseRealtimeSessionReturn {
  transportKind: ComputedRef<SessionTransportKind>;
  capabilities: ComputedRef<SessionTransportCapabilities>;
}

export function useSessionTransport(
  options: UseSessionTransportOptions,
): UseSessionTransportReturn {
  const { transportKind: providedKind, ...realtimeOptions } = options;

  const transportKind = computed<SessionTransportKind>(() => {
    const kind = providedKind ? unref(providedKind) : "voice-realtime";
    return kind;
  });

  const session = useRealtimeSession(realtimeOptions);

  const capabilities = computed<SessionTransportCapabilities>(() => {
    if (transportKind.value === "voice-realtime") {
      return {
        supportsAudioInput: true,
        supportsAudioOutput: true,
        supportsText: true,
      };
    }

    return {
      supportsAudioInput: true,
      supportsAudioOutput: true,
      supportsText: true,
    };
  });

  return {
    ...session,
    transportKind,
    capabilities,
  };
}
