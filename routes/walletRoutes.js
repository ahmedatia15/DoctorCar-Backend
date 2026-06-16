import express from "express";
import {
  getWallet,
  addFunds,
  withdrawFunds,
  rechargeBalance,
} from "../controllers/walletController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// 🪙 جلب بيانات المحفظة الخاصة بالمستخدم الحالي
router.get("/", protect, getWallet);

// 💳 شحن الرصيد (يحدّث رصيد المستخدم ويعيد الرصيد الجديد)
router.post("/recharge", protect, rechargeBalance);

// 💰 إضافة رصيد للمحفظة (اختياري للأدمن أو العميل)
router.post("/add", protect, addFunds);

// 💸 سحب رصيد (للفني)
router.post("/withdraw", protect, withdrawFunds);

export default router;
