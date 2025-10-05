import type { StartApiResponse } from "../../server/types";

export interface ToolContext {
  currentResult: ToolResult | null;
}

export interface ToolResult {
  toolName?: string; // name of the tool that generated this result
  uuid?: string; // unique identifier for this result
  message: string; // status message sent back to the LLM about the tool execution result
  title?: string;
  jsonData?: any; // data to be passed to the LLM
  instructions?: string; // follow-up instructions for the LLM
  updating?: boolean; // if true, updates existing result instead of creating new one

  data?: Record<string, any>; // tool specific data
  viewState?: Record<string, any>; // tool specific view state
}

export interface ToolResultComplete extends ToolResult {
  toolName: string;
  uuid: string;
}

export interface ToolPlugin {
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
  ) => Promise<ToolResult>;
  generatingMessage: string;
  waitingMessage?: string;
  isEnabled: (startResponse?: StartApiResponse) => boolean;
  delayAfterExecution?: number;
  viewComponent?: any; // Vue component for rendering results
  previewComponent?: any; // Vue component for sidebar preview
}
