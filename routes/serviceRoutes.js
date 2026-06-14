import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import ServiceRequest from "../models/ServiceRequest.js";

const router = express.Router();


// 🟢 1. إنشاء طلب خدمة جديد
router.post("/", protect, async (req, res) => {
  try {
    const { type, vehicle, location, notes } = req.body;

    if (!type || !location) {
      return res.status(400).json({ message: "❌ يرجى إدخال نوع الخدمة والموقع" });
    }

    const service = new ServiceRequest({
      user: req.user._id, // المستخدم الحالي من التوكن
      type,
      vehicle,
      location,
      notes,
      status: "pending",
    });

    const saved = await service.save();
    res.status(201).json({
      message: "✅ تم إنشاء الطلب بنجاح",
      service: saved,
    });

  } catch (error) {
    console.error("❌ خطأ أثناء إنشاء الطلب:", error.message);
    res.status(500).json({ message: "⚠️ فشل في إنشاء الطلب" });
  }
});


// 🟣 2. جلب جميع الطلبات الخاصة بالمستخدم
router.get("/my-services", protect, async (req, res) => {
  try {
    const services = await ServiceRequest.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.json(services);
  } catch (error) {
    console.error("❌ خطأ أثناء جلب الطلبات:", error.message);
    res.status(500).json({ message: "⚠️ حدث خطأ أثناء تحميل البيانات" });
  }
});


// 🟡 3. تحديث حالة الطلب (يستخدمها الفني أو المشرف)
router.put("/:id/status", protect, async (req, res) => {
  try {
    const { status } = req.body;
    const service = await ServiceRequest.findById(req.params.id);

    if (!service) return res.status(404).json({ message: "❌ الطلب غير موجود" });

    service.status = status || service.status;
    const updated = await service.save();

    res.json({
      message: `✅ تم تحديث الحالة إلى: ${updated.status}`,
      service: updated,
    });

  } catch (error) {
    console.error("❌ خطأ أثناء تحديث الطلب:", error.message);
    res.status(500).json({ message: "⚠️ فشل في تحديث الحالة" });
  }
});


export default router;
