import { ToolPlugin, ToolContext, ToolResult } from "../types";
import TodoView from "../views/todo.vue";
import TodoPreview from "../previews/todo.vue";

const toolName = "manageTodoList";
const STORAGE_KEY = "mulmo_todo_list";

export interface TodoItem {
  id: string;
  text: string;
  completed: boolean;
  createdAt: number;
}

export interface TodoToolData {
  items: TodoItem[];
}

const toolDefinition = {
  type: "function" as const,
  name: toolName,
  description:
    "Manage a todo list - show current items, add new items, or delete items. Use this to help users track tasks and remember things.",
  parameters: {
    type: "object" as const,
    properties: {
      action: {
        type: "string",
        enum: ["show", "add", "delete"],
        description:
          "Action to perform: 'show' displays the list, 'add' creates a new item, 'delete' removes an item",
      },
      text: {
        type: "string",
        description:
          "For 'add': the todo item text. For 'delete': the text of the item to delete (must match exactly)",
      },
    },
    required: ["action"],
  },
};

// Load todo items from localStorage
function loadTodos(): TodoItem[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error("Error loading todos:", error);
  }
  return [];
}

// Save todo items to localStorage
function saveTodos(items: TodoItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch (error) {
    console.error("Error saving todos:", error);
  }
}

const manageTodoList = async (
  context: ToolContext,
  args: Record<string, any>,
): Promise<ToolResult<TodoToolData>> => {
  const { action, text } = args;

  try {
    const items = loadTodos();

    switch (action) {
      case "show": {
        return {
          message: `Todo list displayed with ${items.length} item${items.length !== 1 ? "s" : ""}`,
          data: { items },
          jsonData: {
            totalItems: items.length,
            completed: items.filter((item) => item.completed).length,
            pending: items.filter((item) => !item.completed).length,
            items: items.map((item) => ({
              text: item.text,
              completed: item.completed,
            })),
          },
          instructions:
            "The todo list has been displayed. Acknowledge the current state of the list to the user.",
        };
      }

      case "add": {
        if (!text || typeof text !== "string" || text.trim() === "") {
          return {
            message: "Cannot add todo: text is required",
            data: { items },
            instructions:
              "Tell the user that a todo item text is required to add an item.",
          };
        }

        const newItem: TodoItem = {
          id: `todo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          text: text.trim(),
          completed: false,
          createdAt: Date.now(),
        };

        items.push(newItem);
        saveTodos(items);

        return {
          message: `Added todo: "${newItem.text}"`,
          data: { items },
          jsonData: {
            added: newItem.text,
            totalItems: items.length,
          },
          instructions: `Confirm to the user that "${newItem.text}" has been added to their todo list.`,
        };
      }

      case "delete": {
        if (!text || typeof text !== "string") {
          return {
            message: "Cannot delete todo: text is required",
            data: { items },
            instructions:
              "Tell the user which todo item they want to delete. List the current items if needed.",
          };
        }

        const indexToDelete = items.findIndex(
          (item) => item.text.toLowerCase() === text.toLowerCase(),
        );

        if (indexToDelete === -1) {
          return {
            message: `Todo item not found: "${text}"`,
            data: { items },
            jsonData: {
              availableItems: items.map((item) => item.text),
            },
            instructions: `Tell the user that "${text}" was not found in the todo list. Show them the current items if helpful.`,
          };
        }

        const deletedItem = items[indexToDelete];
        items.splice(indexToDelete, 1);
        saveTodos(items);

        return {
          message: `Deleted todo: "${deletedItem.text}"`,
          data: { items },
          jsonData: {
            deleted: deletedItem.text,
            totalItems: items.length,
          },
          instructions: `Confirm to the user that "${deletedItem.text}" has been removed from their todo list.`,
        };
      }

      default:
        return {
          message: `Unknown action: ${action}`,
          data: { items },
          instructions:
            "Tell the user that the action was not recognized. Valid actions are: show, add, delete.",
        };
    }
  } catch (error) {
    console.error("ERR: exception in manageTodoList", error);
    return {
      message: `Todo list error: ${error instanceof Error ? error.message : "Unknown error"}`,
      data: { items: [] },
      instructions:
        "Acknowledge that there was an error managing the todo list.",
    };
  }
};

export const plugin: ToolPlugin<TodoToolData> = {
  toolDefinition,
  execute: manageTodoList,
  generatingMessage: "Managing todo list...",
  isEnabled: () => true,
  viewComponent: TodoView,
  previewComponent: TodoPreview,
  systemPrompt:
    "When users mention tasks they need to do, things to remember, or ask about their todo list, use the manageTodoList function to help them track these items.",
};
