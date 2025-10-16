# OpenCanvas Tool Call Test

## Overview

This test program verifies that when a user sends the message "open canvas", the LLM correctly interprets the intent and generates a tool call to the `openCanvas` function.

The test **does not execute** the actual `openCanvas` API - it only verifies that the LLM generates the appropriate tool call structure.

## What It Tests

1. **User Input**: Sends the message "open canvas" to the LLM
2. **Tool Definition**: Provides the `openCanvas` tool definition to the LLM
3. **Verification**: Checks that the LLM response includes a tool call to `openCanvas`

## Prerequisites

- Node.js installed
- OpenAI API key set in environment variables
- Server running on `http://localhost:3001` (or set `TEST_SERVER_URL`)

## Setup

1. Create a `.env` file in the project root with your OpenAI API key:

```bash
OPENAI_API_KEY=sk-...
```

2. (Optional) Override the default model:

```bash
OPENAI_TEST_MODEL=gpt-4o-mini
```

3. (Optional) Override the test server URL:

```bash
TEST_SERVER_URL=http://localhost:3001
```

## Running the Test

### Option 1: Direct execution with tsx

```bash
npx tsx server/tests/test-opencanvas.ts
```

### Option 2: Add to package.json scripts

Add to your `package.json`:

```json
{
  "scripts": {
    "test:opencanvas": "tsx server/tests/test-opencanvas.ts"
  }
}
```

Then run:

```bash
npm run test:opencanvas
```

## Expected Output

On success:

```
=== OpenCanvas Tool Call Test ===

Model: gpt-4o-mini

Step 1: Sending user message "open canvas"...

Model response text: ""

✓ Tool calls received: 1

✓ Verified: LLM called openCanvas tool
  Tool Call ID: call_abc123
  Arguments: (no arguments)

Token usage: { prompt_tokens: 45, completion_tokens: 12, total_tokens: 57 }

✅ TEST PASSED: LLM correctly generated openCanvas tool call!
```

On failure (if LLM doesn't call the tool):

```
❌ TEST FAILED: Expected openCanvas tool call but got none!
```

## How It Works

1. **Tool Definition**: The test provides the exact tool definition used in the app:
   ```typescript
   {
     type: "function",
     name: "openCanvas",
     description: "Open a drawing canvas for the user to create drawings, sketches, or diagrams."
   }
   ```

2. **API Call**: Sends a POST request to `/api/text/generate` with:
   - User message: "open canvas"
   - Available tools: `[openCanvasTool]`

3. **Response Parsing**: Checks the response for:
   - `success: true`
   - `result.toolCalls` array containing an entry with `name: "openCanvas"`

4. **Verification**: Confirms the LLM understood the natural language intent and mapped it to the correct function call

## Key Points

- This is a **behavioral test** of LLM tool calling capabilities
- It tests the **intent mapping**: natural language → function call
- The test is **isolated** - it doesn't depend on the full Vue.js app
- It uses the same API endpoint (`/api/text/generate`) that the text-rest transport uses
- The `openCanvas` tool requires no parameters, so the test expects empty or no arguments

## Troubleshooting

### Server not running
```
Request failed: ECONNREFUSED
```
**Solution**: Start the development server with `npm run dev:server`

### Missing API key
```
OPENAI_API_KEY is required to run this test.
```
**Solution**: Add `OPENAI_API_KEY=sk-...` to your `.env` file

### LLM doesn't call the tool

If the LLM returns text instead of a tool call, it might be:
- Model version doesn't support function calling well
- Try a different model: `OPENAI_TEST_MODEL=gpt-4o`
- The user message might be too ambiguous (though "open canvas" should work)

## Related Files

- **Test Implementation**: `server/tests/test-opencanvas.ts`
- **Canvas Tool Definition**: `src/tools/models/canvas.ts`
- **Tool System**: `src/tools/index.ts`
- **Text Session Transport**: `src/composables/useTextSession.ts`
