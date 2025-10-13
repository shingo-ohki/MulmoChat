# MulmoChat

MulmoChat is a prototype of ultimate NLUI application (NL = Natural Language). 

At this monent, it allows the user to
- generate images using Google's nano banana

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
