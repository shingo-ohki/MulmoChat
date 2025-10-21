/* eslint-env browser */

import { ref, shallowRef } from "vue";
import type { StartApiResponse } from "../../server/types";
import type { BuildContext, ToolCallMessage } from "./types";
import { isValidToolCallMessage } from "./types";
import { DEFAULT_REALTIME_MODEL_ID } from "../config/models";

type BrowserRTCPeerConnection = globalThis.RTCPeerConnection;
type BrowserRTCDataChannel = globalThis.RTCDataChannel;
type BrowserMediaStream = globalThis.MediaStream;
/* eslint-disable-next-line no-undef */
type BrowserHTMLAudioElement = HTMLAudioElement;

export interface RealtimeSessionEventHandlers {
  onToolCall?: (msg: ToolCallMessage, id: string, argStr: string) => void;
  onTextDelta?: (delta: string) => void;
  onTextCompleted?: () => void;
  onConversationStarted?: () => void;
  onConversationFinished?: () => void;
  onSpeechStarted?: () => void;
  onSpeechStopped?: () => void;
  onError?: (error: unknown) => void;
}

export interface RealtimeSessionOptions {
  buildInstructions: (context: BuildContext) => string;
  buildTools: (context: BuildContext) => unknown[];
  handlers?: RealtimeSessionEventHandlers;
  getModelId?: (context: BuildContext) => string;
}

export interface UseRealtimeSessionReturn {
  chatActive: ReturnType<typeof ref<boolean>>;
  conversationActive: ReturnType<typeof ref<boolean>>;
  connecting: ReturnType<typeof ref<boolean>>;
  isMuted: ReturnType<typeof ref<boolean>>;
  startResponse: ReturnType<typeof ref<StartApiResponse | null>>;
  isDataChannelOpen: () => boolean;
  startChat: () => Promise<void>;
  stopChat: () => void;
  sendUserMessage: (text: string) => Promise<boolean>;
  sendFunctionCallOutput: (callId: string, output: string) => boolean;
  sendInstructions: (instructions: string) => boolean;
  setMute: (muted: boolean) => void;
  setLocalAudioEnabled: (enabled: boolean) => void;
  attachRemoteAudioElement: (audio: BrowserHTMLAudioElement | null) => void;
  registerEventHandlers: (
    handlers: Partial<RealtimeSessionEventHandlers>,
  ) => void;
  getLocalStream: () => BrowserMediaStream | null;
}

interface WebRtcState {
  pc: BrowserRTCPeerConnection | null;
  dc: BrowserRTCDataChannel | null;
  localStream: BrowserMediaStream | null;
  remoteStream: BrowserMediaStream | null;
}

