<template>
  <div class="h-full w-full overflow-y-auto p-6">
    <div class="max-w-3xl mx-auto space-y-4">
      <div class="rounded-lg border bg-white shadow-sm p-5" :class="roleTheme">
        <div
          class="flex justify-between items-start mb-2 text-sm text-gray-500"
        >
          <span class="font-medium text-gray-700">{{ speakerLabel }}</span>
          <span v-if="transportKind" class="italic">{{ transportKind }}</span>
        </div>
        <div
          class="markdown-content prose prose-slate max-w-none leading-relaxed text-gray-900"
          v-html="renderedHtml"
        ></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { marked } from "marked";
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

const renderedHtml = computed(() => {
  if (!messageText.value) return "";

  // Process <think> blocks to make them grey
  const processedText = messageText.value.replace(
    /<think>([\s\S]*?)<\/think>/g,
    (_, content) => {
      // Render the think block content as markdown and wrap in a styled div
      const thinkContent = marked(content.trim());
      return `<div class="think-block">${thinkContent}</div>`;
    }
  );

  return marked(processedText);
});

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

<style scoped>
.markdown-content :deep(h1) {
  font-size: 2rem;
  font-weight: bold;
  margin-top: 1em;
  margin-bottom: 0.5em;
}

.markdown-content :deep(h2) {
  font-size: 1.75rem;
  font-weight: bold;
  margin-top: 1em;
  margin-bottom: 0.5em;
}

.markdown-content :deep(h3) {
  font-size: 1.5rem;
  font-weight: bold;
  margin-top: 1em;
  margin-bottom: 0.5em;
}

.markdown-content :deep(h4) {
  font-size: 1.25rem;
  font-weight: bold;
  margin-top: 1em;
  margin-bottom: 0.5em;
}

.markdown-content :deep(h5) {
  font-size: 1.125rem;
  font-weight: bold;
  margin-top: 1em;
  margin-bottom: 0.5em;
}

.markdown-content :deep(h6) {
  font-size: 1rem;
  font-weight: bold;
  margin-top: 1em;
  margin-bottom: 0.5em;
}

.markdown-content :deep(p) {
  margin-bottom: 1em;
}

.markdown-content :deep(ul),
.markdown-content :deep(ol) {
  margin-left: 1.5em;
  margin-bottom: 1em;
}

.markdown-content :deep(li) {
  margin-bottom: 0.5em;
}

.markdown-content :deep(code) {
  background-color: #f5f5f5;
  padding: 0.2em 0.4em;
  border-radius: 3px;
  font-family: monospace;
  font-size: 0.9em;
}

.markdown-content :deep(pre) {
  background-color: #f5f5f5;
  padding: 1em;
  border-radius: 4px;
  overflow-x: auto;
  margin-bottom: 1em;
}

.markdown-content :deep(pre code) {
  background-color: transparent;
  padding: 0;
}

.markdown-content :deep(blockquote) {
  border-left: 4px solid #ddd;
  padding-left: 1em;
  color: #666;
  margin: 1em 0;
}

.markdown-content :deep(a) {
  color: #2563eb;
  text-decoration: underline;
}

.markdown-content :deep(a:hover) {
  color: #1d4ed8;
}

.markdown-content :deep(table) {
  border-collapse: collapse;
  width: 100%;
  margin-bottom: 1em;
}

.markdown-content :deep(th),
.markdown-content :deep(td) {
  border: 1px solid #ddd;
  padding: 0.5em;
  text-align: left;
}

.markdown-content :deep(th) {
  background-color: #f5f5f5;
  font-weight: bold;
}

.markdown-content :deep(hr) {
  border: none;
  border-top: 1px solid #ddd;
  margin: 1.5em 0;
}

.markdown-content :deep(.think-block) {
  color: #6b7280;
  background-color: #f9fafb;
  border-left: 3px solid #d1d5db;
  padding: 0.75em 1em;
  margin: 1em 0;
  border-radius: 4px;
  font-style: italic;
}

.markdown-content :deep(.think-block p) {
  color: #6b7280;
}

.markdown-content :deep(.think-block code) {
  background-color: #e5e7eb;
  color: #4b5563;
}
</style>
