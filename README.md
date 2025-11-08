これは、AIとの音声対話から意見を抽出するツールです。
[使用イメージ(screencast)](https://drive.google.com/file/d/1h0ufJ-_IQlqzi-BN6N8962f7ABFDCVF3/view)

以下はオリジナルのMulmoChatのREADME

---
# MulmoChat

**MulmoChat is a research prototype exploring a new paradigm for multimodal AI chat experiences.**

Traditional chat interfaces are fundamentally text-based—users interact through messages and receive responses as text. MulmoChat reimagines this interaction model: users engage in natural conversation while simultaneously experiencing rich visual and interactive content directly on canvas.

The key insight: **AI conversations don't have to be limited to text streams.** By designing an architecture where visual experiences and language understanding coexist naturally, we enable a fundamentally different way of interacting with AI—one where images materialize, maps become explorable, games turn playable, all within the conversational flow.

MulmoChat demonstrates the architecture, design patterns, and user experience principles necessary to build truly multimodal chat interfaces where visual and textual communication work together seamlessly.

## Documentation

- **[LLM_OS.md](LLM_OS.md)**  
  Who should read: product strategists and designers exploring the AI-native OS mindset.  
  Start here for the high-level intent paradigm; jump to `WHITEPAPER.md` when you need architecture specifics.
- **[WHITEPAPER.md](WHITEPAPER.md)**  
  Who should read: engineers and researchers implementing or evaluating the orchestration stack.  
  Dive in for system diagrams and workflow detail; reference `LLM_OS.md` for the broader narrative framing.
- **[TOOLPLUGIN.md](TOOLPLUGIN.md)**  
  Who should read: developers extending MulmoChat with new capabilities.  
  Follow this to implement plugins end-to-end, from TypeScript contracts to Vue views and configuration.

## Getting Started

Install dependencies:

```sh
yarn install
```

Create .env file with following API keys:

```
OPENAI_API_KEY=...
GEMINI_API_KEY=...
GOOGLE_MAP_API_KEY=... (optional, required for map features)
EXA_API_KEY=... (optional, required for AI-powered search)
ANTHROPIC_API_KEY=... (optional, required for HTML generation)
OLLAMA_BASE_URL=... (optional, defaults to http://127.0.0.1:11434)
```

Start a development server:

```sh
yarn dev
```

When you open the browser, allow it to access the microphone. 

Click the "Start Voice Chat", and start talking to the AI, which has a capability to generate images.

## Text Model API

MulmoChat now exposes a provider-agnostic text generation API that can be consumed by the client or external integrations.

- `GET /api/text/providers` returns the configured providers (OpenAI, Anthropic, Google Gemini, and Ollama) alongside default model suggestions and credential availability.
- `POST /api/text/generate` accepts `{ provider, model, messages, maxTokens?, temperature?, topP? }` and returns a normalized text response regardless of vendor.

Configure the relevant API keys to enable each provider; Ollama support assumes a local instance listening on `OLLAMA_BASE_URL` (defaults to `http://127.0.0.1:11434`).

### Quick Verification Scripts

With the dev server running (`yarn dev`), you can exercise the unified text API against each provider using the standalone scripts under `server/tests/`:

```sh
# OpenAI (requires OPENAI_API_KEY)
npx tsx server/tests/test-text-openai.ts "Write a haiku about MulmoChat"

# Anthropic (requires ANTHROPIC_API_KEY)
npx tsx server/tests/test-text-anthropic.ts "How does tool calling help agents?"

# Google Gemini (requires GEMINI_API_KEY)
npx tsx server/tests/test-text-google.ts "Suggest onboarding tips for voice-first apps"

# Ollama (assumes local Ollama daemon)
npx tsx server/tests/test-text-ollama.ts "Explain how Ollama integrates with MulmoChat"
```

Each script prints the selected model and the normalized text returned from `POST /api/text/generate`, failing fast with logged diagnostics if the request or provider call does not succeed.
