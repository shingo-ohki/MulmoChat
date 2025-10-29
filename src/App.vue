<template>
  <div class="p-4 space-y-4">
    <div role="toolbar" class="flex justify-between items-center">
      <h1 class="text-2xl font-bold">
        MulmoChat
        <span class="text-sm text-gray-500 font-normal"
          >AI-native Operating System</span
        >
      </h1>
    </div>

    <!-- Main content area with sidebar -->
    <div class="flex space-x-4" style="height: calc(100vh - 80px)">
      <Sidebar
        ref="sidebarRef"
        :chat-active="chatActive"
        :connecting="connecting"
        :plugin-results="toolResults"
        :is-generating-image="isGeneratingImage"
        :generating-message="generatingMessage"
        :selected-result="selectedResult"
        :user-input="userInput"
        :is-muted="isMuted"
        :user-language="userPreferences.userLanguage"
        :suppress-instructions="userPreferences.suppressInstructions"
        :system-prompt-id="userPreferences.systemPromptId"
        :is-conversation-active="conversationActive"
        :enabled-plugins="userPreferences.enabledPlugins"
        :custom-instructions="userPreferences.customInstructions"
        :model-id="userPreferences.modelId"
        :model-kind="userPreferences.modelKind"
        :text-model-id="userPreferences.textModelId"
        :text-model-options="textModelOptions"
        :supports-audio-input="supportsAudioInput"
        :supports-audio-output="supportsAudioOutput"
        :image-generation-backend="userPreferences.imageGenerationBackend"
        :plugin-configs="userPreferences.pluginConfigs"
        :enable-voice-transcription="userPreferences.enableVoiceTranscription"
        @start-chat="startChat"
        @stop-chat="stopChat"
        @set-mute="setMute"
        @select-result="handleSelectResult"
        @send-text-message="sendTextMessage"
        @update:user-input="userInput = $event"
        @update:user-language="userPreferences.userLanguage = $event"
        @update:suppress-instructions="
          userPreferences.suppressInstructions = $event
        "
        @update:system-prompt-id="userPreferences.systemPromptId = $event"
        @update:enabled-plugins="userPreferences.enabledPlugins = $event"
        @update:custom-instructions="
          userPreferences.customInstructions = $event
        "
        @update:model-id="userPreferences.modelId = $event"
        @update:model-kind="userPreferences.modelKind = $event"
        @update:text-model-id="userPreferences.textModelId = $event"
        @update:image-generation-backend="
          userPreferences.imageGenerationBackend = $event
        "
        @update:plugin-configs="userPreferences.pluginConfigs = $event"
        @update:enable-voice-transcription="
          userPreferences.enableVoiceTranscription = $event
        "
        @upload-files="handleUploadFiles"
      />

      <!-- Main content -->
      <div class="flex-1 flex flex-col">
        <div class="flex-1 border rounded bg-gray-50 overflow-hidden relative">
          <!-- Conversation view for opinion collection mode -->
          <div
            v-if="userPreferences.systemPromptId === 'opinion' && messages.length > 0"
            class="w-full h-full flex flex-col bg-gradient-to-b from-blue-50 to-white"
          >
            <div ref="conversationScrollContainer" class="flex-1 overflow-y-auto p-6 space-y-4">
              <div
                v-for="(msg, idx) in messages"
                :key="idx"
                :class="[
                  'flex',
                  msg.speaker === 'user' ? 'justify-end' : 'justify-start'
                ]"
              >
                <div
                  :class="[
                    'max-w-[70%] rounded-2xl px-4 py-3 shadow-sm',
                    msg.speaker === 'user'
                      ? 'bg-blue-500 text-white rounded-br-sm'
                      : 'bg-white text-gray-800 border border-gray-200 rounded-bl-sm'
                  ]"
                >
                  <div class="text-sm font-medium mb-1 opacity-70">
                    {{ msg.speaker === 'user' ? 'あなた' : 'AI' }}
                  </div>
                  <div class="text-base leading-relaxed whitespace-pre-wrap">
                    {{ msg.text }}
                  </div>
                  <div class="text-xs mt-1 opacity-50">
                    {{ msg.timestamp.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) }}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Original tool result view -->
          <component
            v-else-if="
              selectedResult &&
              getToolPlugin(selectedResult.toolName)?.viewComponent
            "
            :is="getToolPlugin(selectedResult.toolName).viewComponent"
            :key="selectedResult.uuid"
            :selected-result="selectedResult"
            :send-text-message="sendTextMessage"
            :google-map-key="startResponse?.googleMapKey || null"
            :set-mute="setMute"
            @update-result="handleUpdateResult"
          />
          
          <!-- Default canvas placeholder -->
          <div
            v-else
            class="w-full h-full flex items-center justify-center"
          >
            <div class="text-gray-400 text-lg">Canvas</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from "vue";
