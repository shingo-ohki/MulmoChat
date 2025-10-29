import { Router } from "express";
import chatRouter from "./chat";

const router = Router();

// Mount chat routes: /api/opinion/chat
router.use("/chat", chatRouter);

// 将来的に追加予定:
// router.use("/voice", voiceRouter);  // 音声対話
// router.use("/logs", logsRouter);    // ログ取得・ダウンロード

export default router;
