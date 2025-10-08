<template>
  <div class="w-full h-full flex flex-col p-4">
    <div class="flex-1 w-full min-h-0">
      <iframe
        v-if="selectedResult.data?.pdfData"
        :src="selectedResult.data.pdfData"
        class="w-full h-full border-0 rounded"
        title="PDF Viewer"
      />
    </div>
    <div
      v-if="selectedResult.data?.fileName"
      class="mt-4 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg flex-shrink-0"
    >
      <p class="text-sm text-gray-700 dark:text-gray-300">
        <span class="font-medium">File:</span>
        {{ selectedResult.data.fileName }}
      </p>
    </div>
    <div
      v-if="selectedResult.data?.summary"
      class="mt-2 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg flex-shrink-0"
    >
      <p class="text-sm text-gray-700 dark:text-gray-300">
        <span class="font-medium">Summary:</span>
        {{ selectedResult.data.summary }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ToolResult } from "../types";
import type { PdfToolData } from "../models/pdf";

defineProps<{
  selectedResult: ToolResult<PdfToolData>;
}>();
</script>
