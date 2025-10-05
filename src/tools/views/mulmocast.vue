<template>
  <div class="w-full h-full overflow-auto p-4 bg-white">
    <div
      v-if="selectedResult?.data?.mulmoScript?.title"
      style="
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 1em;
      "
    >
      <h1 style="font-size: 2em; margin: 0">
        {{ selectedResult.data.mulmoScript.title }}
      </h1>
      <div style="display: flex; gap: 0.5em">
        <button
          @click="downloadMulmoScript"
          style="
            padding: 0.5em 1em;
            background-color: #4caf50;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 0.9em;
            display: flex;
            align-items: center;
            gap: 0.5em;
          "
        >
          <span class="material-icons" style="font-size: 1.2em">download</span>
          Script
        </button>
        <button
          @click="downloadMovie"
          :disabled="!moviePath"
          :style="{
            padding: '0.5em 1em',
            backgroundColor: moviePath ? '#2196f3' : '#ccc',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: moviePath ? 'pointer' : 'not-allowed',
            fontSize: '0.9em',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5em',
          }"
        >
          <span
            class="material-icons"
            :style="{
              fontSize: '1.2em',
              animation: isGeneratingMovie ? 'spin 1s linear infinite' : 'none',
            }"
          >
            {{ isGeneratingMovie ? "hourglass_empty" : "download" }}
          </span>
          Movie
        </button>
      </div>
    </div>
    <template v-if="selectedResult?.data?.mulmoScript?.beats">
      <div
        v-for="(beat, index) in selectedResult.data.mulmoScript.beats"
        :key="beat.id"
        style="margin-bottom: 1em"
      >
        <div
          v-if="index === 0 && movieError"
          style="
            margin: 1em 0;
            padding: 1em;
            background: #ffebee;
            border-radius: 4px;
            color: #c62828;
          "
        >
          Movie generation failed: {{ movieError }}
        </div>
        <video
          v-else-if="index === 0 && moviePath && movieUrl"
          ref="videoEl"
          :src="movieUrl"
          controls
          style="max-width: 100%; margin: 1em 0"
          @play="handlePlay"
          @pause="handlePause"
          @ended="handleEnded"
        />
        <img
          v-else-if="beat.id && selectedResult.data?.images?.[beat.id]"
          :src="`data:image/png;base64,${selectedResult.data.images[beat.id]}`"
          :alt="beat.text"
          style="max-width: 100%; margin: 1em 0"
        />
        <p style="margin-bottom: 1em">{{ beat.text }}</p>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted, watch } from "vue";
import { v4 as uuidv4 } from "uuid";
import type { ToolResult } from "../types";

const props = defineProps<{
  selectedResult: ToolResult | null;
  setMute?: (muted: boolean) => void;
}>();

const emit = defineEmits<{
  updateResult: [result: ToolResult];
}>();

const movieUrl = ref<string | null>(null);
const videoEl = ref<HTMLVideoElement | null>(null);
const isGeneratingMovie = ref(false);
const movieError = ref<string | null>(null);

// moviePath comes from selectedResult now
const moviePath = computed(() => props.selectedResult?.data?.moviePath || null);

onUnmounted(() => {
  if (movieUrl.value) {
    URL.revokeObjectURL(movieUrl.value);
  }
});

// Generate movie when component mounts with mulmoScript
watch(
  () => props.selectedResult?.data?.mulmoScript,
  async (mulmoScript) => {
    if (
      !mulmoScript ||
      props.selectedResult?.data?.moviePath ||
      isGeneratingMovie.value ||
      !props.selectedResult
    )
      return;

    isGeneratingMovie.value = true;
    movieError.value = null;

    try {
      const uuid = uuidv4();
      const movieResponse = await fetch("/api/generate-movie", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mulmoScript,
          uuid,
          images: props.selectedResult?.data?.images || {},
        }),
      });

      if (movieResponse.ok) {
        const movieResult = await movieResponse.json();

        // Update the result with moviePath and notify parent
        const updatedResult: ToolResult = {
          ...props.selectedResult,
          data: {
            ...props.selectedResult.data,
            moviePath: movieResult.outputPath,
          },
        };
        emit("updateResult", updatedResult);
      } else {
        const error = await movieResponse.json();
        movieError.value =
          error.details || error.error || "Failed to generate movie";
        console.error("Movie generation failed:", movieError.value);
      }
    } catch (error) {
      movieError.value =
        error instanceof Error ? error.message : "Unknown error";
      console.error("Movie generation exception:", error);
    } finally {
      isGeneratingMovie.value = false;
    }
  },
  { immediate: true },
);

// Load movie automatically when moviePath exists
watch(
  moviePath,
  async (path) => {
    if (!path) return;

    try {
      const response = await fetch("/api/download-movie", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          moviePath: path,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to load movie");
      }

      const blob = await response.blob();
      if (movieUrl.value) {
        URL.revokeObjectURL(movieUrl.value);
      }
      movieUrl.value = URL.createObjectURL(blob);
    } catch (error) {
      console.error("Movie loading failed:", error);
    }
  },
  { immediate: true },
);

const downloadMulmoScript = () => {
  if (!props.selectedResult?.data?.mulmoScript) return;

  const jsonString = JSON.stringify(
    props.selectedResult.data.mulmoScript,
    null,
    2,
  );
  const blob = new Blob([jsonString], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "mulmoscript.json";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const downloadMovie = async () => {
  if (!moviePath.value) return;

  try {
    const response = await fetch("/api/download-movie", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        moviePath: moviePath.value,
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to download movie");
    }

    // Extract filename from Content-Disposition header
    const contentDisposition = response.headers.get("Content-Disposition");
    const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
    const filename = filenameMatch ? filenameMatch[1] : "movie.mp4";

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Movie download failed:", error);
    alert(
      `Failed to download movie: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
};

const handlePlay = () => {
  props.setMute?.(true);
};

const handlePause = () => {
  props.setMute?.(false);
};

const handleEnded = () => {
  props.setMute?.(false);
};
</script>

<style scoped>
@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
