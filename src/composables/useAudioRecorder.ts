import { ref, Ref } from "vue";

export interface AudioRecorderOptions {
  mimeType?: string;
  audioBitsPerSecond?: number;
}

export function useAudioRecorder(options: AudioRecorderOptions = {}) {
  const isRecording = ref(false);
  const mediaRecorder = ref<MediaRecorder | null>(null);
  const audioChunks = ref<Blob[]>([]);
  const recordedBlob = ref<Blob | null>(null);
  const error = ref<string | null>(null);

  // Default options
  const mimeType = options.mimeType || "audio/webm;codecs=opus";
  const audioBitsPerSecond = options.audioBitsPerSecond || 128000;

  /**
   * Start recording from a MediaStream
   */
  function startRecording(stream: MediaStream) {
    try {
      error.value = null;
      audioChunks.value = [];
      recordedBlob.value = null;

      // Check if the browser supports the specified MIME type
      let actualMimeType = mimeType;
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        console.warn(`MIME type ${mimeType} not supported, falling back to default`);
        // Try common fallbacks
        if (MediaRecorder.isTypeSupported("audio/webm")) {
          actualMimeType = "audio/webm";
        } else if (MediaRecorder.isTypeSupported("audio/mp4")) {
          actualMimeType = "audio/mp4";
        } else {
          actualMimeType = "";
        }
      }

      const recorder = new MediaRecorder(stream, {
        mimeType: actualMimeType,
        audioBitsPerSecond,
      });

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunks.value.push(event.data);
        }
      };

      recorder.onstop = () => {
        if (audioChunks.value.length > 0) {
          recordedBlob.value = new Blob(audioChunks.value, {
            type: actualMimeType || "audio/webm",
          });
        }
        isRecording.value = false;
      };

      recorder.onerror = (event) => {
        console.error("MediaRecorder error:", event);
        error.value = "Recording error occurred";
        isRecording.value = false;
      };

      mediaRecorder.value = recorder;
      recorder.start();
      isRecording.value = true;
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err);
      console.error("Failed to start recording:", err);
    }
  }

  /**
   * Stop the current recording
   */
  function stopRecording(): Promise<Blob | null> {
    return new Promise((resolve) => {
      if (!mediaRecorder.value || !isRecording.value) {
        resolve(recordedBlob.value);
        return;
      }

      // Listen for the stop event
      const recorder = mediaRecorder.value;
      const onStopHandler = () => {
        recorder.removeEventListener("stop", onStopHandler);
        resolve(recordedBlob.value);
      };
      recorder.addEventListener("stop", onStopHandler);

      recorder.stop();
    });
  }

  /**
   * Get the last recorded blob
   */
  function getRecordedBlob(): Blob | null {
    return recordedBlob.value;
  }

  /**
   * Clear the recorded blob
   */
  function clearRecording() {
    audioChunks.value = [];
    recordedBlob.value = null;
  }

  return {
    isRecording,
    recordedBlob,
    error,
    startRecording,
    stopRecording,
    getRecordedBlob,
    clearRecording,
  };
}
