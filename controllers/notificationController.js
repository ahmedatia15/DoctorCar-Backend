// PATH: backend/controllers/notificationController.js
import Notification from "../models/notificationModel.js";
import User from "../models/userModel.js";

// GET /api/account/notifications  -> user's notifications + unread count
export const getNotifications = async (req, res) => {
  try {
    const userId = req.user._id;

    const [items, unread] = await Promise.all([
      Notification.find({ user: userId }).sort({ createdAt: -1 }).limit(100).lean(),
      Notification.countDocuments({ user: userId, read: false }),
    ]);

    return res.json({ success: true, unread, notifications: items });
  } catch (err) {
    console.error("❌ getNotifications:", err);
    return res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
};

// PATCH /api/account/notifications/:id/read
export const markNotificationRead = async (req, res) => {
  try {
    const updated = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { read: true },
      { new: true }
    );
    if (!updated) {
      return res.status(404).json({ success: false, message: "غير موجود" });
    }
    return res.json({ success: true, notification: updated });
  } catch (err) {
    console.error("❌ markNotificationRead:", err);
    return res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
};

// POST /api/account/notifications/read-all
export const markAllRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { user: req.user._id, read: false },
      { read: true }
    );
    return res.json({ success: true });
  } catch (err) {
    console.error("❌ markAllRead:", err);
    return res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
};

// GET /api/account/notifications/prefs
export const getNotificationPrefs = async (req, res) => {
  return res.json({
    success: true,
    enabled: req.user.notificationsEnabled !== false,
  });
};

// PUT /api/account/notifications/prefs  { enabled: bool }
export const setNotificationPrefs = async (req, res) => {
  try {
    const enabled = req.body.enabled === true || req.body.enabled === "true";
    await User.updateOne(
      { _id: req.user._id },
      { notificationsEnabled: enabled }
    );
    return res.json({ success: true, enabled });
  } catch (err) {
    console.error("❌ setNotificationPrefs:", err);
    return res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
};

// POST /api/account/push-token  { token }  -> register FCM token for this user
export const registerPushToken = async (req, res) => {
  try {
    const token = String(req.body.token || "").trim();
    if (!token) {
      return res.status(400).json({ success: false, message: "token مطلوب" });
    }
    // addToSet avoids duplicate tokens for the same user.
    await User.updateOne(
      { _id: req.user._id },
      { $addToSet: { pushTokens: token } }
    );
    return res.json({ success: true });
  } catch (err) {
    console.error("❌ registerPushToken:", err);
    return res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
};

// DELETE /api/account/push-token  { token }  -> unregister on logout
export const removePushToken = async (req, res) => {
  try {
    const token = String(req.body.token || "").trim();
    if (token) {
      await User.updateOne(
        { _id: req.user._id },
        { $pull: { pushTokens: token } }
      );
    }
    return res.json({ success: true });
  } catch (err) {
    console.error("❌ removePushToken:", err);
    return res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
};
