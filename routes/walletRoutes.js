import express from "express";
import { getWallet, addFunds, withdrawFunds } from "../controllers/walletController.js";
import { protect } from "../utils/authMiddleware.js";

const router = express.Router();

// 🪙 جلب بيانات المحفظة الخاصة بالمستخدم الحالي
router.get("/", protect, getWallet);

// 💰 إضافة رصيد للمحفظة (اختياري للأدمن أو العميل)
router.post("/add", protect, addFunds);

// 💸 سحب رصيد (للفني)
router.post("/withdraw", protect, withdrawFunds);

export default router;