export function useRealtimeSession(
  options: RealtimeSessionOptions,
): UseRealtimeSessionReturn {
  let handlers: RealtimeSessionEventHandlers = {
    ...(options.handlers ?? {}),
  };

  const registerEventHandlers = (
    newHandlers: Partial<RealtimeSessionEventHandlers>,
  ) => {
    handlers = {
      ...handlers,
      ...newHandlers,
    };
  };

  const chatActive = ref(false);
  const conversationActive = ref(false);
  const connecting = ref(false);
  const isMuted = ref(false);
  const startResponse = ref<StartApiResponse | null>(null);
  const pendingToolArgs: Record<string, string> = {};
  const processedToolCalls = new Map<string, string>();
  const remoteAudioElement = shallowRef<BrowserHTMLAudioElement | null>(null);

  const webrtc: WebRtcState = {
    pc: null,
    dc: null,
    localStream: null,
    remoteStream: null,
  };

  const sendDataChannelMessage = (message: unknown): boolean => {
    if (!webrtc.dc || webrtc.dc.readyState !== "open") {
      console.warn(
        "Cannot send message because the data channel is not ready.",
      );
      return false;
    }
    const payload =
      typeof message === "string" ? message : JSON.stringify(message);
    webrtc.dc.send(payload);
    return true;
  };

  const handleMessage = (event: MessageEvent) => {
    let msg: ToolCallMessage;

    try {
      msg = JSON.parse(event.data) as ToolCallMessage;
    } catch (error) {
      console.error("Failed to parse message:", error);
      handlers.onError?.(error);
      return;
    }

    if (!isValidToolCallMessage(msg)) {
      console.warn("Invalid message format:", msg);
      return;
    }

    const id = msg.id || msg.call_id;

    switch (msg.type) {
      case "error":
        console.error("Error", msg.error);
        handlers.onError?.(msg.error);
        break;
      case "response.text.delta":
        handlers.onTextDelta?.(msg.delta ?? "");
        break;
      case "response.completed":
        handlers.onTextCompleted?.();
        break;
      case "response.function_call_arguments.delta":
        if (id) {
          pendingToolArgs[id] = (pendingToolArgs[id] || "") + (msg.delta ?? "");
        }
        break;
      case "response.function_call_arguments.done": {
        if (!id) break;
        const argStr = pendingToolArgs[id] || msg.arguments || "";
        delete pendingToolArgs[id];
        if (msg.truncated) {
          console.warn(
            `******* Abandoning truncated tool call for ${msg.name || msg.call_id}`,
          );
          processedToolCalls.delete(id);
          break;
        }
        const previousArgs = processedToolCalls.get(id);
        if (previousArgs === argStr) {
          console.warn(
            `******* Skipping duplicate tool call for ${msg.name || msg.call_id}`,
          );
          break;
        }
        console.log(`MSG: toolcall\n${argStr}`);
        processedToolCalls.set(id, argStr);
        handlers.onToolCall?.(msg, id, argStr);
        break;
      }
      case "response.created":
        conversationActive.value = true;
        handlers.onConversationStarted?.();
        break;
      case "response.done":
        conversationActive.value = false;
        handlers.onConversationFinished?.();
        break;
      case "input_audio_buffer.speech_started":
        handlers.onSpeechStarted?.();
        break;
      case "input_audio_buffer.speech_stopped":
        handlers.onSpeechStopped?.();
        break;
    }
  };

  const attachRemoteAudioElement = (audio: BrowserHTMLAudioElement | null) => {
    remoteAudioElement.value = audio;
    if (audio && webrtc.remoteStream) {
      audio.srcObject = webrtc.remoteStream;
    }
  };

  const setMute = (muted: boolean) => {
    isMuted.value = muted;
    if (webrtc.localStream) {
      const audioTracks = webrtc.localStream.getAudioTracks();
      audioTracks.forEach((track) => {
        track.enabled = !muted;
      });
    }
  };

  const setLocalAudioEnabled = (enabled: boolean) => {
    if (webrtc.localStream) {
      const audioTracks = webrtc.localStream.getAudioTracks();
      audioTracks.forEach((track) => {
        track.enabled = enabled;
      });
    }
  };

  const stopChat = () => {
    if (webrtc.pc) {
      webrtc.pc.close();
      webrtc.pc = null;
    }
    if (webrtc.dc) {
      webrtc.dc.close();
      webrtc.dc = null;
    }
    if (webrtc.localStream) {
      webrtc.localStream.getTracks().forEach((track) => track.stop());
      webrtc.localStream = null;
    }
    if (webrtc.remoteStream) {
      webrtc.remoteStream.getTracks().forEach((track) => track.stop());
      webrtc.remoteStream = null;
    }
    if (remoteAudioElement.value) {
      remoteAudioElement.value.srcObject = null;
    }
    chatActive.value = false;
    conversationActive.value = false;
    setMute(false);
  };

  const startChat = async () => {
    if (chatActive.value || connecting.value) return;

    connecting.value = true;

    try {
      const response = await fetch("/api/start", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      startResponse.value = await response.json();

      if (!startResponse.value?.ephemeralKey) {
        throw new Error("No ephemeral key received from server");
      }
    } catch (err) {
      console.error("Failed to get ephemeral key:", err);
      globalThis.alert("Failed to start session. Check console for details.");
      connecting.value = false;
      return;
    }

    try {
      webrtc.pc = new globalThis.RTCPeerConnection();

      const dc = webrtc.pc.createDataChannel("oai-events");
      webrtc.dc = dc;
      dc.addEventListener("open", () => {
        const instructions = options.buildInstructions({
          startResponse: startResponse.value,
        });
        const modelId =
          options.getModelId?.({
            startResponse: startResponse.value,
          }) ?? DEFAULT_REALTIME_MODEL_ID;
        console.log(`INSTRUCTIONS:\n${instructions}`);
        const tools = options.buildTools({
          startResponse: startResponse.value,
        });
        sendDataChannelMessage({
          type: "session.update",
          session: {
            type: "realtime",
            model: modelId,
            instructions,
            audio: {
              output: {
                voice: "shimmer",
              },
            },
            tools,
          },
        });
      });
      dc.addEventListener("message", handleMessage);
      dc.addEventListener("close", () => {
        webrtc.dc = null;
      });

      webrtc.remoteStream = new globalThis.MediaStream();
      webrtc.pc.ontrack = (event) => {
        webrtc.remoteStream?.addTrack(event.track);
        if (remoteAudioElement.value) {
          remoteAudioElement.value.srcObject = webrtc.remoteStream;
        }
      };

      webrtc.localStream = await globalThis.navigator.mediaDevices.getUserMedia(
        {
          audio: true,
        },
      );
      webrtc.localStream
        .getTracks()
        .forEach((track) =>
          webrtc.pc?.addTrack(track, webrtc.localStream as BrowserMediaStream),
        );

      const offer = await webrtc.pc.createOffer();
      await webrtc.pc.setLocalDescription(offer);

      const response = await fetch("https://api.openai.com/v1/realtime/calls", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${startResponse.value?.ephemeralKey}`,
          "Content-Type": "application/sdp",
        },
        body: offer.sdp,
      });
      const responseText = await response.text();

      await webrtc.pc.setRemoteDescription({
        type: "answer",
        sdp: responseText,
      });
      chatActive.value = true;
    } catch (err) {
      console.error(err);
      stopChat();
      globalThis.alert(
        "Failed to start voice chat. Check console for details.",
      );
    } finally {
      connecting.value = false;
    }
  };

  const sendUserMessage = async (text: string) => {
    if (!chatActive.value || !webrtc.dc || webrtc.dc.readyState !== "open") {
      console.warn(
        "Cannot send text message because the data channel is not ready.",
      );
      return false;
    }

    console.log(`MSG:\n`, text);
    const itemSuccess = sendDataChannelMessage({
      type: "conversation.item.create",
      item: {
        type: "message",
        role: "user",
        content: [
          {
            type: "input_text",
            text,
          },
        ],
      },
    });

    if (!itemSuccess) {
      return false;
    }

    const responseSuccess = sendDataChannelMessage({
      type: "response.create",
      response: {},
    });

    return responseSuccess;
  };

  const sendFunctionCallOutput = (callId: string, output: string) => {
    return sendDataChannelMessage({
      type: "conversation.item.create",
      item: {
        type: "function_call_output",
        call_id: callId,
        output,
      },
    });
  };

  const sendInstructions = (instructions: string) => {
    return sendDataChannelMessage({
      type: "response.create",
      response: {
        instructions,
      },
    });
  };

  const isDataChannelOpen = () => webrtc.dc?.readyState === "open";

  // Get local audio stream for voice transcription
  const getLocalStream = () => webRtcState.localStream;

  return {
    chatActive,
    conversationActive,
    connecting,
    isMuted,
    startResponse,
    isDataChannelOpen,
    getLocalStream, // Added for voice transcription
    startChat,
    stopChat,
    sendUserMessage,
    sendFunctionCallOutput,
    sendInstructions,
    setMute,
    setLocalAudioEnabled,
    attachRemoteAudioElement,
    registerEventHandlers,
  };
}
