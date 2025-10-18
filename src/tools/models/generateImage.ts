import { ToolPlugin, ToolContext, ToolResult } from "../types";
import ImageView from "../views/image.vue";
import ImagePreview from "../previews/image.vue";
import ImageGenerationConfig from "../configs/ImageGenerationConfig.vue";

const toolName = "generateImage";

export interface ImageToolData {
  imageData: string;
  prompt: string;
}

const toolDefinition = {
  type: "function" as const,
  name: toolName,
  description: "Generate an image from a text prompt.",
  parameters: {
    type: "object" as const,
    properties: {
      prompt: {
        type: "string",
        description: "Description of the desired image in English",
      },
    },
    required: ["prompt"],
  },
};

export async function generateImageCommon(
  context: ToolContext,
  prompt: string,
  editImage: boolean,
): Promise<ToolResult<ImageToolData>> {
  try {
    // Determine which backend to use (new config system takes precedence)
    const backend =
      context.getPluginConfig?.("imageGenerationBackend") ||
      context.userPreferences?.pluginConfigs?.["imageGenerationBackend"] ||
      context.userPreferences?.imageGenerationBackend ||
      "gemini";
    const endpoint =
      backend === "comfyui"
        ? "/api/generate-image/comfy"
        : "/api/generate-image";

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        images:
          editImage && context.currentResult?.data?.imageData
            ? [
                context.currentResult.data.imageData.replace(
                  /^data:image\/[^;]+;base64,/,
                  "",
                ),
              ]
            : [],
      }),
    });

    if (!response.ok) {
      throw new Error(`Server error: ${response.statusText}`);
    }

    const data = await response.json();

    // Handle ComfyUI response (array of images)
    if (
      backend === "comfyui" &&
      data.success &&
      data.images &&
      data.images.length > 0
    ) {
      return {
        data: {
          imageData: `data:image/png;base64,${data.images[0]}`,
          prompt,
        },
        message: "image generation succeeded",
        instructions:
          "Acknowledge that the image was generated and has been already presented to the user.",
      };
    }
    // Handle Gemini response (single image)
    else if (data.success && data.imageData) {
      return {
        data: {
          imageData: `data:image/png;base64,${data.imageData}`,
          prompt,
        },
        message: "image generation succeeded",
        instructions:
          "Acknowledge that the image was generated and has been already presented to the user.",
      };
    } else {
      console.error("ERR:1\n no image data", data);
      return {
        message: data.message || "image generation failed",
        instructions: "Acknowledge that the image generation failed.",
      };
    }
  } catch (error) {
    console.error("ERR: exception\n Image generation failed", error);
    return {
      message: "image generation failed",
      instructions: "Acknowledge that the image generation failed.",
    };
  }
}

const generateImage = async (
  context: ToolContext,
  args: Record<string, any>,
): Promise<ToolResult<ImageToolData>> => {
  const prompt = args.prompt as string;
  return generateImageCommon(context, prompt, false);
};

export function createUploadedImageResult(
  imageData: string,
  fileName: string,
  prompt: string,
): ToolResult<ImageToolData> {
  return {
    toolName,
    data: { imageData, prompt },
    message: "",
    title: fileName,
  };
}

export const plugin: ToolPlugin<ImageToolData> = {
  toolDefinition,
  execute: generateImage,
  generatingMessage: "Generating image...",
  isEnabled: () => true,
  viewComponent: ImageView,
  previewComponent: ImagePreview,
  fileUpload: {
    acceptedTypes: ["image/png", "image/jpeg"],
    handleUpload: createUploadedImageResult,
  },
  systemPrompt:
    "When you are talking about places, objects, people, movies, books and other things, you MUST use the generateImage API to draw pictures to make the conversation more engaging.",
  config: {
    key: "imageGenerationBackend",
    defaultValue: "gemini",
    component: ImageGenerationConfig,
  },
};
