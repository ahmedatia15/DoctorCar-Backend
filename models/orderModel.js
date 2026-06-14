import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
    // =========================
    // User
    // =========================
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // =========================
    // Service
    // =========================
    serviceName: {
      type: String,
      required: true,
      trim: true,
    },

    serviceType: {
      type: String,
      required: true,
      trim: true,
    },

    selectedServices: {
      type: [String],
      default: [],
    },

    services: {
      type: [String],
      default: [],
    },

    // =========================
    // Vehicle
    // =========================
    vehicle: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vehicle",
      default: null,
    },

    vehicleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vehicle",
      default: null,
    },

    // =========================
    // Location
    // =========================
    location: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
      address: { type: String, default: "" },
    },

    customerLocation: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
      address: { type: String, default: "" },
    },

    pickupLocation: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
      address: { type: String, default: "" },
    },

    address: {
      type: String,
      default: "",
    },

    notes: {
      type: String,
      default: "",
    },

    // =========================
    // Center
    // =========================
    center: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Center",
      default: null,
    },

    // =========================
    // Technician snapshot
    // =========================
    technician: {
      techId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Technician",
        default: null,
      },
      techName: { type: String, default: null },
      phone: { type: String, default: null },
      location: {
        lat: { type: Number, default: null },
        lng: { type: Number, default: null },
      },
    },

    // =========================
    // Tracking
    // =========================
    tracking: {
      lastTechnicianLocation: {
        lat: { type: Number, default: null },
        lng: { type: Number, default: null },
        heading: { type: Number, default: null },
        speed: { type: Number, default: null },
        updatedAt: { type: Date, default: null },
      },
    },

    // =========================
    // Chat
    // =========================
    chatId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SupportChat",
      default: null,
    },

    // =========================
    // Price
    // =========================
    price: {
      type: Number,
      default: 0,
    },

    // =========================
    // Status
    // =========================
    status: {
      type: String,
      enum: [
        "pending",
        "accepted",
        "on_the_way",
        "arrived",
        "working",
        "completed",
        "searching",
        "contacting",
        "assigned",
        "in_progress",
        "timeout",
        "canceled",
        "cancelled",
        "failed",
      ],
      default: "pending",
    },

    acceptedAt: {
      type: Date,
      default: null,
    },

    // =========================
    // Payment
    // =========================
    payment: {
      method: { type: String, default: "cash" },
      isPaid: { type: Boolean, default: false },
      transactionId: { type: String, default: null },
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("Order", orderSchema);