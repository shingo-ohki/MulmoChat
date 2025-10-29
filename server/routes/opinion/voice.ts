import { Router, Request, Response } from "express";
import multer from "multer";
import FormData from "form-data";
import { generateText } from "../../llm/textService";
import { TextMessage, TextLLMProviderId } from "../../llm/types";
import fs from "fs/promises";
import path from "path";

const router = Router();

// MVPプロンプト（chat.tsと同じ）
const OPINION_CHAT_SYSTEM_PROMPT = `あなたは住民の意見を自然に引き出すAIアシスタントです。住民が話しやすい雰囲気を作り、オープンクエスチョンや共感、深掘り（5W1H、具体例、理由、感情など）を用いて、回答は1〜2文（最大3文）、1ターン1フォーカスで返してください。抽象的な回答（短く具体性が乏しい）には具体化を、感情語（不安/困る/大変/嬉しい/怖い/心細い/もやもや など）があればまず共感を添え、必要に応じて感情や理由を1点だけ尋ねてください。2〜3ターンの深掘り後は短く共感を挟み、意見がまとまったら平易に要約・確認を行ってください。誘導せず、専門用語は避け、個人情報（住所/電話/マイナンバー等）は求めません。`;

// Few-shot examples
const FEW_SHOT_EXAMPLES: TextMessage[] = [
  { role: "user", content: "ゴミの収集場所が分かりづらいです" },
  {
    role: "assistant",
    content:
      "どんな場面でそう感じましたか？最近の具体的なエピソードがあれば教えてください。",
  },
  { role: "user", content: "引っ越してきたばかりで困りました" },
  {
    role: "assistant",
    content:
      "初めての地域だと不安になりますよね。そのとき、どんな気持ちでしたか？",
  },
  { role: "user", content: "少し心細かったです" },
  {
    role: "assistant",
    content:
      "お話しくださってありがとうございます。もし改善できるなら、どんな方法が良いと思いますか？",
  },
  { role: "user", content: "案内板があると助かります" },
  {
    role: "assistant",
    content:
      "まとめると、収集場所の案内が分かりやすくなると安心できる、ということですね？",
  },
];

// 会話ログ型定義
interface ConversationLogEntry {
  timestamp: string;
  speaker: "user" | "ai";
  session_id: string;
  text: string;
}

const CONVERSATION_LOG_FILE = path.join(
  process.cwd(),
  "conversation_logs.csv",
);

// CSVヘッダーを初期化
async function ensureLogFile() {
  try {
    await fs.access(CONVERSATION_LOG_FILE);
  } catch {
    await fs.writeFile(
      CONVERSATION_LOG_FILE,
      "timestamp,speaker,session_id,text\n",
    );
  }
}

// 会話ログをCSVに追記
async function appendConversationLog(entry: ConversationLogEntry) {
  await ensureLogFile();
  const line = `${entry.timestamp},${entry.speaker},${entry.session_id},"${entry.text.replace(/"/g, '""')}"\n`;
  await fs.appendFile(CONVERSATION_LOG_FILE, line);
}

// Whisper API で音声をテキストに変換
async function transcribeAudio(audioBuffer: Buffer, mimetype: string): Promise<string> {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    throw new Error("OPENAI_API_KEY not set");
  }

  const form = new FormData();
  form.append("file", audioBuffer, {
    filename: "audio.webm",
    contentType: mimetype || "application/octet-stream",
  });
  form.append("model", "whisper-1");
  form.append("language", "ja"); // 日本語に固定

  const formBuffer = form.getBuffer();
  const formHeaders = form.getHeaders();

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openaiKey}`,
      ...formHeaders,
    },
    body: formBuffer as any, // FormDataのBufferをBodyInitとして扱う
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Whisper API error: ${response.status} ${errorText}`);
  }

  const result = (await response.json()) as { text: string };
  return result.text;
}

const upload = multer({ storage: multer.memoryStorage() });

// POST /api/opinion/voice
// multipart/form-data: { file: audio, sessionId: string, history?: JSON string }
router.post(
  "/",
  upload.single("file"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const file = (req as any).file as
        | { buffer?: Buffer; size?: number; mimetype?: string }
        | undefined;

      if (!file || !file.buffer) {
        res.status(400).json({ error: "No audio file uploaded" });
        return;
      }

      const sessionId = req.body.sessionId;
      if (!sessionId || typeof sessionId !== "string") {
        res.status(400).json({ error: "sessionId is required" });
        return;
      }

      // 音声をテキストに変換
      const userMessage = await transcribeAudio(
        file.buffer,
        file.mimetype || "audio/webm",
      );

      console.log(`[Opinion Voice] Transcribed: ${userMessage}`);

      // ユーザー発話をログに記録
      const userTimestamp = new Date().toISOString();
      await appendConversationLog({
        timestamp: userTimestamp,
        speaker: "user",
        session_id: sessionId,
        text: userMessage,
      });

      // メッセージ履歴を構築
      const messages: TextMessage[] = [
        { role: "system", content: OPINION_CHAT_SYSTEM_PROMPT },
        ...FEW_SHOT_EXAMPLES,
      ];

      // 過去の会話履歴があれば追加（直近数ターンのみ）
      let history: ConversationLogEntry[] = [];
      if (req.body.history) {
        try {
          history = JSON.parse(req.body.history);
          const recentHistory = history.slice(-6); // 直近3往復
          for (const entry of recentHistory) {
            messages.push({
              role: entry.speaker === "user" ? "user" : "assistant",
              content: entry.text,
            });
          }
        } catch {
          // JSON parse失敗は無視
        }
      }

      // 現在のユーザー発話を追加
      messages.push({
        role: "user",
        content: userMessage,
      });

      // LLMで応答生成
      const provider: TextLLMProviderId = "openai";
      const model = "gpt-4o-mini";

      const result = await generateText({
        provider,
        model,
        messages,
        temperature: 0.7,
        maxTokens: 150,
      });

      const aiMessage = result.text;

      // AI応答をログに記録
      const aiTimestamp = new Date().toISOString();
      await appendConversationLog({
        timestamp: aiTimestamp,
        speaker: "ai",
        session_id: sessionId,
        text: aiMessage,
      });

      res.json({
        transcribedText: userMessage,
        aiMessage,
      });
    } catch (error) {
      console.error("Opinion voice error:", error);
      res.status(500).json({
        error: "Failed to process voice input",
        details: error instanceof Error ? error.message : String(error),
      });
    }
  },
);

export default router;
