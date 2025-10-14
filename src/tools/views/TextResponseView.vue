<template>
  <div class="h-full w-full overflow-y-auto p-6">
    <div class="max-w-3xl mx-auto space-y-4">
      <div class="rounded-lg border bg-white shadow-sm p-5" :class="roleTheme">
        <div
          class="flex justify-between items-start mb-2 text-sm text-gray-500"
        >
          <span class="font-medium text-gray-700">{{ speakerLabel }}</span>
          <span v-if="transportKind" class="italic"
            >{{ transportKind }}</span
          >
        </div>
        <p class="whitespace-pre-wrap leading-relaxed text-gray-900">
          {{ messageText }}
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { ToolResultComplete } from "../types";
import type { TextResponseData } from "../models/textResponse";

const props = defineProps<{
  selectedResult: ToolResultComplete<TextResponseData>;
}>();

const messageText = computed(() => props.selectedResult.data?.text ?? "");
const messageRole = computed(
  () => props.selectedResult.data?.role ?? "assistant",
);
const transportKind = computed(
  () => props.selectedResult.data?.transportKind ?? "",
);

const speakerLabel = computed(() => {
  switch (messageRole.value) {
    case "system":
      return "System";
    case "user":
      return "You";
    default:
      return "Assistant";
  }
});

const roleTheme = computed(() => {
  switch (messageRole.value) {
    case "system":
      return "bg-blue-50 border-blue-200";
    case "user":
      return "bg-green-50 border-green-200";
    default:
      return "bg-purple-50 border-purple-200";
  }
});
</script>
