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
        @start-chat="startChat"
        @stop-chat="stopChat"
        @set-mute="setMute"
        @select-result="handleSelectResult"
        @send-text-message="sendTextMessage"
        @update:user-input="userInput = $event"
        @update:user-language="userLanguage = $event"
        @upload-images="handleUploadImages"
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
import { ref, watch, nextTick } from "vue";
import {
  pluginTools,
  toolExecute,
  ToolResult,
  ToolContext,
  getToolPlugin,
} from "./tools";
import { createUploadedImageResult } from "./tools/models/generateImage";
import type { StartApiResponse } from "../server/types";
import Sidebar from "./components/Sidebar.vue";
import { DEFAULT_LANGUAGE_CODE, getLanguageName } from "./config/languages";

const USER_LANGUAGE_KEY = "user_language_v1";
const SYSTEM_PROMPT =
  "You are a teacher who explains various things in a way that even middle school students can easily understand. When you are talking about places, objects, people, movies, books and other things, you MUST use the generateImage API to draw pictures to make the conversation more engaging. Call the pushMarkdown API to display documents when the user is asking for a document. Call the pushMulmoScript API to display presentations when the user is asking for a presentation. If the user is asking for stock price, browse Yahoo Finance page with the ticker symbol, such as https://finance.yahoo.com/quote/TSLA/ or https://finance.yahoo.com/quote/BTC-USD/.";
const sidebarRef = ref<InstanceType<typeof Sidebar> | null>(null);
const connecting = ref(false);
const userLanguage = ref(
  localStorage.getItem(USER_LANGUAGE_KEY) || DEFAULT_LANGUAGE_CODE,
);
const messages = ref<string[]>([]);
const currentText = ref("");
const toolResults = ref<ToolResult[]>([]);
const isGeneratingImage = ref(false);
const generatingMessage = ref("");
const pendingToolArgs: Record<string, string> = {};
const processedToolCalls = new Map<string, string>();
const selectedResult = ref<ToolResult | null>(null);
const userInput = ref("");
const startResponse = ref<StartApiResponse | null>(null);

watch(userLanguage, (val) => {
  localStorage.setItem(USER_LANGUAGE_KEY, val);
});

const chatActive = ref(false);
const conversationActive = ref(false);
const isMuted = ref(false);

const webrtc = {
  pc: null as RTCPeerConnection | null,
  dc: null as RTCDataChannel | null,
  localStream: null as MediaStream | null,
  remoteStream: null as MediaStream | null,
};

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
      webrtc.dc?.send(
        JSON.stringify({
          type: "response.create",
          response: {
            instructions: waitingMessage,
            // e.g., the model might say: "Your image is ready."
          },
        }),
      );
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
    webrtc.dc?.send(
      JSON.stringify({
        type: "conversation.item.create",
        item: {
          type: "function_call_output",
          call_id: msg.call_id,
          output: JSON.stringify(outputPayload),
        },
      }),
    );
    if (result.instructions) {
      const delay = getToolPlugin(msg.name)?.delayAfterExecution;
      if (delay) {
        await sleep(delay);
      }
      console.log(`INS:${result.toolName}\n${result.instructions}`);
      webrtc.dc?.send(
        JSON.stringify({
          type: "response.create",
          response: {
            instructions: result.instructions,
          },
        }),
      );
    }
  } catch (e) {
    console.error("Failed to parse function call arguments", e);
    processedToolCalls.delete(id);
    // Let the model know that we failed to parse the function call arguments.
    webrtc.dc?.send(
      JSON.stringify({
        type: "conversation.item.create",
        item: {
          type: "function_call_output",
          call_id: msg.call_id,
          output: `Failed to parse function call arguments: ${e}`,
        },
      }),
    );
    // We don't need to send "response.create" here.
  } finally {
    isGeneratingImage.value = false;
    generatingMessage.value = "";
  }
}

// NOTE: This must be a sync function. Otherwise, we may call the same tool multiple times.
function messageHandler(event: MessageEvent): void {
  const msg = JSON.parse(event.data);
  const id = msg.id || msg.call_id;

  switch (msg.type) {
    case "error":
      console.error("Error", msg.error);
      break;

    case "response.text.delta":
      currentText.value += msg.delta;
      break;

    case "response.completed":
      if (currentText.value.trim()) {
        messages.value.push(currentText.value);
      }
      currentText.value = "";
      break;

    case "response.function_call_arguments.delta":
      pendingToolArgs[id] = (pendingToolArgs[id] || "") + msg.delta;
      break;

    case "response.function_call_arguments.done": {
      const argStr = pendingToolArgs[id] || msg.arguments || "";
      delete pendingToolArgs[id];
      const previousArgs = processedToolCalls.get(id);
      if (previousArgs === argStr) {
        console.warn(
          `******* Skipping duplicate tool call for ${msg.name || msg.call_id}`,
        );
        break;
      }
      processedToolCalls.set(id, argStr);
      processToolCall(msg, id, argStr);
      break;
    }
    case "response.created":
      conversationActive.value = true;
      break;
    case "response.done":
      conversationActive.value = false;
      break;
  }
}

