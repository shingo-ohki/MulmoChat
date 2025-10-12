import { ToolPlugin, ToolContext, ToolResult } from "../types";
import { SYSTEM_PROMPTS } from "../../config/systemPrompts";
import SwitchModePreview from "../previews/switchMode.vue";

const toolName = "switchMode";

const toolDefinition = {
  type: "function" as const,
  name: toolName,
  description:
    "Switch the system prompt mode and reconnect to the LLM. This changes the AI's personality and behavior. Available modes: 'general' (teacher explaining things simply), 'tutor' (adaptive tutor that evaluates knowledge first), 'listener' (silent mode that only generates images).",
  parameters: {
    type: "object" as const,
    properties: {
      mode: {
        type: "string",
        enum: SYSTEM_PROMPTS.map((p) => p.id),
        description: `The mode to switch to. Options: ${SYSTEM_PROMPTS.map((p) => `'${p.id}' (${p.name})`).join(", ")}`,
      },
    },
    required: ["mode"],
  },
};

const switchModeExecute = async (
  context: ToolContext,
  args: Record<string, any>,
): Promise<ToolResult> => {
  const { mode } = args;

  try {
    // Validate mode
    const validMode = SYSTEM_PROMPTS.find((p) => p.id === mode);
    if (!validMode) {
      return {
        message: `Invalid mode: ${mode}`,
        jsonData: {
          success: false,
          error: "Invalid mode",
          availableModes: SYSTEM_PROMPTS.map((p) => ({
            id: p.id,
            name: p.name,
          })),
        },
        instructions: `Tell the user that '${mode}' is not a valid mode. Available modes are: ${SYSTEM_PROMPTS.map((p) => `${p.id} (${p.name})`).join(", ")}.`,
      };
    }

    // Call switchMode asynchronously (don't await)
    if (typeof window !== "undefined" && (window as any).switchMode) {
      // Fire and forget - this will disconnect and reconnect
      setTimeout(() => {
        (window as any).switchMode(mode);
      }, 0);
    } else {
      console.error("switchMode function not found on window object");
      return {
        message: "Failed to switch mode: switchMode API not available",
        jsonData: {
          success: false,
          error: "switchMode API not available",
        },
        instructions:
          "Tell the user that the mode switching feature is not available.",
      };
    }

    // Immediately return to LLM
    return {
      message: `Mode switch to '${validMode.name}' initiated`,
      jsonData: {
        success: true,
        mode: mode,
        modeName: validMode.name,
      },
      instructions: `Tell the user that you are switching to ${validMode.name} mode and will reconnect shortly. The conversation will be interrupted momentarily during the reconnection.`,
      instructionsRequired: true, // Always send this instruction
    };
  } catch (error) {
    console.error("ERR: exception in switchMode", error);
    return {
      message: `Mode switch error: ${error instanceof Error ? error.message : "Unknown error"}`,
      jsonData: {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      instructions:
        "Acknowledge that there was an error switching modes and ask the user to try again.",
    };
  }
};

export const plugin: ToolPlugin = {
  toolDefinition,
  execute: switchModeExecute,
  generatingMessage: "Switching mode...",
  isEnabled: () => true,
  previewComponent: SwitchModePreview,
  systemPrompt:
    "When users ask to change the mode, personality, or behavior of the AI (e.g., 'switch to tutor mode', 'change to listener mode', 'be a teacher'), use the switchMode function. Note that switching modes will disconnect and reconnect the conversation.",
};
