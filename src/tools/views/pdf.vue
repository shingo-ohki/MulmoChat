<template>
  <div class="w-full h-full flex flex-col p-4">
    <div class="flex-1 w-full min-h-0">
      <iframe
        v-if="pdfUrl"
        :src="pdfUrl"
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
      class="mt-2 p-3 bg-white rounded-lg flex-shrink-0 max-h-64 overflow-y-auto border border-gray-200"
    >
      <p class="text-sm font-medium text-gray-700 mb-2">Summary:</p>
      <div
        class="markdown-content prose prose-sm prose-slate max-w-none"
        v-html="renderedSummary"
      ></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from "vue";
import { marked } from "marked";
import type { ToolResult } from "../types";
import type { PdfToolData } from "../models/pdf";

const props = defineProps<{
  selectedResult: ToolResult<PdfToolData>;
}>();

const pdfUrl = ref<string>("");

const renderedSummary = computed(() => {
  const summary = props.selectedResult.data?.summary;
  if (!summary) return "";
  return marked(summary);
});

onMounted(async () => {
  const pdfData = props.selectedResult.data?.pdfData;
  const fileName = props.selectedResult.data?.fileName;
  const uuid = props.selectedResult.uuid;

  if (!pdfData || !uuid) return;

  try {
    // Call API to save PDF to output folder
    const response = await fetch("/api/save-pdf", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        pdfData,
        uuid,
        fileName: fileName || "document.pdf",
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to save PDF");
    }

    const data = await response.json();
    pdfUrl.value = data.pdfUrl;
  } catch (error) {
    console.error("Failed to save PDF to output folder:", error);
    // Fallback to data URI if saving fails
    pdfUrl.value = pdfData;
  }
});
</script>
