import { ToolPlugin, ToolContext, ToolResult } from "../types";
import HtmlView from "../views/html.vue";
import HtmlPreview from "../previews/html.vue";

const toolName = "renderHtml";

export type HtmlLibraryType = "tailwind" | "d3.js" | "three.js";

export interface HtmlToolData {
  html: string;
  type: HtmlLibraryType;
}

const toolDefinition = {
  type: "function" as const,
  name: toolName,
  description:
    "Render a full HTML page with specified library support (Tailwind CSS, D3.js, or Three.js). The HTML will be rendered in an isolated iframe.",
  parameters: {
    type: "object" as const,
    properties: {
      title: {
        type: "string",
        description: "Title for the HTML page",
      },
      html: {
        type: "string",
        description:
          "The complete HTML content to render. Should be a full HTML document including DOCTYPE, html, head, and body tags.",
      },
      type: {
        type: "string",
        enum: ["tailwind", "d3.js", "three.js"],
        description:
          "The primary library used in this HTML page. Valid values: 'tailwind' for Tailwind CSS, 'd3.js' for D3.js visualizations, 'three.js' for Three.js 3D graphics.",
      },
    },
    required: ["title", "html", "type"],
  },
};

const renderHtml = async (
  context: ToolContext,
  args: Record<string, any>,
): Promise<ToolResult<HtmlToolData>> => {
  const html = args.html as string;
  const type = args.type as HtmlLibraryType;
  const title = args.title as string;

  // Validate type
  if (!["tailwind", "d3.js", "three.js"].includes(type)) {
    throw new Error(
      `Invalid library type: ${type}. Must be one of: tailwind, d3.js, three.js`,
    );
  }

  return {
    message: `Rendered HTML page: ${title} (using ${type})`,
    title,
    data: { html, type },
    instructions:
      "Acknowledge that the HTML page has been created and is displayed to the user.",
  };
};

export const plugin: ToolPlugin<HtmlToolData> = {
  toolDefinition,
  execute: renderHtml,
  generatingMessage: "Rendering HTML page...",
  waitingMessage:
    "Tell the user that the HTML page was created and will be presented shortly.",
  isEnabled: () => true,
  viewComponent: HtmlView,
  previewComponent: HtmlPreview,
};
