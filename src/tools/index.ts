import * as GenerateImagePlugin from "./models/generateImage";
import * as EditImagePlugin from "./models/editImage";
import * as BrowsePlugin from "./models/browse";
import * as MulmocastPlugin from "./models/mulmocast";
import * as MapPlugin from "./models/map";
import * as ExaPlugin from "./models/exa";
import * as OthelloPlugin from "./models/othello";
import * as GoPlugin from "./models/go";
import * as CanvasPlugin from "./models/canvas";
import * as MarkdownPlugin from "./models/markdown";
import * as QuizPlugin from "./models/quiz";
import * as MusicPlugin from "./models/music";
// import * as HtmlPlugin from "./models/html";
import * as GenerateHtmlPlugin from "./models/generateHtml";
import * as EditHtmlPlugin from "./models/editHtml";
import * as PdfPlugin from "./models/pdf";
import type { StartApiResponse } from "../../server/types";
import { v4 as uuidv4 } from "uuid";
import type {
  ToolContext,
  ToolResult,
  ToolResultComplete,
  ToolPlugin,
} from "./types";

export type { ToolContext, ToolResult, ToolResultComplete, ToolPlugin };

const pluginList = [
  GenerateImagePlugin,
  EditImagePlugin,
  BrowsePlugin,
  MulmocastPlugin,
  MapPlugin,
  ExaPlugin,
  OthelloPlugin,
  GoPlugin,
  CanvasPlugin,
  MarkdownPlugin,
  QuizPlugin,
  MusicPlugin,
  // HtmlPlugin,
  GenerateHtmlPlugin,
  EditHtmlPlugin,
  PdfPlugin,
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

export const getFileUploadPlugins = () => {
  return pluginList
    .filter((plugin) => plugin.plugin.fileUpload)
    .map((plugin) => ({
      toolName: plugin.plugin.toolDefinition.name,
      fileUpload: plugin.plugin.fileUpload!,
    }));
};

export const getAcceptedFileTypes = () => {
  const uploadPlugins = getFileUploadPlugins();
  const allTypes = uploadPlugins.flatMap(
    (plugin) => plugin.fileUpload.acceptedTypes,
  );
  return Array.from(new Set(allTypes));
};