async function startChat(): Promise<void> {
  // Gard against double start
  if (chatActive.value || connecting.value) return;

  connecting.value = true;

  // Call the start API endpoint to get ephemeral key
  try {
    const response = await fetch("/api/start", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }

    startResponse.value = await response.json();

    if (!startResponse.value?.ephemeralKey) {
      throw new Error("No ephemeral key received from server");
    }
  } catch (err) {
    console.error("Failed to get ephemeral key:", err);
    alert("Failed to start session. Check console for details.");
    connecting.value = false;
    return;
  }

  try {
    webrtc.pc = new RTCPeerConnection();

    // Data channel for model events
    const dc = webrtc.pc.createDataChannel("oai-events");
    webrtc.dc = dc;
    dc.addEventListener("open", () => {
      dc.send(
        JSON.stringify({
          type: "session.update",
          session: {
            type: "realtime",
            model: "gpt-realtime",
            instructions: `${SYSTEM_PROMPT} The user's native language is ${getLanguageName(userLanguage.value)}.`,
            audio: {
              output: {
                voice: "shimmer",
              },
            },
            tools: pluginTools(startResponse.value),
          },
        }),
      );
    });
    dc.addEventListener("message", messageHandler);
    dc.addEventListener("close", () => {
      webrtc.dc = null;
    });

    // Play remote audio
    webrtc.remoteStream = new MediaStream();
    webrtc.pc.ontrack = (event) => {
      webrtc.remoteStream.addTrack(event.track);
    };
    if (sidebarRef.value?.audioEl) {
      sidebarRef.value.audioEl.srcObject = webrtc.remoteStream;
    }

    // Send microphone audio
    webrtc.localStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
    });
    webrtc.localStream
      .getTracks()
      .forEach((track) => webrtc.pc.addTrack(track, webrtc.localStream));

    // Create and send offer SDP
    const offer = await webrtc.pc.createOffer();
    await webrtc.pc.setLocalDescription(offer);

    const response = await fetch("https://api.openai.com/v1/realtime/calls", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${startResponse.value.ephemeralKey}`,
        "Content-Type": "application/sdp",
      },
      body: offer.sdp,
    });
    const responseText = await response.text();

    await webrtc.pc.setRemoteDescription({ type: "answer", sdp: responseText });
    chatActive.value = true;
  } catch (err) {
    console.error(err);
    stopChat();
    alert("Failed to start voice chat. Check console for details.");
  } finally {
    connecting.value = false;
  }
}

async function sendTextMessage(providedText?: string): Promise<void> {
  const text = (providedText || userInput.value).trim();
  if (!text) return;

  // Wait for conversation to be active (up to 5 seconds)
  for (let i = 0; i < 5 && conversationActive.value; i++) {
    console.log(`WAIT:${i} \n`, text);
    await sleep(1000);
  }

  const dc = webrtc.dc;
  if (!chatActive.value || !dc || dc.readyState !== "open") {
    console.warn(
      "Cannot send text message because the data channel is not ready.",
    );
    return;
  }

  console.log(`MSG:\n`, text);
  dc.send(
    JSON.stringify({
      type: "conversation.item.create",
      item: {
        type: "message",
        role: "user",
        content: [
          {
            type: "input_text",
            text,
          },
        ],
      },
    }),
  );
  dc.send(
    JSON.stringify({
      type: "response.create",
      response: {},
    }),
  );

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

function handleUploadImages(
  imageDataArray: string[],
  fileNamesArray: string[],
): void {
  imageDataArray.forEach((imageData, index) => {
    const fileName = fileNamesArray[index];
    const result = createUploadedImageResult(
      imageData,
      fileName,
      `Uploaded by the user: ${fileName}`,
    );

    // Add UUID to make it a complete ToolResult
    const completeResult = {
      ...result,
      uuid: crypto.randomUUID(),
    };

    toolResults.value.push(completeResult);
    selectedResult.value = completeResult;
  });

  scrollToBottomOfSideBar();
  scrollCurrentResultToTop();
}

function stopChat(): void {
  if (webrtc.pc) {
    webrtc.pc.close();
    webrtc.pc = null;
  }
  if (webrtc.dc) {
    webrtc.dc.close();
    webrtc.dc = null;
  }
  if (webrtc.localStream) {
    webrtc.localStream.getTracks().forEach((track) => track.stop());
    webrtc.localStream = null;
  }
  if (webrtc.remoteStream) {
    webrtc.remoteStream.getTracks().forEach((track) => track.stop());
    webrtc.remoteStream = null;
  }
  if (sidebarRef.value?.audioEl) {
    sidebarRef.value.audioEl.srcObject = null;
  }
  chatActive.value = false;
  isMuted.value = false;
}

function setMute(muted: boolean): void {
  isMuted.value = muted;
  if (webrtc.localStream) {
    const audioTracks = webrtc.localStream.getAudioTracks();
    audioTracks.forEach((track) => {
      track.enabled = !muted;
    });
  }
}
</script>

<style scoped></style>
