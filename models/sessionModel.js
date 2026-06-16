// PATH: backend/models/sessionModel.js
// Records every login attempt. Successful logins create an active session
// (used for "Connected Devices"); all rows together form the login history.
import mongoose from "mongoose";

const sessionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // JWT id — lets us revoke a specific session/token server-side.
    jti: {
      type: String,
      default: "",
      index: true,
    },

    // Human-friendly device label sent by the client (e.g. "Android • Chrome").
    device: { type: String, default: "Unknown device", trim: true },
    platform: { type: String, default: "", trim: true },

    ip: { type: String, default: "", trim: true },
    userAgent: { type: String, default: "", trim: true },
    location: { type: String, default: "", trim: true },

    // false => this row is a failed login attempt (history only, never active).
    success: { type: Boolean, default: true },

    // "active" | "revoked" | "expired"
    status: {
      type: String,
      enum: ["active", "revoked", "expired"],
      default: "active",
    },

    lastActiveAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

sessionSchema.index({ user: 1, createdAt: -1 });

const Session =
  mongoose.models.Session || mongoose.model("Session", sessionSchema);

export default Session;