import { toolExecute, getToolPlugin } from "./tools";
import type { ToolResult } from "./tools";
import Sidebar from "./components/Sidebar.vue";
import { useSessionTransport } from "./composables/useSessionTransport";
import { useRealtimeSession } from "./composables/useRealtimeSession"; // DEBUG
import { useUserPreferences } from "./composables/useUserPreferences";
import { useToolResults } from "./composables/useToolResults";
import { useScrolling } from "./composables/useScrolling";
import { SESSION_CONFIG } from "./config/session";
import { useOpinionLogger } from "./composables/useOpinionLogger";
import { DEFAULT_TEXT_MODEL } from "./config/textModels";
import type { TextProvidersResponse } from "../server/types";

const sidebarRef = ref<InstanceType<typeof Sidebar> | null>(null);
const preferences = useUserPreferences();
const {
  state: userPreferences,
  buildInstructions: buildPreferenceInstructions,
  buildTools: buildPreferenceTools,
} = preferences;

// Session ID for opinion logging
const sessionId = ref<string>(crypto.randomUUID());

async function sleep(milliseconds: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

interface Message {
  speaker: "user" | "ai";
  text: string;
  timestamp: Date;
}

const messages = ref<Message[]>([]);
const currentText = ref("");
const userInput = ref("");
const conversationScrollContainer = ref<HTMLElement | null>(null);

// Opinion logger for CSV recording
const { logOpinion } = useOpinionLogger();

// Auto-scroll to bottom when new messages arrive
watch(
  () => messages.value.length,
  () => {
    if (conversationScrollContainer.value) {
      setTimeout(() => {
        if (conversationScrollContainer.value) {
          conversationScrollContainer.value.scrollTop = conversationScrollContainer.value.scrollHeight;
        }
      }, 100);
    }
  }
);

interface TextModelOption {
  id: string;
  label: string;
  disabled?: boolean;
}

const textModelOptions = ref<TextModelOption[]>([
  {
    id: DEFAULT_TEXT_MODEL.rawId,
    label: "OpenAI — gpt-4o-mini (default)",
  },
]);

const PROVIDER_LABELS: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google Gemini",
  ollama: "Ollama",
};

const scrolling = useScrolling({
  sidebarRef: () => sidebarRef.value,
});

const transportKind = computed(() => userPreferences.modelKind);

// Initialize session transport with voice transcription support
const session = useSessionTransport({
  transportKind,
  buildInstructions: (context) => buildPreferenceInstructions(context),
  buildTools: (context) => buildPreferenceTools(context),
  getModelId: () =>
    userPreferences.modelKind === "voice-realtime"
      ? userPreferences.modelId
      : userPreferences.textModelId,
});

const {
  chatActive,
  conversationActive,
  connecting,
  isMuted,
  startResponse,
  isDataChannelOpen,
  startChat: startTransportChat,
  stopChat: stopTransportChat,
  sendUserMessage: sendUserMessageInternal,
  sendFunctionCallOutput,
  sendInstructions,
  setMute: sessionSetMute,
  setLocalAudioEnabled,
  attachRemoteAudioElement,
  registerEventHandlers,
  capabilities,
} = session;

// Debug: Check if getLocalStream is available
console.log("[Debug] session object keys:", Object.keys(session));
console.log("[Debug] session.getLocalStream type:", typeof session.getLocalStream);
console.log("[Debug] Full session object:", session);

// DEBUG: Test useRealtimeSession directly
const debugRealtimeSession = useRealtimeSession({
  buildInstructions: () => "",
  buildTools: () => [],
});
console.log("[Debug] Direct useRealtimeSession keys:", Object.keys(debugRealtimeSession));
console.log("[Debug] Direct getLocalStream type:", typeof debugRealtimeSession.getLocalStream);

