import express from "express";
import Maintenance from "../models/maintenanceModel.js";
import Vehicle from "../models/vehicleModel.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();


// 🟢 1) إضافة عملية صيانة
router.post("/:vehicleId", protect, async (req, res) => {
  try {
    const { type, km, cost, notes, date } = req.body;

    const vehicle = await Vehicle.findById(req.params.vehicleId);
    if (!vehicle) return res.status(404).json({ message: "🚗 السيارة غير موجودة" });

    const m = await Maintenance.create({
      vehicle: vehicle._id,
      type,
      km,
      cost,
      notes,
      date
    });

    res.json({ message: "تم إضافة الصيانة", maintenance: m });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// 🟣 2) جلب سجل الصيانة للسيارة
router.get("/:vehicleId", protect, async (req, res) => {
  try {
    const history = await Maintenance.find({
      vehicle: req.params.vehicleId,
    }).sort({ date: -1 });

    res.json(history);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// 🔵 3) جلب آخر عملية صيانة فقط
router.get("/:vehicleId/last", protect, async (req, res) => {
  try {
    const last = await Maintenance.findOne({
      vehicle: req.params.vehicleId,
    }).sort({ date: -1 });

    res.json(last || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// 🟡 4) حذف عملية صيانة
router.delete("/:id", protect, async (req, res) => {
  try {
    const m = await Maintenance.findById(req.params.id);

    if (!m) return res.status(404).json({ message: "❌ العملية غير موجودة" });

    await m.deleteOne();

    res.json({ message: "🗑️ تم حذف عملية الصيانة" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// 🟠 5) تعديل عملية صيانة
router.put("/:id", protect, async (req, res) => {
  try {
    let m = await Maintenance.findById(req.params.id);

    if (!m) return res.status(404).json({ message: "❌ العملية غير موجودة" });

    Object.assign(m, req.body);
    await m.save();

    res.json({ message: "تم تعديل العملية", maintenance: m });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


export default router;
