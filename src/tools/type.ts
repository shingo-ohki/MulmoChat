import * as GenerateImagePlugin from "./models/generateImage";
import * as EditImagePlugin from "./models/editImage";
import * as BrowsePlugin from "./models/browse";
import * as MulmocastPlugin from "./models/mulmocast";
import * as MapPlugin from "./models/map";
import * as ExaPlugin from "./models/exa";
import * as OthelloPlugin from "./models/othello";
import * as CanvasPlugin from "./models/canvas";
import * as MarkdownPlugin from "./models/markdown";
import * as QuizPlugin from "./models/quiz";
import * as MusicPlugin from "./models/music";
import type { StartApiResponse } from "../../server/types";
import { v4 as uuidv4 } from "uuid";

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

const pluginList = [
  GenerateImagePlugin,
  EditImagePlugin,
  BrowsePlugin,
  MulmocastPlugin,
  MapPlugin,
  ExaPlugin,
  OthelloPlugin,
  CanvasPlugin,
  MarkdownPlugin,
  QuizPlugin,
  MusicPlugin,
];

export const pluginTools = (startResponse?: StartApiResponse) => {
  return pluginList
    .filter((plugin) => plugin.plugin.isEnabled(startResponse))
    .map((plugin) => plugin.plugin.toolDefinition);
};

const plugins = pluginList.reduce(
  (acc, plugin) => {
    acc[plugin.plugin.toolDefinition.name] = plugin.plugin;
    return acc;
  },
  {} as Record<string, ToolPlugin>,
);

export const toolExecute = async (
  context: ToolContext,
  name: string,
  args: Record<string, any>,
): Promise<ToolResultComplete> => {
  console.log(`EXE:${name}\n`, args);
  const plugin = plugins[name];
  if (!plugin) {
    throw new Error(`Plugin ${name} not found`);
  }
  const result = await plugin.execute(context, args);
  return {
    ...result,
    toolName: name,
    uuid: result.uuid || uuidv4(),
  };
};

export const getToolPlugin = (name: string) => {
  return plugins[name] || null;
};
