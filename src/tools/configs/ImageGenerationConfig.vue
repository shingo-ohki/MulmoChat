<template>
  <div class="space-y-4">
    <div>
      <label class="block text-sm font-medium text-gray-700 mb-2">
        Image Generation Backend
      </label>
      <select
        :value="currentValue.backend"
        @change="handleBackendChange"
        class="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="gemini">Google Gemini</option>
        <option value="comfyui">ComfyUI (Local)</option>
      </select>
      <p class="text-xs text-gray-500 mt-1">
        Choose between cloud-based Gemini or local ComfyUI for image generation.
      </p>
    </div>

    <div>
      <label class="block text-sm font-medium text-gray-700 mb-2">
        Additional Style Modifier
      </label>
      <input
        type="text"
        :value="currentValue.styleModifier || ''"
        @input="handleStyleModifierChange"
        placeholder="e.g., ghibli-style anime, oil painting, cyberpunk"
        class="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <p class="text-xs text-gray-500 mt-1">
        This style will be automatically appended to all image generation
        prompts. Leave empty for no additional styling.
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

export interface ImageGenerationConfigValue {
  backend: "gemini" | "comfyui";
  styleModifier?: string;
}

const props = defineProps<{
  value: "gemini" | "comfyui" | ImageGenerationConfigValue;
}>();

const emit = defineEmits<{
  "update:value": [value: ImageGenerationConfigValue];
}>();

// Handle legacy string values and new object values
const currentValue = computed<ImageGenerationConfigValue>(() => {
  if (typeof props.value === "string") {
    return { backend: props.value, styleModifier: "" };
  }
  return props.value;
});

const handleBackendChange = (event: Event) => {
  const backend = (event.target as HTMLSelectElement).value as
    | "gemini"
    | "comfyui";
  emit("update:value", {
    ...currentValue.value,
    backend,
  });
};

const handleStyleModifierChange = (event: Event) => {
  const styleModifier = (event.target as HTMLInputElement).value;
  emit("update:value", {
    ...currentValue.value,
    styleModifier,
  });
};
</script>
