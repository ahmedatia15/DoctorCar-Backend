import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import Vehicle from "../models/vehicleModel.js";

const router = express.Router();

/* ============================================================
    🟢 1) إضافة سيارة جديدة
============================================================ */
router.post("/", protect, async (req, res) => {
  try {
    const {
      brand,
      model,
      fuel,
      condition,
      plateNumber,
      chassisNumber,
      color,
      year,
    } = req.body;

    if (!brand || !model || !fuel || !condition || !plateNumber) {
      return res.status(400).json({
        message: "❌ الرجاء إدخال جميع البيانات المطلوبة",
      });
    }

    // التأكد من أن اللوحة غير مكررة
    const existing = await Vehicle.findOne({ plateNumber });
    if (existing) {
      return res.status(400).json({ message: "🚫 هذه السيارة مسجلة مسبقًا" });
    }

    const vehicle = new Vehicle({
      user: req.user._id,
      brand,
      model,
      fuel,
      condition,
      plateNumber,
      chassisNumber,
      color,
      year,
    });

    const saved = await vehicle.save();

    res.status(201).json({
      message: "✅ تم إضافة السيارة بنجاح",
      vehicle: saved,
    });
  } catch (err) {
    console.error("❌ خطأ أثناء إضافة السيارة:", err);
    res.status(500).json({ message: "⚠️ خطأ أثناء حفظ السيارة" });
  }
});

/* ============================================================
    🟣 2) عرض جميع سيارات المستخدم
============================================================ */
router.get("/my-vehicles", protect, async (req, res) => {
  try {
    const vehicles = await Vehicle.find({ user: req.user._id }).sort({
      createdAt: -1,
    });
    res.json(vehicles);
  } catch (err) {
    console.error("❌ خطأ أثناء جلب السيارات:", err);
    res
      .status(500)
      .json({ message: "⚠️ حدث خطأ أثناء تحميل السيارات من السيرفر" });
  }
});

/* ============================================================
    🟡 3) تعديل سيارة
============================================================ */
router.put("/:id", protect, async (req, res) => {
  try {
    const vehicle = await Vehicle.findById(req.params.id);

    if (!vehicle) {
      return res.status(404).json({ message: "🚘 السيارة غير موجودة" });
    }

    if (vehicle.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        message: "⛔ ليس لديك صلاحية تعديل هذه السيارة",
      });
    }

    Object.assign(vehicle, req.body);
    const updated = await vehicle.save();

    res.json({
      message: "✅ تم تعديل بيانات السيارة",
      vehicle: updated,
    });
  } catch (err) {
    console.error("❌ خطأ أثناء تعديل السيارة:", err);
    res.status(500).json({ message: "⚠️ فشل تعديل السيارة" });
  }
});

/* ============================================================
    🔴 4) حذف سيارة
============================================================ */
router.delete("/:id", protect, async (req, res) => {
  try {
    const vehicle = await Vehicle.findById(req.params.id);

    if (!vehicle) {
      return res.status(404).json({ message: "🚘 السيارة غير موجودة" });
    }

    if (vehicle.user.toString() !== req.user._id.toString()) {
      return res
        .status(403)
        .json({ message: "⛔ ليس لديك صلاحية لحذف هذه السيارة" });
    }

    await vehicle.deleteOne();
    res.json({ message: "🗑️ تم حذف السيارة" });
  } catch (err) {
    console.error("❌ خطأ أثناء الحذف:", err);
    res.status(500).json({ message: "⚠️ فشل حذف السيارة" });
  }
});

/* ============================================================
    🔧 5) إضافة عملية صيانة لسيارة
============================================================ */
router.post("/:id/maintenance", protect, async (req, res) => {
  try {
    const { type, km, cost, notes, date } = req.body;

    const vehicle = await Vehicle.findById(req.params.id);

    if (!vehicle) {
      return res.status(404).json({ message: "🚘 السيارة غير موجودة" });
    }

    if (vehicle.user.toString() !== req.user._id.toString()) {
      return res
        .status(403)
        .json({ message: "⛔ لا يمكنك إضافة صيانة لهذه السيارة" });
    }

    const maintenanceRecord = {
      type,
      km,
      cost,
      notes,
      date: date ? new Date(date) : new Date(),
    };

    vehicle.maintenanceHistory.push(maintenanceRecord);

    await vehicle.save();

    res.json({
      message: "🔧 تمت إضافة عملية الصيانة",
      maintenance: maintenanceRecord,
    });
  } catch (err) {
    console.error("❌ خطأ أثناء إضافة الصيانة:", err);
    res.status(500).json({ message: "⚠️ فشل إضافة الصيانة" });
  }
});

/* ============================================================
    📜 6) جلب سجل الصيانة لسيارة معينة
============================================================ */
router.get("/:id/maintenance", protect, async (req, res) => {
  try {
    const vehicle = await Vehicle.findById(req.params.id);

    if (!vehicle) {
      return res.status(404).json({ message: "🚘 السيارة غير موجودة" });
    }

    res.json(vehicle.maintenanceHistory);
  } catch (err) {
    console.error("❌ خطأ أثناء جلب الصيانة:", err);
    res.status(500).json({ message: "⚠️ حدث خطأ أثناء تحميل سجل الصيانة" });
  }
});

export default router;
