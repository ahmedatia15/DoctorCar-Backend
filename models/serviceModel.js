// models/serviceModel.js
import mongoose from "mongoose";

const pointSchema = new mongoose.Schema({
  lat: Number,
  lng: Number,
  ts: { type: Date, default: Date.now },
});

const serviceSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    vehicle: { type: mongoose.Schema.Types.ObjectId, ref: "Vehicle", required: true },
    type: { type: String, enum: ["sos", "tow", "battery", "fuel", "tire"], required: true },
    status: {
      type: String,
      enum: ["pending", "accepted", "in_progress", "completed", "canceled"],
      default: "pending",
    },
    location: { lat: Number, lng: Number }, // موقع العميل
    technician: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    technicianLocation: { lat: Number, lng: Number }, // آخر موقع للفني
    path: [pointSchema], // مسار حركة الفني
    price: { type: Number, default: 0 },
    rating: { type: Number, min: 1, max: 5 },
    notes: String,
  },
  { timestamps: true }
);

export default mongoose.model("Service", serviceSchema);
