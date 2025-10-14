<template>
  <div class="text-sm text-gray-700 leading-snug">
    <p class="line-clamp-3 whitespace-pre-wrap">{{ previewText }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { ToolResultComplete } from "../types";
import type { TextResponseData } from "../models/textResponse";

const props = defineProps<{
  result: ToolResultComplete<TextResponseData>;
}>();

const previewText = computed(() => props.result.data?.text ?? "");
</script>
