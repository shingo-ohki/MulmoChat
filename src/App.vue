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
        :user-language="userLanguage"
        :suppress-instructions="suppressInstructions"
        :system-prompt-id="systemPromptId"
        :is-conversation-active="conversationActive"
        :enabled-plugins="enabledPlugins"
        :custom-instructions="customInstructions"
        @start-chat="startChat"
        @stop-chat="stopChat"
        @set-mute="setMute"
        @select-result="handleSelectResult"
        @send-text-message="sendTextMessage"
        @update:user-input="userInput = $event"
        @update:user-language="userLanguage = $event"
        @update:suppress-instructions="suppressInstructions = $event"
        @update:system-prompt-id="systemPromptId = $event"
        @update:enabled-plugins="enabledPlugins = $event"
        @update:custom-instructions="customInstructions = $event"
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
import { ref, nextTick, computed, watch } from "vue";
import { toolExecute, ToolResult, ToolContext, getToolPlugin } from "./tools";
import Sidebar from "./components/Sidebar.vue";
import { useRealtimeSession } from "./composables/useRealtimeSession";
import { useUserPreferences } from "./composables/useUserPreferences";

const LISTENER_MODE_SPEECH_THRESHOLD_MS = 15000; // Only disable audio after this much time since speech started
const LISTENER_MODE_AUDIO_GAP_MS = 2000; // Duration of the intentional audio gap
const sidebarRef = ref<InstanceType<typeof Sidebar> | null>(null);
const preferences = useUserPreferences();
const {
  state: userPreferences,
  buildInstructions: buildPreferenceInstructions,
  buildTools: buildPreferenceTools,
} = preferences;

const userLanguage = computed({
  get: () => userPreferences.userLanguage,
  set: (val: string) => {
    userPreferences.userLanguage = val;
  },
});

const suppressInstructions = computed({
  get: () => userPreferences.suppressInstructions,
  set: (val: boolean) => {
    userPreferences.suppressInstructions = val;
  },
});

const systemPromptId = computed({
  get: () => userPreferences.systemPromptId,
  set: (val: string) => {
    userPreferences.systemPromptId = val;
  },
});

const customInstructions = computed({
  get: () => userPreferences.customInstructions,
  set: (val: string) => {
    userPreferences.customInstructions = val;
  },
});

const enabledPlugins = computed({
  get: () => userPreferences.enabledPlugins,
  set: (val: Record<string, boolean>) => {
    userPreferences.enabledPlugins = val;
  },
});

const messages = ref<string[]>([]);
const currentText = ref("");
const toolResults = ref<ToolResult[]>([]);
const isGeneratingImage = ref(false);
const generatingMessage = ref("");
const selectedResult = ref<ToolResult | null>(null);
const userInput = ref("");

