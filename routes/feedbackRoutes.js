import express from "express";
import mongoose from "mongoose";
import Feedback from "../models/feedbackModel.js";
import { protect, authorize } from "../middleware/authMiddleware.js";

const router = express.Router();

// 🟢 إنشاء تقييم جديد — المستخدم الحالي فقط
router.post("/", protect, async (req, res) => {
  try {
    const { orderId, rating, comment } = req.body;

    if (!orderId || !mongoose.Types.ObjectId.isValid(String(orderId))) {
      return res.status(400).json({
        success: false,
        message: "⚠️ orderId غير صحيح.",
      });
    }

    const numericRating = Number(rating);
    if (!Number.isFinite(numericRating) || numericRating < 1 || numericRating > 5) {
      return res.status(400).json({
        success: false,
        message: "⚠️ التقييم يجب أن يكون بين 1 و 5.",
      });
    }

    // ✅ المستخدم من التوكن — لا نثق بأي userId يأتي من العميل.
    const feedback = await Feedback.create({
      orderId,
      userId: req.user._id,
      rating: numericRating,
      comment: typeof comment === "string" ? comment.slice(0, 300) : "",
    });

    res.status(201).json({
      success: true,
      message: "✅ تم إرسال التقييم بنجاح",
      feedback,
    });
  } catch (error) {
    console.error("❌ خطأ أثناء حفظ التقييم:", error);
    res.status(500).json({
      success: false,
      message: "حدث خطأ أثناء إرسال التقييم",
      error: error.message,
    });
  }
});

// 🟡 جلب كل التقييمات — للأدمن فقط
router.get("/", protect, authorize("admin"), async (req, res) => {
  try {
    const feedbacks = await Feedback.find().populate("userId", "name email");
    res.json({ success: true, feedbacks });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "حدث خطأ أثناء جلب التقييمات",
      error: error.message,
    });
  }
});

export default router;
