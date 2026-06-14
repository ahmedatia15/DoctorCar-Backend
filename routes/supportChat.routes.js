// PATH: backend/routes/supportChat.routes.js
import express from "express";
import {
  getOrCreateMySupportChat,
  getChatMessages,
  sendMessageREST,
} from "../controllers/supportChat.controller.js";

import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/me", authMiddleware, getOrCreateMySupportChat);
router.get("/:chatId/messages", authMiddleware, getChatMessages);
router.post("/:chatId/messages", authMiddleware, sendMessageREST);

export default router;