const supportsAudioInput = computed(
  () => capabilities.value.supportsAudioInput,
);
const supportsAudioOutput = computed(
  () => capabilities.value.supportsAudioOutput,
);

async function loadTextProviders(): Promise<void> {
  try {
    const response = await fetch("/api/text/providers");
    if (!response.ok) {
      throw new Error(`Failed to load text providers: ${response.statusText}`);
    }
    const payload = (await response.json()) as TextProvidersResponse;
    const options: TextModelOption[] = [];

    for (const provider of payload.providers ?? []) {
      const providerLabel =
        PROVIDER_LABELS[provider.provider] ?? provider.provider;
      const models = new Set<string>();
      if (provider.models?.length) {
        provider.models.forEach((model) => models.add(model));
      }
      if (provider.defaultModel) {
        models.add(provider.defaultModel);
      }
      if (models.size === 0) {
        continue;
      }
      for (const model of models) {
        const isDefault = provider.defaultModel === model;
        const credentialNote = provider.hasCredentials
          ? ""
          : " (credentials required)";
        options.push({
          id: `${provider.provider}:${model}`,
          label: `${providerLabel} — ${model}${isDefault ? " (default)" : ""}${credentialNote}`,
          disabled: !provider.hasCredentials,
        });
      }
    }

    if (options.length === 0) {
      options.push({
        id: DEFAULT_TEXT_MODEL.rawId,
        label: "OpenAI — gpt-4o-mini (default)",
      });
    }

    textModelOptions.value = options;
    const preferred = options.find(
      (option) => option.id === userPreferences.textModelId && !option.disabled,
    );
    const fallback =
      preferred || options.find((option) => !option.disabled) || options[0];
    if (fallback && fallback.id !== userPreferences.textModelId) {
      userPreferences.textModelId = fallback.id;
    }
  } catch (error) {
    console.warn("Failed to load text model providers", error);
    textModelOptions.value = [
      {
        id: DEFAULT_TEXT_MODEL.rawId,
        label: "OpenAI — gpt-4o-mini (default)",
      },
    ];
    if (!userPreferences.textModelId) {
      userPreferences.textModelId = DEFAULT_TEXT_MODEL.rawId;
    }
  }
}

onMounted(() => {
  void loadTextProviders();
});

// Helper function to get plugin config values
const getPluginConfig = <T = any,>(key: string): T | undefined => {
  return userPreferences.pluginConfigs[key] as T | undefined;
};

const {
  toolResults,
  selectedResult,
  isGeneratingImage,
  generatingMessage,
  handleToolCall,
  handleSelectResult,
  handleUpdateResult,
  handleUploadFiles,
} = useToolResults({
  toolExecute,
  getToolPlugin,
  suppressInstructions: computed(() => userPreferences.suppressInstructions),
  userPreferences: computed(() => userPreferences),
  getPluginConfig,
  sleep,
  sendInstructions,
  sendFunctionCallOutput,
  conversationActive,
  isDataChannelOpen,
  scrollToBottomOfSideBar: scrolling.scrollSidebarToBottom,
  scrollCurrentResultToTop: scrolling.scrollCanvasToTop,
});

const isListenerMode = computed(
  () => userPreferences.systemPromptId === "listener",
);
const lastSpeechStartedTime = ref<number | null>(null);

