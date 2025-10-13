export interface RealtimeModelOption {
  id: string;
  label: string;
  description?: string;
}

export const REALTIME_MODELS: RealtimeModelOption[] = [
  {
    id: "gpt-realtime",
    label: "GPT Realtime",
  },
  {
    id: "gpt-realtime-mini",
    label: "GPT Realtime Mini",
    description: "Lower-latency, lower-cost realtime model",
  },
];

export const DEFAULT_REALTIME_MODEL_ID = REALTIME_MODELS[0].id;
