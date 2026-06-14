// PATH: backend/routes/supportChatRoutes.js
import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  getOrCreateMyChat,
  getMessages,
  sendMessage,
} from "../controllers/supportChatController.js";

const router = express.Router();

router.get("/me", protect, getOrCreateMyChat);
router.get("/:chatId/messages", protect, getMessages);
router.post("/:chatId/messages", protect, sendMessage);

export default router;
