<template>
  <div class="w-full h-full p-4">
    <GoogleMap
      :location="selectedResult.data?.location"
      :api-key="googleMapKey"
      :zoom="15"
      @error="handleMapError"
    />
  </div>
</template>

<script setup lang="ts">
import type { ToolResult } from "../types";
import GoogleMap from "../../components/GoogleMap.vue";

const props = defineProps<{
  selectedResult: ToolResult | null;
  googleMapKey: string | null;
  sendTextMessage?: (text: string) => void;
}>();

const handleMapError = (errorMessage: string) => {
  if (props.sendTextMessage) {
    props.sendTextMessage(
      `Error loading map for location "${props.selectedResult?.data?.location}": ${errorMessage}`,
    );
  }
};
</script>
