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
```

Start a development server:

```sh
yarn dev
```

When you open the browser, allow it to access the microphone. 

Click the "Start Voice Chat", and start talking to the AI, which has a capability to generate images.