<template>
  <div ref="mapContainer" class="map-container"></div>
</template>

<script setup>
import { ref, onMounted, watch } from "vue";

const props = defineProps({
  location: {
    type: [Object, String],
    required: true,
    validator: (value) => {
      if (typeof value === "string") return value.length > 0;
      return (
        value && typeof value.lat === "number" && typeof value.lng === "number"
      );
    },
  },
  apiKey: {
    type: String,
    required: true,
  },
  zoom: {
    type: Number,
    default: 15,
  },
});

const emit = defineEmits(["error"]);

const mapContainer = ref(null);
let map = null;
let marker = null;
let geocoder = null;

const geocodeLocation = (locationName) => {
  return new Promise((resolve, reject) => {
    geocoder.geocode({ address: locationName }, (results, status) => {
      if (status === "OK" && results[0]) {
        const location = results[0].geometry.location;
        resolve({ lat: location.lat(), lng: location.lng() });
      } else {
        reject(new Error(`Geocoding failed: ${status}`));
      }
    });
  });
};

const getCoordinates = async (location) => {
  if (typeof location === "string") {
    return await geocodeLocation(location);
  }
  return location;
};

const initMap = async () => {
  try {
    // Import the geocoding library
    const { Geocoder } = await google.maps.importLibrary("geocoding");
    geocoder = new Geocoder();

    // Import the marker library
    const { AdvancedMarkerElement } = await google.maps.importLibrary("marker");

    const coordinates = await getCoordinates(props.location);

    map = new google.maps.Map(mapContainer.value, {
      center: coordinates,
      zoom: props.zoom,
      mapId: "DEMO_MAP_ID",
    });

    marker = new AdvancedMarkerElement({
      position: coordinates,
      map: map,
    });
  } catch (error) {
    console.error("Error initializing map:", error);
    emit("error", error.message || "Error initializing map");
  }
};

const updateLocation = async (newLocation) => {
  if (map && marker) {
    try {
      const coordinates = await getCoordinates(newLocation);
      map.setCenter(coordinates);
      marker.position = coordinates;
    } catch (error) {
      console.error("Error updating location:", error);
      emit("error", error.message || "Error updating location");
    }
  }
};

const loadGoogleMapsAPI = () => {
  return new Promise((resolve, reject) => {
    if (
      window.google &&
      window.google.maps &&
      window.google.maps.importLibrary
    ) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${props.apiKey}&v=weekly&loading=async`;

    script.onload = () => {
      // Wait a bit for the API to fully initialize
      setTimeout(() => {
        if (
          window.google &&
          window.google.maps &&
          window.google.maps.importLibrary
        ) {
          resolve();
        } else {
          reject(
            new Error("Google Maps API loaded but importLibrary not available"),
          );
        }
      }, 100);
    };
    script.onerror = () => reject(new Error("Failed to load Google Maps API"));

    document.head.appendChild(script);
  });
};

onMounted(async () => {
  try {
    await loadGoogleMapsAPI();
    await initMap();
  } catch (error) {
    console.error("Error loading Google Maps:", error);
    emit("error", error.message || "Error loading Google Maps");
  }
});

watch(() => props.location, updateLocation, { deep: true });

watch(
  () => props.zoom,
  (newZoom) => {
    if (map) {
      map.setZoom(newZoom);
    }
  },
);
</script>

<style scoped>
.map-container {
  width: 100%;
  height: 100vh;
  border-radius: 8px;
  overflow: hidden;
}
</style>
