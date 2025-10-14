import type { ToolPlugin } from "../types";

export interface TextResponseData {
  text: string;
  role?: "assistant" | "system" | "user";
  transportKind?: string;
}

type TextResponseArgs = TextResponseData;

export const plugin: ToolPlugin<TextResponseData> = {
  toolDefinition: {
    name: "text-response",
    description: "Render plain text content from the assistant.",
    parameters: {
      type: "object",
      properties: {
        text: {
          type: "string",
          description: "Plain text content to display to the user.",
        },
        role: {
          type: "string",
          enum: ["assistant", "system", "user"],
          description: "Speaker role of the message.",
        },
        transportKind: {
          type: "string",
          description:
            "Identifier for the transport or provider that produced the message.",
        },
      },
      required: ["text"],
      additionalProperties: false,
    },
  },
  // Never advertise this pseudo tool to the LLM; only the client uses it.
  isEnabled: () => false,
  viewComponent: () => import("../views/TextResponseView.vue"),
  previewComponent: () => import("../previews/TextResponsePreview.vue"),
  execute: async (_context, args: TextResponseArgs) => ({
    data: {
      text: args.text,
      role: args.role,
      transportKind: args.transportKind,
    },
    message: args.text,
  }),
};
