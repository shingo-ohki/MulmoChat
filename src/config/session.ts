/**
 * Session configuration constants
 */

export const SESSION_CONFIG = {
  /**
   * Listener mode: Only disable audio after this much time since speech started
   */
  LISTENER_MODE_SPEECH_THRESHOLD_MS: 15000,

  /**
   * Listener mode: Duration of the intentional audio gap
   */
  LISTENER_MODE_AUDIO_GAP_MS: 2000,

  /**
   * Maximum retry attempts when waiting for conversation to be inactive
   */
  MESSAGE_SEND_RETRY_ATTEMPTS: 5,

  /**
   * Delay between retry attempts in milliseconds
   */
  MESSAGE_SEND_RETRY_DELAY_MS: 1000,

  /**
   * Maximum retry attempts when waiting for file upload instruction sending
   */
  UPLOAD_RETRY_ATTEMPTS: 5,

  /**
   * Delay between upload retry attempts in milliseconds
   */
  UPLOAD_RETRY_DELAY_MS: 1000,
} as const;
