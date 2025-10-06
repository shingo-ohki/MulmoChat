<template>
  <div
    class="w-60 flex-shrink-0 bg-gray-50 border rounded p-4 flex flex-col space-y-4"
  >
    <!-- Voice chat controls -->
    <div class="space-y-2 flex-shrink-0">
      <div class="flex gap-2">
        <button
          v-if="!chatActive"
          @click="$emit('startChat')"
          :disabled="connecting"
          class="flex-1 px-4 py-2 bg-green-600 text-white rounded disabled:opacity-50"
        >
          {{ connecting ? "Connecting..." : "Connect" }}
        </button>
        <div v-else class="flex gap-2 w-full">
          <button
            @click="$emit('stopChat')"
            class="flex-1 px-4 py-2 bg-red-600 text-white rounded"
          >
            Stop
          </button>
          <button
            @click="$emit('setMute', !isMuted)"
            class="px-3 py-2 rounded border flex items-center justify-center"
            :class="
              isMuted
                ? 'bg-red-100 text-red-600 border-red-300'
                : 'bg-gray-100 text-gray-600 border-gray-300'
            "
            :title="isMuted ? 'Unmute microphone' : 'Mute microphone'"
          >
            <span class="material-icons text-lg">{{
              isMuted ? "mic_off" : "mic"
            }}</span>
          </button>
        </div>
        <button
          v-if="!chatActive"
          @click="showConfigPopup = true"
          class="px-3 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 flex items-center justify-center"
          title="Configuration"
        >
          <span class="material-icons text-lg">settings</span>
        </button>
      </div>
      <audio ref="audioEl" autoplay></audio>
    </div>

    <!-- Generated images container -->
    <div class="flex-1 flex flex-col min-h-0">
      <div
        ref="imageContainer"
        class="border rounded p-2 overflow-y-auto space-y-2 flex-1"
      >
        <div
          v-if="!pluginResults.length && !isGeneratingImage"
          class="text-gray-500 text-sm"
        >
          Feel free to ask me any questions...
        </div>
        <div
          v-for="(result, index) in pluginResults"
          :key="index"
          class="cursor-pointer hover:opacity-75 transition-opacity border rounded p-2"
          :class="{ 'ring-2 ring-blue-500': selectedResult === result }"
          @click="$emit('selectResult', result)"
        >
          <component
            v-if="getToolPlugin(result.toolName)?.previewComponent"
            :is="getToolPlugin(result.toolName).previewComponent"
            :result="result"
          />
        </div>
        <div
          v-if="isGeneratingImage"
          class="flex items-center justify-center py-4"
        >
          <div
            class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"
          ></div>
          <span class="ml-2 text-sm text-gray-600">{{
            generatingMessage
          }}</span>
        </div>
      </div>
    </div>

    <div class="space-y-2 flex-shrink-0">
      <div class="flex gap-2 w-full">
        <button
          @click="triggerImageUpload"
          class="px-3 py-2 bg-gray-100 text-gray-600 border border-gray-300 rounded hover:bg-gray-200 flex items-center justify-center flex-shrink-0"
          title="Upload image"
        >
          <span class="text-lg">+</span>
        </button>
        <input
          :value="userInput"
          @input="
            $emit('update:userInput', ($event.target as HTMLInputElement).value)
          "
          @keyup.enter.prevent="$emit('sendTextMessage')"
          :disabled="!chatActive"
          type="text"
          placeholder="Type a message"
          class="flex-1 min-w-0 border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        />
      </div>
      <input
        ref="fileInput"
        type="file"
        accept="image/png,image/jpeg"
        multiple
        class="hidden"
        @change="handleImageUpload"
      />
      <button
        @click="$emit('sendTextMessage')"
        :disabled="!chatActive || !userInput.trim()"
        class="w-full px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
      >
        Send Message
      </button>
    </div>

    <!-- Config Popup -->
    <div
      v-if="showConfigPopup"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      @click.self="showConfigPopup = false"
    >
      <div class="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-xl font-semibold">Configuration</h2>
          <button
            @click="showConfigPopup = false"
            class="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Native Language
            </label>
            <select
              :value="userLanguage"
              @change="
                $emit(
                  'update:userLanguage',
                  ($event.target as HTMLSelectElement).value,
                )
              "
              class="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option
                v-for="language in LANGUAGES"
                :key="language.code"
                :value="language.code"
              >
                {{ language.name }}
              </option>
            </select>
          </div>

          <div>
            <label class="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                :checked="suppressInstructions"
                @change="
                  $emit(
                    'update:suppressInstructions',
                    ($event.target as HTMLInputElement).checked,
                  )
                "
                class="rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
              />
              <span class="text-sm font-medium text-gray-700">
                Suppress Instructions
              </span>
            </label>
          </div>

          <div class="flex justify-end">
            <button
              @click="showConfigPopup = false"
              class="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, defineProps, defineEmits } from "vue";
import type { ToolResult } from "../tools";
import { getToolPlugin } from "../tools";
import { LANGUAGES } from "../config/languages";

defineProps<{
  chatActive: boolean;
  connecting: boolean;
  pluginResults: ToolResult[];
  isGeneratingImage: boolean;
  generatingMessage: string;
  selectedResult: ToolResult | null;
  userInput: string;
  isMuted: boolean;
  userLanguage: string;
  suppressInstructions: boolean;
}>();

const emit = defineEmits<{
  startChat: [];
  stopChat: [];
  setMute: [muted: boolean];
  selectResult: [result: ToolResult];
  sendTextMessage: [];
  "update:userInput": [value: string];
  "update:userLanguage": [value: string];
  "update:suppressInstructions": [value: boolean];
  uploadImages: [imageData: string[], fileNames: string[]];
}>();

const audioEl = ref<HTMLAudioElement | null>(null);
const imageContainer = ref<HTMLDivElement | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);
const showConfigPopup = ref(false);

function scrollToBottom(): void {
  nextTick(() => {
    if (imageContainer.value) {
      imageContainer.value.scrollTop = imageContainer.value.scrollHeight;
    }
  });
}

function triggerImageUpload(): void {
  fileInput.value?.click();
}

function handleImageUpload(event: Event): void {
  const target = event.target as HTMLInputElement;
  const files = target.files;
  if (files && files.length > 0) {
    const imageDataArray: string[] = [];
    const fileNamesArray: string[] = [];
    let loadedCount = 0;
    const validFiles = Array.from(files).filter(
      (file) => file.type === "image/png" || file.type === "image/jpeg",
    );

    validFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const imageData = e.target?.result as string;
        imageDataArray.push(imageData);
        fileNamesArray.push(file.name);
        loadedCount++;

        if (loadedCount === validFiles.length) {
          emit("uploadImages", imageDataArray, fileNamesArray);
        }
      };
      reader.readAsDataURL(file);
    });

    // Reset the input so the same files can be uploaded again
    target.value = "";
  }
}

defineExpose({
  audioEl,
  scrollToBottom,
});
</script>
