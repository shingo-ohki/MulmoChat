import { Router } from "express";
import chatRouter from "./chat";
import voiceRouter from "./voice";

const router = Router();

// Mount chat routes: /api/opinion/chat
router.use("/chat", chatRouter);

// Mount voice routes: /api/opinion/voice
router.use("/voice", voiceRouter);

// 将来的に追加予定:
// router.use("/logs", logsRouter);    // ログ取得・ダウンロード

export default router;
