import { ref } from "vue";

export function useOpinionLogger() {
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function logOpinion(sessionId: string, text: string): Promise<boolean> {
    loading.value = true;
    error.value = null;

    try {
      const response = await fetch("/api/log_opinion", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          session_id: sessionId,
          timestamp: new Date().toISOString(),
          text: text.trim(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const result = await response.json();
      return result.success;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      error.value = errorMessage;
      console.error("[useOpinionLogger] Failed to log opinion:", errorMessage);
      return false;
    } finally {
      loading.value = false;
    }
  }

  return {
    loading,
    error,
    logOpinion,
  };
}
