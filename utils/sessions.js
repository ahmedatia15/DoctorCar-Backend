// PATH: backend/utils/sessions.js
// Helpers to record login sessions (Connected Devices + Login History) and to
// derive request metadata (IP / user-agent / device label).
import crypto from "crypto";
import Session from "../models/sessionModel.js";

export const newJti = () => crypto.randomBytes(16).toString("hex");

export const getClientIp = (req) => {
  const fwd = req.headers["x-forwarded-for"];
  if (fwd) return String(fwd).split(",")[0].trim();
  return req.ip || req.connection?.remoteAddress || "";
};

// Build a friendly device label, preferring what the client sent.
export const getDeviceLabel = (req) => {
  const fromBody = (req.body?.deviceName || req.body?.device || "").trim();
  if (fromBody) return fromBody;
  const ua = req.headers["user-agent"] || "";
  if (/android/i.test(ua)) return "Android device";
  if (/iphone|ipad|ios/i.test(ua)) return "iOS device";
  if (/windows/i.test(ua)) return "Windows device";
  if (/mac/i.test(ua)) return "Mac device";
  return "Unknown device";
};

// Record a successful login as an active session. Returns the jti to embed
// in the JWT so the session can be revoked later.
export const recordLoginSession = async (req, userId) => {
  const jti = newJti();
  try {
    await Session.create({
      user: userId,
      jti,
      device: getDeviceLabel(req),
      platform: (req.body?.platform || "").trim(),
      ip: getClientIp(req),
      userAgent: req.headers["user-agent"] || "",
      success: true,
      status: "active",
      lastActiveAt: new Date(),
    });
  } catch (err) {
    console.error("⚠️ recordLoginSession failed:", err?.message || err);
  }
  return jti;
};

// Record a failed login attempt (history only, never an active session).
export const recordFailedLogin = async (req, userId) => {
  try {
    if (!userId) return;
    await Session.create({
      user: userId,
      jti: "",
      device: getDeviceLabel(req),
      platform: (req.body?.platform || "").trim(),
      ip: getClientIp(req),
      userAgent: req.headers["user-agent"] || "",
      success: false,
      status: "expired",
    });
  } catch (err) {
    console.error("⚠️ recordFailedLogin failed:", err?.message || err);
  }
};
