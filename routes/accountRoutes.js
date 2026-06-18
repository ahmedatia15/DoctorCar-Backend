// PATH: backend/routes/accountRoutes.js
// Account subsystem: notifications, push tokens, sessions/devices, login
// history, change password, biometric flag, and 2FA. All routes are protected.
import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import User from "../models/userModel.js";

import {
  getNotifications,
  markNotificationRead,
  markAllRead,
  getNotificationPrefs,
  setNotificationPrefs,
  registerPushToken,
  removePushToken,
} from "../controllers/notificationController.js";

import {
  getSessions,
  getLoginHistory,
  revokeSession,
  revokeAllSessions,
} from "../controllers/sessionController.js";

import {
  getSecurityStatus,
  changePassword,
  setBiometric,
  twoFactorStatus,
  twoFactorSetup,
  twoFactorEnable,
  twoFactorDisable,
} from "../controllers/securityController.js";

const router = express.Router();

router.use(protect);

// ---- Notifications ----
router.get("/notifications", getNotifications);
router.post("/notifications/read-all", markAllRead);
router.patch("/notifications/:id/read", markNotificationRead);
router.get("/notifications/prefs", getNotificationPrefs);
router.put("/notifications/prefs", setNotificationPrefs);

// ---- Push tokens (FCM) ----
router.post("/push-token", registerPushToken);
router.delete("/push-token", removePushToken);

// ---- Sessions / Connected Devices / Login History ----
router.get("/sessions", getSessions);
router.post("/sessions/revoke-all", revokeAllSessions);
router.delete("/sessions/:id", revokeSession);
router.get("/login-history", getLoginHistory);

// ---- Security ----
router.get("/security-status", getSecurityStatus);
router.put("/change-password", changePassword);
router.put("/biometric", setBiometric);

// ---- Two-Factor (TOTP) ----
router.get("/2fa/status", twoFactorStatus);
router.post("/2fa/setup", twoFactorSetup);
router.post("/2fa/enable", twoFactorEnable);
router.post("/2fa/disable", twoFactorDisable);

// ---- Profile (name) ----
// Minimal endpoint: lets the customer rename themselves from the profile
// screen. Stricter password / email change goes through other routes.
router.put("/profile", async (req, res) => {
  try {
    const raw = (req.body?.name ?? "").toString().trim();
    if (raw.length < 2 || raw.length > 60) {
      return res
        .status(400)
        .json({ success: false, message: "الاسم يجب أن يكون بين 2 و 60 حرفًا" });
    }
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: { name: raw } },
      { new: true }
    );
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "المستخدم غير موجود" });
    }
    return res.json({ success: true, name: user.name });
  } catch (err) {
    console.error("❌ PUT /account/profile:", err?.message || err);
    return res
      .status(500)
      .json({ success: false, message: err?.message || "Server error" });
  }
});

export default router;
