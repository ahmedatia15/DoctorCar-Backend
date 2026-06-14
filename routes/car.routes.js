// 📁 backend/routes/car.routes.js

const express = require("express");
const router = express.Router();
const Car = require("../models/car.model");

// ➕ إضافة سيارة
router.post("/", async (req, res) => {
  try {
    const car = new Car({ ...req.body });
    await car.save();
    res.json(car);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 📥 الحصول على سيارات مستخدم معين
router.get("/:userId", async (req, res) => {
  const cars = await Car.find({ userId: req.params.userId });
  res.json(cars);
});

// ✏️ تعديل سيارة
router.put("/:id", async (req, res) => {
  const car = await Car.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true }
  );
  res.json(car);
});

// ❌ حذف سيارة
router.delete("/:id", async (req, res) => {
  await Car.findByIdAndDelete(req.params.id);
  res.json({ message: "Deleted successfully" });
});

module.exports = router;
