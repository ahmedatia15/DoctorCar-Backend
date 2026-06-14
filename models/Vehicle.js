// 📁 backend/models/Vehicle.js

import mongoose from "mongoose";

const vehicleSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    brand: { type: String, required: true },
    model: { type: String, required: true },
    year: { type: String, required: true },
    fuel: { type: String, required: true },
    color: { type: String, required: true },
    plateNumber: { type: String, required: true },
    chassisNumber: { type: String, required: true },

    // 🔥 البيانات الجديدة
    odometer: { type: Number, default: 0 },               // عدد الكيلومترات
    nextServiceKm: { type: Number, default: 5000 },        // أقرب موعد صيانة
    oilChangeDate: { type: Date },                         // تغيير الزيت
    batteryChangeDate: { type: Date },                     // تغيير البطارية
    tireChangeDate: { type: Date },                        // تغيير الكاوتش
    repairsHistory: { type: [String], default: [] },       // سجل الإصلاحات
    carStatus: { type: String, default: "جيدة" },          // الحالة العامة
  },

  { timestamps: true }
);

export default mongoose.model("Vehicle", vehicleSchema);
