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
        @upload-files="handleUploadFiles"
      />

      <!-- Main content -->
      <div class="flex-1 flex flex-col">
        <div class="flex-1 border rounded bg-gray-50 overflow-hidden">
          <component
            v-if="
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
          <div
            v-if="!selectedResult"
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
import { ref, computed, watch } from "vue";
import { toolExecute, getToolPlugin } from "./tools";
import Sidebar from "./components/Sidebar.vue";
import { useRealtimeSession } from "./composables/useRealtimeSession";
import { useUserPreferences } from "./composables/useUserPreferences";
import { useToolResults } from "./composables/useToolResults";
import { useScrolling } from "./composables/useScrolling";
import { SESSION_CONFIG } from "./config/session";

const sidebarRef = ref<InstanceType<typeof Sidebar> | null>(null);
const preferences = useUserPreferences();
const {
  state: userPreferences,
  buildInstructions: buildPreferenceInstructions,
  buildTools: buildPreferenceTools,
} = preferences;

async function sleep(milliseconds: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

const messages = ref<string[]>([]);
const currentText = ref("");
const userInput = ref("");

const scrolling = useScrolling({
  sidebarRef: () => sidebarRef.value,
});

const session = useRealtimeSession({
  buildInstructions: (context) => buildPreferenceInstructions(context),
  buildTools: (context) => buildPreferenceTools(context),
  getModelId: () => userPreferences.modelId,
});

const {
  chatActive,
  conversationActive,
  connecting,
  isMuted,
  startResponse,
  isDataChannelOpen,
  startChat: startRealtimeChat,
  stopChat: stopRealtimeChat,
  sendUserMessage: sendUserMessageInternal,
  sendFunctionCallOutput,
  sendInstructions,
  setMute: sessionSetMute,
  setLocalAudioEnabled,
  attachRemoteAudioElement,
  registerEventHandlers,
} = session;

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
  onTextCompleted: () => {
    if (currentText.value.trim()) {
      messages.value.push(currentText.value);
    }
    currentText.value = "";
  },
  onSpeechStarted: () => {
    if (isListenerMode.value) {
      console.log("MSG: Speech started");
    }
  },
  onSpeechStopped: () => {
    if (!isListenerMode.value) {
      return;
    }
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
  },
  onError: (error) => {
    console.error("Session error", error);
  },
});

watch(
  () => sidebarRef.value?.audioEl ?? null,
  (audioEl) => {
    attachRemoteAudioElement(audioEl);
  },
  { immediate: true },
);

async function startChat(): Promise<void> {
  // Gard against double start
  if (chatActive.value || connecting.value) return;

  lastSpeechStartedTime.value = Date.now();
  await startRealtimeChat();
}

async function sendTextMessage(providedText?: string): Promise<void> {
  const text = (providedText || userInput.value).trim();
  if (!text) return;

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

  messages.value.push(`You: ${text}`);
  if (!providedText) {
    userInput.value = "";
  }
}

function stopChat(): void {
  stopRealtimeChat();
}

function setMute(muted: boolean): void {
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
</script>

<style scoped></style>
