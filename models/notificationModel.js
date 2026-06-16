// PATH: backend/models/notificationModel.js
// Per-user notification records. Every notification is genuine and specific
// to one account — there is no shared/hardcoded notification data.
import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // High-level category used by the app to filter/iconize.
    // e.g. "order" | "wallet" | "security" | "offer" | "system"
    type: {
      type: String,
      default: "system",
      trim: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    body: {
      type: String,
      default: "",
      trim: true,
    },

    read: {
      type: Boolean,
      default: false,
    },

    // Optional structured payload (orderId, amount, etc.)
    data: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

notificationSchema.index({ user: 1, createdAt: -1 });

const Notification =
  mongoose.models.Notification ||
  mongoose.model("Notification", notificationSchema);

export default Notification;
