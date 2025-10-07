<template>
  <img
    v-if="result.data?.imageData"
    :src="result.data.imageData"
    class="max-w-full h-auto rounded"
    alt="Generated image"
  />
</template>

<script setup lang="ts">
import type { ToolResult } from "../types";
import type { ImageToolData } from "../models/generateImage";

defineProps<{
  result: ToolResult<ImageToolData>;
}>();
</script>
