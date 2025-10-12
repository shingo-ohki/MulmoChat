/* eslint-env browser */

import { reactive, watch } from "vue";
import { DEFAULT_LANGUAGE_CODE, getLanguageName } from "../config/languages";
import {
  DEFAULT_SYSTEM_PROMPT_ID,
  getSystemPrompt,
} from "../config/systemPrompts";
import { pluginTools, getPluginSystemPrompts } from "../tools";
import type { BuildContext } from "./types";

const USER_LANGUAGE_KEY = "user_language_v1";
const SUPPRESS_INSTRUCTIONS_KEY = "suppress_instructions_v1";
const SYSTEM_PROMPT_ID_KEY = "system_prompt_id_v1";
const ENABLED_PLUGINS_KEY = "enabled_plugins_v1";
const CUSTOM_INSTRUCTIONS_KEY = "custom_instructions_v1";

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const getStorage = (): StorageLike | null => {
  const globalObj = globalThis as { localStorage?: StorageLike };
  return globalObj.localStorage ?? null;
};

const getStoredValue = (key: string): string | null => {
  const storage = getStorage();
  return storage?.getItem(key) ?? null;
};

const setStoredValue = (key: string, value: string) => {
  const storage = getStorage();
  storage?.setItem(key, value);
};

const setStoredObject = (key: string, value: Record<string, boolean>) => {
  const storage = getStorage();
  storage?.setItem(key, JSON.stringify(value));
};

export interface UserPreferencesState {
  userLanguage: string;
  suppressInstructions: boolean;
  systemPromptId: string;
  customInstructions: string;
  enabledPlugins: Record<string, boolean>;
}

export interface UseUserPreferencesReturn {
  state: UserPreferencesState;
  buildInstructions: (context: BuildContext) => string;
  buildTools: (context: BuildContext) => unknown[];
}

const initEnabledPlugins = (): Record<string, boolean> => {
  const stored = getStoredValue(ENABLED_PLUGINS_KEY);
  if (!stored) return {};
  try {
    return JSON.parse(stored);
  } catch {
    return {};
  }
};

export function useUserPreferences(): UseUserPreferencesReturn {
  const state = reactive<UserPreferencesState>({
    userLanguage: getStoredValue(USER_LANGUAGE_KEY) || DEFAULT_LANGUAGE_CODE,
    suppressInstructions: getStoredValue(SUPPRESS_INSTRUCTIONS_KEY) === "true",
    systemPromptId:
      getStoredValue(SYSTEM_PROMPT_ID_KEY) || DEFAULT_SYSTEM_PROMPT_ID,
    customInstructions: getStoredValue(CUSTOM_INSTRUCTIONS_KEY) || "",
    enabledPlugins: initEnabledPlugins(),
  });

  watch(
    () => state.userLanguage,
    (val) => {
      setStoredValue(USER_LANGUAGE_KEY, val);
    },
  );

  watch(
    () => state.suppressInstructions,
    (val) => {
      setStoredValue(SUPPRESS_INSTRUCTIONS_KEY, String(val));
    },
  );

  watch(
    () => state.systemPromptId,
    (val) => {
      setStoredValue(SYSTEM_PROMPT_ID_KEY, val);
    },
  );

  watch(
    () => state.customInstructions,
    (val) => {
      setStoredValue(CUSTOM_INSTRUCTIONS_KEY, val);
    },
  );

  watch(
    () => state.enabledPlugins,
    (val) => {
      setStoredObject(ENABLED_PLUGINS_KEY, val);
    },
    { deep: true },
  );

  const buildInstructions = ({ startResponse }: InstructionBuildContext) => {
    const selectedPrompt = getSystemPrompt(state.systemPromptId);
    const pluginPrompts = selectedPrompt.includePluginPrompts
      ? getPluginSystemPrompts(startResponse, state.enabledPlugins)
      : "";
    const customInstructionsText = state.customInstructions.trim()
      ? ` ${state.customInstructions}`
      : "";
    return `${selectedPrompt.prompt}${pluginPrompts}${customInstructionsText} The user's native language is ${getLanguageName(state.userLanguage)}.`;
  };

  const buildTools = ({ startResponse }: InstructionBuildContext) =>
    pluginTools(startResponse, state.enabledPlugins);

  return {
    state,
    buildInstructions,
    buildTools,
  };
}
