<template>
  <div
    class="w-full h-32 bg-gray-200 dark:bg-gray-700 rounded flex items-center justify-center"
  >
    <div class="text-center">
      <svg
        class="w-12 h-12 mx-auto text-red-500"
        fill="currentColor"
        viewBox="0 0 20 20"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          fill-rule="evenodd"
          d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
          clip-rule="evenodd"
        />
      </svg>
      <p class="text-xs mt-2 text-gray-600 dark:text-gray-300">
        {{ result.data?.fileName || "PDF" }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ToolResult } from "../types";
import type { PdfToolData } from "../models/pdf";

defineProps<{
  result: ToolResult<PdfToolData>;
}>();
</script>
