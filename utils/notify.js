// PATH: backend/utils/notify.js
// Small helper to persist a per-user notification. Never throws into the
// caller's flow — notification failures must not break the main request.
import Notification from "../models/notificationModel.js";

export const createNotification = async (
  userId,
  { title, body = "", type = "system", data = {} } = {}
) => {
  try {
    if (!userId || !title) return null;
    return await Notification.create({
      user: userId,
      title,
      body,
      type,
      data,
    });
  } catch (err) {
    console.error("⚠️ createNotification failed:", err?.message || err);
    return null;
  }
};