const session = useRealtimeSession({
  buildInstructions: (context) => buildPreferenceInstructions(context),
  buildTools: (context) => buildPreferenceTools(context),
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

const isListenerMode = computed(() => systemPromptId.value === "listener");
const lastSpeechStartedTime = ref<number | null>(null);

registerEventHandlers({
  onToolCall: (msg, id, argStr) => {
    processToolCall(msg, id, argStr);
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

    if (timeSinceLastStart > LISTENER_MODE_SPEECH_THRESHOLD_MS) {
      console.log("MSG: Speech stopped for a long time");
      setLocalAudioEnabled(false);
      setTimeout(() => {
        setMute(isMuted.value);
        lastSpeechStartedTime.value = Date.now();
      }, LISTENER_MODE_AUDIO_GAP_MS);
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

const sleep = async (milliseconds: number) => {
  return await new Promise((resolve) => setTimeout(resolve, milliseconds));
};

function scrollToBottomOfSideBar(): void {
  sidebarRef.value?.scrollToBottom();
}

function scrollCurrentResultToTop(): void {
  nextTick(() => {
    const mainContent = document.querySelector(
      ".flex-1.border.rounded.bg-gray-50.overflow-hidden",
    );
    if (mainContent) {
      const scrollableElement = mainContent.querySelector(
        "iframe, .w-full.h-full.overflow-auto, .w-full.h-full.flex",
      );
      if (scrollableElement) {
        if (scrollableElement.tagName === "IFRAME") {
          try {
            scrollableElement.contentWindow?.scrollTo(0, 0);
          } catch (e) {
            // Cross-origin iframe, can't scroll
          }
        } else {
          scrollableElement.scrollTop = 0;
        }
      }
    }
  });
}

async function processToolCall(
  msg: any,
  id: string,
  argStr: string,
): Promise<void> {
  try {
    const args = typeof argStr === "string" ? JSON.parse(argStr) : argStr;
    isGeneratingImage.value = true;
    generatingMessage.value =
      getToolPlugin(msg.name)?.generatingMessage || "Processing...";
    scrollToBottomOfSideBar();
    const context: ToolContext = {
      currentResult: selectedResult.value,
    };
    const promise = toolExecute(context, msg.name, args);
    const waitingMessage = getToolPlugin(msg.name)?.waitingMessage;
    if (waitingMessage) {
      sendInstructions(waitingMessage);
    }

    const result = await promise;

    // Check if this is an update to the currently selected result
    if (
      result.updating &&
      context.currentResult &&
      result.toolName === context.currentResult.toolName
    ) {
      // Find and update the existing result
      const index = toolResults.value.findIndex(
        (r) => r.uuid === context.currentResult?.uuid,
      );
      if (index !== -1) {
        toolResults.value[index] = result;
      } else {
        console.error("ERR:Failed to find the result to update");
      }
      selectedResult.value = result;
    } else {
      // Add as new result
      toolResults.value.push(result);
      selectedResult.value = result;
      scrollToBottomOfSideBar();
      scrollCurrentResultToTop();
    }

    const outputPayload = {
      status: result.message,
      data: result.jsonData,
    };
    console.log(`RES:${result.toolName}\n`, outputPayload);
    sendFunctionCallOutput(msg.call_id, JSON.stringify(outputPayload));
    if (
      result.instructions &&
      (!suppressInstructions.value || result.instructionsRequired)
    ) {
      const delay = getToolPlugin(msg.name)?.delayAfterExecution;
      if (delay) {
        await sleep(delay);
      }
      console.log(`INS:${result.toolName}\n${result.instructions}`);
      sendInstructions(result.instructions);
    }
  } catch (e) {
    console.error("Failed to parse function call arguments", e);
    // Let the model know that we failed to parse the function call arguments.
    if (msg.call_id) {
      sendFunctionCallOutput(
        msg.call_id,
        `Failed to parse function call arguments: ${e}`,
      );
    }
    // We don't need to send "response.create" here.
  } finally {
    isGeneratingImage.value = false;
    generatingMessage.value = "";
  }
}

async function startChat(): Promise<void> {
  // Gard against double start
  if (chatActive.value || connecting.value) return;

  lastSpeechStartedTime.value = Date.now();
  await startRealtimeChat();
}

async function sendTextMessage(providedText?: string): Promise<void> {
  const text = (providedText || userInput.value).trim();
  if (!text) return;

  // Wait for conversation to be active (up to 5 seconds)
  for (let i = 0; i < 5 && conversationActive.value; i++) {
    console.log(`WAIT:${i} \n`, text);
    await sleep(1000);
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

function handleSelectResult(result: ToolResult): void {
  selectedResult.value = result;
  scrollCurrentResultToTop();
}

function handleUpdateResult(updatedResult: ToolResult): void {
  // Update the result in the pluginResults array using uuid comparison
  const index = toolResults.value.findIndex(
    (r) => r.uuid === updatedResult.uuid,
  );
  if (index !== -1) {
    toolResults.value[index] = updatedResult;
  }
  // Update the selected result only if it matches the updated result
  if (selectedResult.value?.uuid === updatedResult.uuid) {
    selectedResult.value = updatedResult;
  }
}

async function handleUploadFiles(results: ToolResult[]): Promise<void> {
  for (const result of results) {
    // Add UUID to make it a complete ToolResult
    const completeResult = {
      ...result,
      uuid: crypto.randomUUID(),
    };

    toolResults.value.push(completeResult);
    selectedResult.value = completeResult;

    // Send uploadMessage to LLM if available
    const plugin = getToolPlugin(result.toolName);
    if (plugin?.uploadMessage && isDataChannelOpen()) {
      // Wait for conversation to be active (up to 5 seconds)
      for (let i = 0; i < 5 && conversationActive.value; i++) {
        console.log(`WAIT:${i} \n`, plugin.uploadMessage);
        await sleep(1000);
      }
      console.log(`UPL:${result.toolName}\n${plugin.uploadMessage}`);
      sendInstructions(plugin.uploadMessage);
    }
  }

  scrollToBottomOfSideBar();
  scrollCurrentResultToTop();
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
  systemPromptId.value = newSystemPromptId;

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
