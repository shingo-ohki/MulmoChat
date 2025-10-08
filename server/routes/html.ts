import express, { Request, Response, Router } from "express";
import Anthropic from "@anthropic-ai/sdk";
import dotenv from "dotenv";

dotenv.config();

const router: Router = express.Router();

// Generate HTML with Claude endpoint
router.post(
  "/generate-html",
  async (req: Request, res: Response): Promise<void> => {
    const { prompt, html: existingHtml } = req.body;

    if (!prompt) {
      res.status(400).json({ error: "Prompt is required" });
      return;
    }

    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;

    if (!anthropicApiKey) {
      res
        .status(500)
        .json({ error: "ANTHROPIC_API_KEY environment variable not set" });
      return;
    }

    try {
      const anthropic = new Anthropic({
        apiKey: anthropicApiKey,
      });

      // Choose system prompt based on whether we're modifying existing HTML
      const systemPrompt = existingHtml
        ? `You are an expert HTML developer. Modify the provided HTML based on the user's request.
The HTML must include:
- All styles in a <style> tag within the <head>
- All JavaScript in a <script> tag (can be in <head> or before </body>)
- No external dependencies unless absolutely necessary
- Clean, semantic HTML5
- Responsive design
- Modern CSS

Preserve the existing structure and functionality where possible, only changing what the user requests.
Return ONLY the complete modified HTML code, nothing else. Do not include markdown code blocks or explanations.`
        : `You are an expert HTML developer. Generate a complete, standalone HTML page based on the user's request.
The HTML must include:
- All styles in a <style> tag within the <head>
- All JavaScript in a <script> tag (can be in <head> or before </body>)
- No external dependencies unless absolutely necessary
- Clean, semantic HTML5
- Responsive design
- Modern CSS

Return ONLY the HTML code, nothing else. Do not include markdown code blocks or explanations.`;

      // Build user message with existing HTML if provided
      const userContent = existingHtml
        ? `Here is the existing HTML to modify:\n\n${existingHtml}\n\nModification request: ${prompt}`
        : prompt;

      const message = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 8192,
        messages: [
          {
            role: "user",
            content: userContent,
          },
        ],
        system: systemPrompt,
      });

      // Extract the HTML from the response
      const content = message.content[0];
      if (content.type === "text") {
        let html = content.text;

        // Remove markdown code blocks if present
        html = html.replace(/^```html\n?/i, "").replace(/\n?```$/i, "");

        res.json({
          success: true,
          html: html.trim(),
        });
      } else {
        throw new Error("Unexpected response type from Claude");
      }
    } catch (error: unknown) {
      console.error("HTML generation failed:", error);
      //const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({
        error: "Failed to generate HTML",
        details: error,
      });
    }
  },
);

export default router;
