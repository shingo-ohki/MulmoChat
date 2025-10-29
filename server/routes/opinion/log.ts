import express, { Request, Response, Router } from "express";
import fs from "fs";
import path from "path";

const router: Router = express.Router();

const CSV_FILE_PATH = path.join(process.cwd(), "conversation_logs.csv");

// CSV保存用のヘルパー関数
function appendToCSV(
  speaker: "user" | "ai",
  sessionId: string,
  text: string,
  timestamp?: string,
): void {
  const ts = timestamp || new Date().toISOString();
  const row = `${ts},${speaker},${sessionId},"${text.replace(/"/g, '""')}"\n`;

  // ファイルが存在しない場合はヘッダーを追加
  if (!fs.existsSync(CSV_FILE_PATH)) {
    const header = "timestamp,speaker,session_id,text\n";
    fs.writeFileSync(CSV_FILE_PATH, header, "utf-8");
  }

  fs.appendFileSync(CSV_FILE_PATH, row, "utf-8");
}

// POST /api/opinion/log
// WebRTCの会話ログをCSVに保存
router.post("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const { speaker, session_id, text, timestamp } = req.body;

    if (!speaker || !session_id || !text) {
      res.status(400).json({ error: "Missing required fields: speaker, session_id, text" });
      return;
    }

    if (speaker !== "user" && speaker !== "ai") {
      res.status(400).json({ error: "speaker must be 'user' or 'ai'" });
      return;
    }

    appendToCSV(speaker, session_id, text, timestamp);

    res.json({ success: true });
  } catch (error: unknown) {
    console.error("/api/opinion/log error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: "Failed to save log", details: message });
  }
});

export default router;
