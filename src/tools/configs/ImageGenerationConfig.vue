<template>
  <div>
    <label class="block text-sm font-medium text-gray-700 mb-2">
      Image Generation Backend
    </label>
    <select
      :value="value"
      @change="$emit('update:value', ($event.target as HTMLSelectElement).value)"
      class="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      <option value="gemini">Google Gemini</option>
      <option value="comfyui">ComfyUI (Local)</option>
    </select>
    <p class="text-xs text-gray-500 mt-1">
      Choose between cloud-based Gemini or local ComfyUI for image generation.
    </p>
  </div>
</template>

<script setup lang="ts">
defineProps<{ value: "gemini" | "comfyui" }>();
defineEmits<{ "update:value": [value: "gemini" | "comfyui"] }>();
</script>