registerEventHandlers({
  onToolCall: (msg, id, argStr) => {
    void handleToolCall({ msg, rawArgs: argStr });
  },
  onTextDelta: (delta) => {
    currentText.value += delta;
  },
  onTextCompleted: async () => {
    const aiText = currentText.value.trim();
    if (aiText) {
      // Add to messages display first (to preserve order)
      messages.value.push({
        speaker: "ai",
        text: aiText,
        timestamp: new Date(),
      });
      
      // Log AI response to CSV (async, don't block UI)
      console.log("[OpinionLogger] AI response:", aiText);
      logOpinion(sessionId.value, "ai", aiText).catch((err) => {
        console.error("[OpinionLogger] Failed to log AI response:", err);
      });
    }
    currentText.value = "";
  },
  onUserTranscription: async (text) => {
    // User's voice input has been transcribed by Realtime API
    console.log("[OpinionLogger] User transcription:", text);
    
    // Add to messages display first (to preserve order)
    messages.value.push({
      speaker: "user",
      text: text,
      timestamp: new Date(),
    });
    
    // Log user input to CSV (async, don't block UI)
    logOpinion(sessionId.value, "user", text).catch((err) => {
      console.error("[OpinionLogger] Failed to log user input:", err);
    });
  },
  onSpeechStarted: () => {
    // For listener mode, log the speech event
    if (isListenerMode.value) {
      console.log("MSG: Speech started");
    }
  },
  onSpeechStopped: async () => {
    // Handle listener mode specific logic
    if (isListenerMode.value) {
      console.log("MSG: Speech stopped");
      const timeSinceLastStart = lastSpeechStartedTime.value
        ? Date.now() - lastSpeechStartedTime.value
        : 0;

      if (timeSinceLastStart > SESSION_CONFIG.LISTENER_MODE_SPEECH_THRESHOLD_MS) {
        console.log("MSG: Speech stopped for a long time");
        setLocalAudioEnabled(false);
        setTimeout(() => {
          setMute(isMuted.value);
          lastSpeechStartedTime.value = Date.now();
        }, SESSION_CONFIG.LISTENER_MODE_AUDIO_GAP_MS);
      }
    }
  },
  onError: (error) => {
    console.error("Session error", error);
  },
});

watch(
  () =>
    supportsAudioOutput.value ? (sidebarRef.value?.audioEl ?? null) : null,
  (audioEl) => {
    attachRemoteAudioElement(audioEl);
  },
  { immediate: true },
);

async function startChat(): Promise<void> {
  // Gard against double start
  if (chatActive.value || connecting.value) return;

  if (supportsAudioInput.value) {
    lastSpeechStartedTime.value = Date.now();
  }
  await startTransportChat();
}

async function sendTextMessage(providedText?: string): Promise<void> {
  const text = (providedText || userInput.value).trim();
  if (!text) return;

  // In text-rest mode, auto-start the session if not active
  if (
    transportKind.value === "text-rest" &&
    !chatActive.value &&
    !connecting.value
  ) {
    await startChat();
  }

  // Add user message as a tool result for conversation history
  // Only add if it's from the user input box (not providedText from other sources)
  if (!providedText) {
    const userMessageResult: ToolResult = {
      uuid: crypto.randomUUID(),
      toolName: "text-response",
      message: text,
      title: "You",
      data: {
        text: text,
        role: "user",
        transportKind: transportKind.value,
      },
    };
    toolResults.value.push(userMessageResult);
    scrolling.scrollSidebarToBottom();
  }

  // Wait for conversation to be inactive
  for (
    let i = 0;
    i < SESSION_CONFIG.MESSAGE_SEND_RETRY_ATTEMPTS && conversationActive.value;
    i++
  ) {
    console.log(`WAIT:${i} \n`, text);
    await sleep(SESSION_CONFIG.MESSAGE_SEND_RETRY_DELAY_MS);
  }

  const sent = await sendUserMessageInternal(text);
  if (!sent) {
    return;
  }

  messages.value.push({
    speaker: "user",
    text: text,
    timestamp: new Date(),
  });
  if (!providedText) {
    userInput.value = "";
  }
}

function stopChat(): void {
  stopTransportChat();
}

function setMute(muted: boolean): void {
  if (!supportsAudioInput.value) {
    return;
  }
  sessionSetMute(muted);
}

async function switchMode(newSystemPromptId: string): Promise<void> {
  // Step 1: Disconnect if connected
  if (chatActive.value) {
    stopChat();
  }

  // Step 2: Switch to the specified system prompt mode
  userPreferences.systemPromptId = newSystemPromptId;

  // Wait a brief moment to ensure cleanup is complete
  await sleep(500);

  // Step 3: Connect to the remote LLM
  await startChat();
}

// Expose the API globally for external access
if (typeof window !== "undefined") {
  (window as any).switchMode = switchMode;
}

watch(
  () => userPreferences.modelKind,
  (newKind, previousKind) => {
    if (newKind !== previousKind && chatActive.value) {
      stopChat();
    }
  },
);
</script>

<style scoped></style>
