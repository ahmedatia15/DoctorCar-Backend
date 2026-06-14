import express from "express";
import Technician from "../models/technicianModel.js";
import { protect } from "../utils/authMiddleware.js";
import {
  getNearbyRequests,
  acceptRequest,
  completeRequest,
} from "../controllers/technicianController.js";

const router = express.Router();

// ===================================================================
// 👷‍♂️ القسم الأول: الفنيين (Technicians)
// ===================================================================

// ✅ 1. جلب جميع الفنيين أو حسب نوع الخدمة (لـ Flutter)
router.get("/", async (req, res) => {
  try {
    const service = req.query.service;
    const query = service ? { serviceType: service, isAvailable: true } : {};
    const technicians = await Technician.find(query);

    if (!technicians || technicians.length === 0) {
      return res.status(200).json([]); // لا يوجد فنيين متاحين
    }

    res.status(200).json(technicians);
  } catch (error) {
    console.error("❌ Error fetching technicians:", error);
    res
      .status(500)
      .json({ message: "Server error while fetching technicians" });
  }
});

// ✅ 2. إضافة فني جديد (اختياري للاختبار أو لوحة التحكم)
router.post("/", async (req, res) => {
  try {
    const { name, serviceType, phone, lat, lng, rating, isAvailable } =
      req.body;

    const newTech = new Technician({
      name,
      serviceType,
      phone,
      location: {
        type: "Point",
        coordinates: [lng, lat],
      },
      rating: rating || 4.5,
      isAvailable: isAvailable ?? true,
    });

    const savedTech = await newTech.save();
    res.status(201).json(savedTech);
  } catch (error) {
    console.error("❌ Error adding technician:", error);
    res.status(400).json({ message: "Failed to add technician" });
  }
});

// ✅ 3. تحديث حالة الفني (نشط / غير متاح)
router.put("/:id/status", async (req, res) => {
  try {
    const tech = await Technician.findById(req.params.id);
    if (!tech) {
      return res.status(404).json({ message: "Technician not found" });
    }

    tech.isAvailable = req.body.isAvailable ?? true;
    await tech.save();

    res.status(200).json({ message: "Technician status updated", tech });
  } catch (error) {
    console.error("❌ Error updating status:", error);
    res
      .status(500)
      .json({ message: "Server error while updating status" });
  }
});

// ===================================================================
// 🚗 القسم الثاني: الفنيين القريبين (Nearby Technicians)
// ===================================================================

// ✅ 4. جلب الفنيين القريبين حسب الموقع ونوع الخدمة
router.post("/nearby", async (req, res) => {
  try {
    const { services, location } = req.body;

    if (!location || !location.lat || !location.lng) {
      return res.status(400).json({
        success: false,
        message: "⚠️ موقع المستخدم غير محدد بشكل صحيح",
      });
    }

    if (!services || !Array.isArray(services) || services.length === 0) {
      return res.status(400).json({
        success: false,
        message: "⚠️ يجب تحديد نوع الخدمة المطلوبة",
      });
    }

    // 🧭 البحث عن الفنيين الذين يقدمون نفس الخدمات
    const technicians = await Technician.find({
      serviceType: { $in: services },
      isAvailable: true,
    });

    if (!technicians || technicians.length === 0) {
      return res.status(200).json({
        success: true,
        message: "لا يوجد فنيين قريبين حالياً",
        technicians: [],
      });
    }

    // 🔢 حساب المسافة (تقريبية)
    const withDistance = technicians.map((tech) => {
      const [lng, lat] = tech.location?.coordinates || [0, 0];
      const distance = Math.sqrt(
        Math.pow(lat - location.lat, 2) + Math.pow(lng - location.lng, 2)
      );
      return { ...tech.toObject(), distance };
    });

    // 🔽 ترتيب الفنيين حسب القرب
    withDistance.sort((a, b) => a.distance - b.distance);

    res.status(200).json({
      success: true,
      message: "تم جلب الفنيين القريبين بنجاح ✅",
      technicians: withDistance.slice(0, 10), // نرجّع فقط أقرب 10
    });
  } catch (error) {
    console.error("❌ خطأ أثناء جلب الفنيين القريبين:", error);
    res.status(500).json({
      success: false,
      message: "حدث خطأ أثناء جلب الفنيين القريبين",
      error: error.message,
    });
  }
});

// ===================================================================
// 🧰 القسم الثالث: الطلبات الخاصة بالفنيين
// ===================================================================

// ✅ عرض الطلبات القريبة من الفني
router.get("/requests", protect, getNearbyRequests);

// ✅ قبول طلب معين
router.put("/requests/:id/accept", protect, acceptRequest);

// ✅ إنهاء الطلب
router.put("/requests/:id/complete", protect, completeRequest);

// ===================================================================
// ✅ التصدير
// ===================================================================
export default router;
