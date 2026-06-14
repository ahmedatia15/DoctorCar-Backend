import mongoose from "mongoose";

const accidentSchema = new mongoose.Schema(
  {
    // =========================
    // BASIC INFO
    // =========================
    type: {
      type: String,
      enum: ["normal", "emergency"],
      default: "emergency",
    },

    status: {
      type: String,
      enum: ["pending", "assigned", "on_the_way", "completed", "cancelled"],
      default: "pending",
    },

    priority: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "high",
    },

    // =========================
    // LOCATION
    // =========================
    lat: {
      type: Number,
      required: true,
    },

    lng: {
      type: Number,
      required: true,
    },

    address: {
      type: String,
    },

    // =========================
    // USER DATA
    // =========================
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    vehicleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vehicle",
    },

    // =========================
    // DESCRIPTION
    // =========================
    notes: {
      type: String,
    },

    serviceType: {
      type: String,
      default: "accident",
    },

    // =========================
    // MEDIA
    // =========================
    imageUrls: [
      {
        type: String,
      },
    ],

    audioUrl: {
      type: String,
    },

    videoPath: {
      type: String,
    },

    // =========================
    // EMERGENCY CONTACT
    // =========================
    emergencyContactName: {
      type: String,
    },

    emergencyContactPhone: {
      type: String,
    },

    // =========================
    // CENTER ASSIGNMENT
    // =========================
    assignedCenter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Center",
    },

    assignedTechnician: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Technician",
    },

    // =========================
    // TIMELINE
    // =========================
    assignedAt: Date,
    startedAt: Date,
    completedAt: Date,

    // =========================
    // LEGACY (عشان متكسرش القديم)
    // =========================
    date: {
      type: String,
    },

    force: {
      type: Number,
    },
  },
  { timestamps: true }
);

const Accident = mongoose.model("Accident", accidentSchema);
export default Accident;