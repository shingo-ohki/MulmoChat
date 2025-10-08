import { ToolPlugin, ToolContext, ToolResult } from "../types";
import PdfView from "../views/pdf.vue";
import PdfPreview from "../previews/pdf.vue";

const toolName = "summarizePDF";

export interface PdfToolData {
  pdfData: string; // base64 encoded PDF data
  fileName: string;
  summary?: string;
}

const toolDefinition = {
  type: "function" as const,
  name: toolName,
  description: "Summarize the content of a PDF file using Claude.",
  parameters: {
    type: "object" as const,
    properties: {
      prompt: {
        type: "string",
        description: "Instructions for Claude on how to summarize or analyze the PDF",
      },
    },
    required: ["prompt"],
  },
};

const summarizePDF = async (
  context: ToolContext,
  args: Record<string, any>,
): Promise<ToolResult<PdfToolData>> => {
  const prompt = args.prompt as string;

  // Get the current PDF data from context
  const currentPdfData = context.currentResult?.data as PdfToolData;

  if (!currentPdfData?.pdfData) {
    return {
      message: "No PDF file available to summarize",
      instructions: "Acknowledge that no PDF file is available.",
    };
  }

  try {
    // TODO: Call Claude API with the PDF and prompt
    // For now, just return a placeholder
    const summary = "Summary will be generated here";

    return {
      data: {
        ...currentPdfData,
        summary,
      },
      message: "PDF summarized successfully",
      instructions: `The PDF has been summarized. Summary: ${summary}`,
    };
  } catch (error) {
    console.error("PDF summarization failed", error);
    return {
      message: "PDF summarization failed",
      instructions: "Acknowledge that the PDF summarization failed.",
    };
  }
};

export function createUploadedPdfResult(
  pdfData: string,
  fileName: string,
): ToolResult<PdfToolData> {
  return {
    toolName,
    data: { pdfData, fileName },
    message: "",
    title: fileName,
  };
}

export const plugin: ToolPlugin<PdfToolData> = {
  toolDefinition,
  execute: summarizePDF,
  generatingMessage: "Summarizing PDF...",
  isEnabled: () => false, // Disabled for now
  viewComponent: PdfView,
  previewComponent: PdfPreview,
};
