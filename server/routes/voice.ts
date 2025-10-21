import express, { Request, Response, Router } from "express";
import multer from "multer";
import FormData from "form-data";
import dotenv from "dotenv";
dotenv.config();

const router: Router = express.Router();

// Basic server-side limits
const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME = [
  "audio/webm",
  "audio/wav",
  "audio/x-wav",
  "audio/mpeg",
  "audio/mp3",
  "audio/ogg",
  "audio/opus",
];

const upload = multer({ storage: multer.memoryStorage() });

// POST /api/voice/transcribe
// Expects a multipart/form-data with field `file` containing audio (webm/mp3/wav)
router.post(
  "/voice/transcribe",
  upload.single("file"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const openaiKey = process.env.OPENAI_API_KEY;
      if (!openaiKey) {
        res.status(500).json({ error: "OPENAI_API_KEY environment variable not set" });
        return;
      }

      const file = (req as any).file as { buffer?: Buffer; size?: number; mimetype?: string; originalname?: string } | undefined;
      if (!file || !file.buffer) {
        res.status(400).json({ error: "No file uploaded" });
        return;
      }
      
      console.log("[Voice] Received request body:", req.body);
      console.log("[Voice] File info:", { size: file.size, mimetype: file.mimetype, originalname: file.originalname });

      // Validate file size
      const size = typeof file.size === "number" ? file.size : file.buffer.length;
      if (size > MAX_FILE_BYTES) {
        res.status(413).json({ error: "File too large" });
        return;
      }

      // Validate mime-type
      const mimetype = file.mimetype || "";
      if (!ALLOWED_MIME.includes(mimetype)) {
        res.status(415).json({ error: "Unsupported media type", details: mimetype });
        return;
      }

      // Build multipart form to forward to OpenAI Whisper endpoint
      const form = new FormData();
      
      // WORKAROUND: Client cache issue - if model is a language code, swap it
      const LANGUAGE_CODES = ["en", "ja", "ko", "zh", "es", "fr", "de", "it", "pt", "ru", "ar", "hi"];
      let modelParam = (req.body.model as string) || "whisper-1";
      let languageParam = req.body.language as string | undefined;
      
      if (LANGUAGE_CODES.includes(modelParam)) {
        console.log(`[Voice] WORKAROUND: Detected language code '${modelParam}' in model field, swapping to language parameter`);
        languageParam = modelParam;
        modelParam = "whisper-1";
      }
      
      // 1. file first
      form.append("file", file.buffer, {
        filename: file.originalname || "audio.webm",
        contentType: file.mimetype || "application/octet-stream",
      });
      
      // 2. model second
      form.append("model", modelParam);
      
      // 3. language last (if provided)
      if (languageParam) {
        form.append("language", languageParam);
        console.log(`[Voice] Adding language parameter: ${languageParam}`);
      }
      
      console.log(`[Voice] Final params - model: ${modelParam}, language: ${languageParam || 'auto-detect'}`);

      // Convert form to buffer using getBuffer method
      const formBuffer = form.getBuffer();
      const formHeaders = form.getHeaders();

      const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openaiKey}`,
          // Merge form headers (includes Content-Type with boundary)
          ...formHeaders,
        },
        body: formBuffer,
      });

      if (!response.ok) {
        const text = await response.text();
        console.error("OpenAI transcription error:", response.status, text);
        res.status(500).json({ error: "Transcription failed", details: text });
        return;
      }

      const data = await response.json();
      // OpenAI returns { text: "..." }
      const text = (data && data.text) || "";
      res.json({ success: true, text });
    } catch (error: unknown) {
      console.error("/voice/transcribe error:", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ error: "Server error", details: message });
    }
  },
);

export default router;
