# Text Model Support Roadmap

## Goal
Enable MulmoChat to switch between the existing GPT Realtime voice experience and purely text-based large language models (e.g., GPT-5 text, Claude 3.5 Sonnet), while keeping tool interoperability and minimizing UI disruption.

## Context Snapshot
- Voice sessions rely on `/api/start` to mint an OpenAI Realtime ephemeral key and then stream audio/text via WebRTC (`useRealtimeSession`).
- Outgoing messages and tool traffic ride over the Realtime data channel; the client assumes audio streams exist.
- Tool execution is decoupled (`useToolResults`) and should stay agnostic to the transport, provided we can deliver tool call arguments and capture tool outputs.
- Server currently has no text completion proxy endpoints; everything funnels through the Realtime flow.

## Development Phases

### Phase 1 – Design + Model Registry
- Inventory target text models (OpenAI `responses` GPT-5 series, Anthropic Claude Sonnet 4) and capture their API capabilities (streaming, tool call schema, max tokens) in a shared config module.
- Extend `useUserPreferences` (and persisted state) to represent a `modelKind` (`realtime-voice` vs `text-only`) and selected `modelId`.
- Update `/api/start` to return the advertised model catalogue so the client can render available options without another round trip.

### Phase 2 – Transport Abstraction
- Split the current `useRealtimeSession` into a transport-agnostic interface plus two concrete adapters: `useVoiceRealtimeSession` (existing WebRTC flow) and a new `useTextSession` that talks to RESTful completion endpoints.
- Define a minimal session contract (start/stop, sendUserMessage, emitTextDelta/Completed, emitToolCall, sendToolOutput) that both adapters implement so the rest of the app can swap seamlessly.
- Gate audio controls (mute, remote audio attachment) behind the voice adapter; provide no-op implementations for text mode.

### Phase 3 – Server Text Proxy Endpoints
- Add `/api/text-session/start` to issue any model-specific credentials (e.g., forward OpenAI API key, confirm Anthropic key) and respond with feature flags.
- Implement `/api/text-session/message` that accepts the accumulated conversation, calls the chosen provider (`responses` for OpenAI, `messages` for Anthropic), streams deltas back via SSE or chunked JSON, and normalizes function/tool calls into the existing `ToolCallMessage` shape.
- Consolidate provider-specific logic in a service layer with reusable throttling/retry helpers and consistent error reporting.

### Phase 4 – Client Text Session Hook
- Build `useTextSession` to call the new REST endpoints, maintain conversation state, emit deltas, and surface tool call events to `useToolResults`.
- Reuse the current retry logic for message sends; ensure we queue `response.create` equivalents so tool calls still resolve through the same pathways.
- Wire the composable selection in `App.vue` based on the chosen `modelKind`, and adjust UI affordances (disable audio recorder, rename controls to “Connect/Disconnect” where appropriate).

### Phase 5 – UI/UX Enhancements
- Expose a model selector in `Sidebar.vue` (or a dedicated settings modal) that lists voice vs text models, shows availability badges (e.g., Claude requires configured key), and triggers the `switchMode` helper.
- Provide inline feedback when attempting to send audio while in text mode, and optionally surface transcription via the existing upload flow if we want to keep voice input for text models.
- Update instruction builder logic so mode- or provider-specific system prompts are injected automatically.

### Phase 6 – Tool & Conversation Alignment
- Verify that tool payloads from text providers map cleanly to the existing `processToolCall` contract; add translation shims where schema names differ (e.g., Anthropic `tool_use` events).
- Ensure `sendFunctionCallOutput` works for both transports: send on the Realtime data channel for voice, POST to `/api/text-session/tool-output` (or piggyback on message endpoint) for text.
- Add safeguards for token budgeting (truncate history, surface “context trimmed” warnings) since text models will likely rely on turn-based context windows.

### Phase 7 – Testing & Hardening
- Set up mocked provider clients (via MSW or node interceptors) so we can exercise both adapters without live API keys.
- Add integration smoke scripts: one for voice (existing) and one that spins a text session, sends a tool-enabled prompt, and validates the UI updates.
- Document environment variable expectations in README (new `ANTHROPIC_API_KEY`, optional custom model IDs) and capture manual test steps.

## Risks & Mitigations
- **Streaming mismatch**: Providers differ in streaming formats. Mitigate by normalizing server responses into a shared SSE schema consumed by the client.
- **Tool schema divergence**: Anthropic vs OpenAI tool call shapes differ. Introduce translation utilities and add unit tests that feed synthetic payloads through the pipeline.
- **UI complexity**: Extra selector clutter. Keep defaults simple (voice model highlighted) and hide text models when keys are missing.
- **Audio/UX regressions**: Ensure voice adapter remains untouched by guarding new code behind feature flags and re-running the audio handshake tests.

## Deliverables Checklist
- [ ] Configurable model registry with provider metadata.
- [ ] Dual transport session hooks (`useVoiceRealtimeSession`, `useTextSession`).
- [ ] New server endpoints proxying text models with normalized streaming.
- [ ] Updated UI for model selection and mode-aware controls.
- [ ] Tests/mocks covering tool-call translation and session switching.
- [ ] Documentation updates (README, settings instructions).
