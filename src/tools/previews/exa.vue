<template>
  <div class="text-center p-4 bg-purple-50 rounded">
    <div class="text-purple-600 font-medium">🔍 Search Result</div>
    <div class="text-xs text-gray-600 mt-1 truncate">
      {{ result.jsonData?.query || extractQueryFromMessage(result.message) }}
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ToolResult } from "../types";

defineProps<{
  result: ToolResult;
}>();

function extractQueryFromMessage(message: string): string {
  const match = message.match(/relevant results for "([^"]+)"/);
  return match ? match[1] : message;
}
</script>
