import type { StartApiResponse } from "../../server/types";

/**
 * Shared types for composables
 */

/**
 * Context provided when building instructions or tools
 */
export interface BuildContext {
  startResponse: StartApiResponse | null;
}

/**
 * Standard error structure for composables
 */
export interface ComposableError {
  code: string;
  message: string;
  details?: unknown;
}

/**
 * Standard result type for operations that can succeed or fail
 */
export interface ComposableResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: ComposableError;
}

/**
 * Message type for tool calls from OpenAI
 */
export interface ToolCallMessage {
  type: string;
  id?: string;
  call_id?: string;
  name?: string;
  delta?: string;
  arguments?: string;
  truncated?: boolean;
  transcript?: string;
  item?: {
    type?: string;
    role?: string;
    content?: Array<{
      type?: string;
      transcript?: string;
      [key: string]: unknown;
    }>;
    [key: string]: unknown;
  };
  error?: unknown;
  [key: string]: unknown;
}

/**
 * Type guard to validate ToolCallMessage structure
 */
export function isValidToolCallMessage(msg: unknown): msg is ToolCallMessage {
  return (
    typeof msg === "object" &&
    msg !== null &&
    "type" in msg &&
    typeof (msg as ToolCallMessage).type === "string"
  );
}

/**
 * Helper to create a success result
 */
export function createSuccessResult<T>(data: T): ComposableResult<T> {
  return {
    success: true,
    data,
  };
}

/**
 * Helper to create an error result
 */
export function createErrorResult(
  code: string,
  message: string,
  details?: unknown,
): ComposableResult<never> {
  return {
    success: false,
    error: {
      code,
      message,
      details,
    },
  };
}
