import { Router } from "express";
import logRouter from "./log";

const router = Router();

// Mount log routes: /api/opinion/log
router.use("/log", logRouter);

// 将来的に追加予定:
// router.use("/logs", logsRouter);    // ログ取得・ダウンロード

export default router;
