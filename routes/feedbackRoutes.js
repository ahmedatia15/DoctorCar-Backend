import express from "express";
import Feedback from "../models/feedbackModel.js";

const router = express.Router();

// 🟢 إنشاء تقييم جديد
router.post("/", async (req, res) => {
  try {
    const { orderId, userId, rating, comment } = req.body;

    if (!orderId || !userId || !rating) {
      return res.status(400).json({
        success: false,
        message: "⚠️ يجب إدخال orderId و userId و rating.",
      });
    }

    const feedback = await Feedback.create({
      orderId,
      userId,
      rating,
      comment,
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

// 🟡 جلب كل التقييمات (اختياري)
router.get("/", async (req, res) => {
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
