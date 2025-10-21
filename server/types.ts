export interface StartApiResponse {
  success: boolean;
  message: string;
  ephemeralKey: string;
  googleMapKey: string | undefined;
  hasExaApiKey: boolean;
  hasAnthropicApiKey: boolean;
}

export interface TextProvidersResponse {
  success: boolean;
  providers: Array<{
    provider: string;
    hasCredentials: boolean;
    defaultModel?: string;
    models?: string[];
  }>;
}

export interface TextGenerationResponse {
  success: boolean;
  result?: {
    provider: string;
    model: string;
    text: string;
    usage?: Record<string, number>;
  };
  error?: string;
  details?: string;
}

export interface VoiceTranscriptionRequest {
  // optional model override (e.g. 'whisper-1')
  model?: string;
}

export interface VoiceTranscriptionResponse {
  success: boolean;
  text?: string;
  error?: string;
  details?: string;
}

export interface VoiceChatResponse {
  success: boolean;
  transcription?: VoiceTranscriptionResponse;
  chat?: TextGenerationResponse;
}

export interface OpinionLog {
  session_id: string;
  timestamp: string;
  text: string;
}
