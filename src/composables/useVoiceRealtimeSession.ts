import {
  useRealtimeSession,
  type RealtimeSessionOptions,
  type UseRealtimeSessionReturn,
} from "./useRealtimeSession";

export type UseVoiceRealtimeSessionOptions = RealtimeSessionOptions;
export type UseVoiceRealtimeSessionReturn = UseRealtimeSessionReturn;

export function useVoiceRealtimeSession(
  options: UseVoiceRealtimeSessionOptions,
): UseVoiceRealtimeSessionReturn {
  return useRealtimeSession(options);
}
