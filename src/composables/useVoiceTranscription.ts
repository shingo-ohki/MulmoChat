import { ref } from "vue";

// Force reload - timestamp: 2025-10-21 13:54
export function useVoiceTranscription() {
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function uploadAudioBlob(blob: Blob, language?: string, model = "whisper-1", timeoutMs = 30000) {
    loading.value = true;
    error.value = null;
    
    console.log(`[useVoiceTranscription] uploadAudioBlob called - language: ${language}, model: ${model}, blob size: ${blob.size}`);
    
    try {
      const form = new FormData();
      // Determine file extension from blob type
      const ext = blob.type.includes("webm") ? "webm" : blob.type.includes("wav") ? "wav" : "mp3";
      form.append("file", blob, `audio.${ext}`);
      form.append("model", model);
      
      // Add language parameter if provided (ISO-639-1 format: "en", "ja", "ko", etc.)
      if (language) {
        form.append("language", language);
        console.log(`[useVoiceTranscription] Added language to form: ${language}`);
      } else {
        console.log(`[useVoiceTranscription] No language specified, will auto-detect`);
      }

      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const res = await fetch("/api/voice/transcribe", {
          method: "POST",
          body: form,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!res.ok) {
          const contentType = res.headers.get("content-type");
          let errorMsg = `Transcription failed: ${res.status}`;
          
          if (contentType?.includes("application/json")) {
            const json = await res.json();
            errorMsg = json.error || json.details || errorMsg;
          } else {
            const txt = await res.text();
            errorMsg = txt || errorMsg;
          }
          
          throw new Error(errorMsg);
        }

        const json = await res.json();
        if (!json.success) {
          throw new Error(json.error || "Transcription failed");
        }
        
        return json;
      } catch (fetchErr) {
        clearTimeout(timeoutId);
        if (fetchErr instanceof Error && fetchErr.name === "AbortError") {
          throw new Error(`Transcription timeout after ${timeoutMs / 1000}s`);
        }
        throw fetchErr;
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      error.value = errMsg;
      console.error("[useVoiceTranscription] Error:", errMsg);
      return { success: false, error: errMsg };
    } finally {
      loading.value = false;
    }
  }

  return { loading, error, uploadAudioBlob };
}
