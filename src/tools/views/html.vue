<template>
  <div class="w-full h-full overflow-hidden bg-white flex flex-col">
    <div
      v-if="!selectedResult.data?.html"
      class="flex-1 flex items-center justify-center"
    >
      <div class="text-gray-500">No HTML content available</div>
    </div>
    <template v-else>
      <!-- Header with title and library badge -->
      <div
        class="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50"
      >
        <div class="flex items-center gap-3">
          <h1 class="text-xl font-semibold text-gray-800">
            {{ selectedResult.title || "HTML Page" }}
          </h1>
          <span
            :class="[
              'px-2 py-1 rounded text-xs font-medium',
              libraryBadgeClass,
            ]"
          >
            {{ libraryLabel }}
          </span>
        </div>
        <button
          @click="downloadHtml"
          class="flex items-center gap-2 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded text-sm transition-colors"
        >
          <span class="material-icons text-base">download</span>
          HTML
        </button>
      </div>

      <!-- iframe for rendering HTML -->
      <iframe
        ref="iframeRef"
        :srcdoc="processedHtml"
        class="flex-1 w-full border-0"
        sandbox="allow-scripts allow-same-origin"
        @load="onIframeLoad"
      ></iframe>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import type { ToolResult } from "../types";
import type { HtmlToolData, HtmlLibraryType } from "../models/html";

const props = defineProps<{
  selectedResult: ToolResult<HtmlToolData>;
}>();

const iframeRef = ref<HTMLIFrameElement | null>(null);

// Library CDN URLs
const libraryUrls: Record<HtmlLibraryType, string[]> = {
  tailwind: [
    '<script src="https://cdn.tailwindcss.com"><\/script>',
  ],
  "d3.js": [
    '<script src="https://d3js.org/d3.v7.min.js"><\/script>',
  ],
  "three.js": [
    '<script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/"}}<\/script>',
  ],
};

const libraryLabel = computed(() => {
  const type = props.selectedResult.data?.type;
  if (!type) return "";
  const labels: Record<HtmlLibraryType, string> = {
    tailwind: "Tailwind CSS",
    "d3.js": "D3.js",
    "three.js": "Three.js",
  };
  return labels[type];
});

const libraryBadgeClass = computed(() => {
  const type = props.selectedResult.data?.type;
  if (!type) return "";
  const classes: Record<HtmlLibraryType, string> = {
    tailwind: "bg-cyan-100 text-cyan-800",
    "d3.js": "bg-orange-100 text-orange-800",
    "three.js": "bg-purple-100 text-purple-800",
  };
  return classes[type];
});

const processedHtml = computed(() => {
  const html = props.selectedResult.data?.html;
  const type = props.selectedResult.data?.type;

  if (!html || !type) return "";

  // Inject library scripts into the HTML
  const scripts = libraryUrls[type] || [];

  // Find the </head> tag and inject scripts before it
  // If no </head> found, inject after <head> or at the beginning
  let processedHtml = html;

  const headCloseMatch = processedHtml.match(/<\/head>/i);
  if (headCloseMatch) {
    processedHtml = processedHtml.replace(
      /<\/head>/i,
      `${scripts.join("\n")}\n</head>`,
    );
  } else {
    // Try to inject after <head>
    const headOpenMatch = processedHtml.match(/<head[^>]*>/i);
    if (headOpenMatch) {
      processedHtml = processedHtml.replace(
        /<head([^>]*)>/i,
        `<head$1>\n${scripts.join("\n")}`,
      );
    } else {
      // No head tag, inject at the beginning of body or document
      const bodyOpenMatch = processedHtml.match(/<body[^>]*>/i);
      if (bodyOpenMatch) {
        processedHtml = processedHtml.replace(
          /<body([^>]*)>/i,
          `<body$1>\n${scripts.join("\n")}`,
        );
      } else {
        // Last resort: prepend to the document
        processedHtml = scripts.join("\n") + "\n" + processedHtml;
      }
    }
  }

  return processedHtml;
});

const onIframeLoad = () => {
  console.log("HTML iframe loaded successfully");
};

const downloadHtml = () => {
  if (!processedHtml.value) return;

  const blob = new Blob([processedHtml.value], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  const filename = props.selectedResult.title
    ? `${props.selectedResult.title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.html`
    : "page.html";
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
</script>
