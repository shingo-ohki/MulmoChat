import { ToolPlugin, ToolContext, ToolResult } from "../types";
import BrowseView from "../views/browse.vue";
import BrowsePreview from "../previews/browse.vue";

const toolName = "browse";

export interface BrowseToolData {
  url: string;
  twitterEmbedHtml?: string | null;
}

const twitterEmbedData: { [key: string]: string } = {};

function isTwitterUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return (
      urlObj.hostname === "twitter.com" ||
      urlObj.hostname === "www.twitter.com" ||
      urlObj.hostname === "x.com" ||
      urlObj.hostname === "www.x.com"
    );
  } catch {
    return false;
  }
}

async function fetchTwitterEmbed(url: string): Promise<string | null> {
  try {
    const response = await fetch(
      `/api/twitter-embed?url=${encodeURIComponent(url)}`,
    );

    if (!response.ok) {
      throw new Error(`Twitter embed API error: ${response.status}`);
    }

    const data = await response.json();
    return data.success ? data.html : null;
  } catch (error) {
    console.error("Failed to fetch Twitter embed:", error);
    return null;
  }
}

async function handleTwitterEmbed(url: string): Promise<void> {
  if (!isTwitterUrl(url) || url in twitterEmbedData) {
    return;
  }

  const embedHtml = await fetchTwitterEmbed(url);
  console.log("*** Twitter embed", url, embedHtml);
  if (embedHtml) {
    twitterEmbedData[url] = embedHtml;
  }
}

const toolDefinition = {
  type: "function" as const,
  name: toolName,
  description:
    "Browse and extract content from a web page using the provided URL.",
  parameters: {
    type: "object" as const,
    properties: {
      url: {
        type: "string",
        description:
          "The URL of the webpage to browse and extract content from",
      },
    },
    required: ["url"],
  },
};

const browse = async (
  context: ToolContext,
  args: Record<string, any>,
): Promise<ToolResult<BrowseToolData>> => {
  const url = args.url as string;

  // Handle Twitter embeds
  if (isTwitterUrl(url)) {
    await handleTwitterEmbed(url);
  }

  try {
    const response = await fetch("/api/browse", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url }),
    });

    if (!response.ok) {
      throw new Error(`Server error: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.success && data.data) {
      const result: any = {
        message: "Successfully browsed the webpage",
        title: data.data.data.title || "Untitled",
        jsonData: data.data,
        instructions:
          "Acknowledge that the webpage was successfully browsed and give a ONE-SENTENCE summary of the content if it is available.",
        data: {
          url,
        },
      };

      // Add Twitter embed data if it's a Twitter URL
      if (isTwitterUrl(url)) {
        result.data.twitterEmbedHtml = twitterEmbedData[url] || null;
      }

      return result;
    } else {
      console.log("*** Browse failed");
      return {
        message: data.error || "Failed to browse webpage",
        instructions: "Acknowledge that the webpage browsing failed.",
      };
    }
  } catch (error) {
    console.error("*** Browse failed", error);
    return {
      message: `Failed to browse webpage: ${error instanceof Error ? error.message : "Unknown error"}`,
      instructions: "Acknowledge that the webpage browsing failed.",
    };
  }
};

export const plugin: ToolPlugin = {
  toolDefinition,
  execute: browse,
  generatingMessage: "Browsing webpage...",
  waitingMessage:
    "Tell the user to that you are accessing the specified web page.",
  isEnabled: () => true,
  delayAfterExecution: 3000,
  viewComponent: BrowseView,
  previewComponent: BrowsePreview,
};
