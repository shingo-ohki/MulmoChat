<template>
  <div class="text-sm text-gray-700 leading-snug">
    <p class="line-clamp-3 whitespace-pre-wrap">{{ previewText }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { ToolResultComplete } from "../types";

const props = defineProps<{
  result: ToolResultComplete<{ text: string }>;
}>();

const previewText = computed(() => props.result.content.text);
</script>
