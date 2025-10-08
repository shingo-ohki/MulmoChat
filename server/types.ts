export interface StartApiResponse {
  success: boolean;
  message: string;
  ephemeralKey: string;
  googleMapKey: string | undefined;
  hasExaApiKey: boolean;
  hasAnthropicApiKey: boolean;
}
