import type { StartApiResponse } from "../../server/types";

export interface ToolContext {
  currentResult: ToolResult<any> | null;
}

export interface ToolResult<T = Record<string, any>> {
  toolName?: string; // name of the tool that generated this result
  uuid?: string; // unique identifier for this result
  message: string; // status message sent back to the LLM about the tool execution result
  title?: string;
  jsonData?: any; // data to be passed to the LLM
  instructions?: string; // follow-up instructions for the LLM
  instructionsRequired?: boolean; // if true, instructions will be sent even if suppressInstructions is enabled
  updating?: boolean; // if true, updates existing result instead of creating new one

  data?: T; // tool specific data
  viewState?: Record<string, any>; // tool specific view state
}

export interface ToolResultComplete<T = Record<string, any>>
  extends ToolResult<T> {
  toolName: string;
  uuid: string;
}

export interface ToolPlugin<T = Record<string, any>> {
  toolDefinition: {
    type: "function";
    name: string;
    description: string;
    parameters?: {
      type: "object";
      properties: {
        [key: string]: any;
      };
      required: string[];
    };
  };
  execute: (
    context: ToolContext,
    args: Record<string, any>,
  ) => Promise<ToolResult<T>>;
  generatingMessage: string;
  waitingMessage?: string;
  isEnabled: (startResponse?: StartApiResponse) => boolean;
  delayAfterExecution?: number;
  viewComponent?: any; // Vue component for rendering results
  previewComponent?: any; // Vue component for sidebar preview
}
