// 📁 backend/models/car.model.js

const mongoose = require("mongoose");

const carSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: "User"
  },
  brand: { type: String, required: true },
  model: { type: String, required: true },
  year: { type: Number, required: true },
  plateNumber: { type: String },
  vin: { type: String },
  mileage: { type: Number, default: 0 },
  lastOilChange: { type: Date },
  nextOilChange: { type: Date },
  lastService: { type: Date },
  nextService: { type: Date },
  imageUrl: { type: String },
}, { timestamps: true });

module.exports = mongoose.model("Car", carSchema);
