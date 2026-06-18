import mongoose from "mongoose";

const technicianSchema = new mongoose.Schema(
  {
    // =========================
    // 🔗 Auth (Optional but recommended)
    // =========================
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    // =========================
    // 🧍‍♂️ Basic Info
    // =========================
    name: {
      type: String,
      required: [true, "يجب إدخال اسم الفني"],
      trim: true,
    },

    phone: {
      type: String,
      required: [true, "يجب إدخال رقم الهاتف"],
      // sparse + unique so phone-less imports and user-linked rows whose phone
      // matches the parent User do not collide.
      unique: true,
      sparse: true,
      trim: true,
    },

    // =========================
    // 🔧 Service
    // =========================
    serviceType: {
      type: String,
      enum: ["tow", "battery", "fuel", "tire", "ride"],
      required: [true, "يجب تحديد نوع الخدمة"],
      index: true,
    },

    specialty: {
      type: String,
      default: "",
      trim: true,
    },

    governorate: {
      type: String,
      default: "",
      trim: true,
    },

    earnings: {
      total: { type: Number, default: 0 },
      currency: { type: String, default: "EGP" },
    },

    completedJobs: {
      type: Number,
      default: 0,
    },

    // =========================
    // ⭐ Rating
    // =========================
    rating: {
      type: Number,
      min: 1,
      max: 5,
      default: 4.5,
    },

    // =========================
    // 📍 Location (GeoJSON)
    // =========================
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number], // [lng, lat]
        required: true,
      },
    },

    // =========================
    // 🟢 Availability & Status
    // =========================
    isAvailable: {
      type: Boolean,
      default: true,
      index: true,
    },

    isOnline: {
      type: Boolean,
      default: false,
      index: true,
    },

    lastActiveAt: {
      type: Date,
    },

    // =========================
    // 🚗 Current Order
    // =========================
    currentOrder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
    },

    // =========================
    // 🌍 Area
    // =========================
    city: {
      type: String,
      default: "غير محدد",
      index: true,
    },

    // =========================
    // 🔌 Socket (optional)
    // =========================
    socketId: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// ======================================================
// 🌍 Geo Index (Distance Queries)
// ======================================================
technicianSchema.index({ location: "2dsphere" });

const Technician =
  mongoose.models.Technician ||
  mongoose.model("Technician", technicianSchema);

export default Technician;
