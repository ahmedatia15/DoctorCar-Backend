// PATH: backend/controllers/securityController.js
import User from "../models/userModel.js";
import { generateSecret, verifyToken, otpauthURL } from "../utils/totp.js";
import { createNotification } from "../utils/notify.js";

// GET /api/account/security-status
export const getSecurityStatus = async (req, res) => {
  const u = req.user;
  return res.json({
    success: true,
    twoFactorEnabled: !!(u.twoFactor && u.twoFactor.enabled),
    biometricEnabled: !!u.biometricEnabled,
    notificationsEnabled: u.notificationsEnabled !== false,
  });
};

// PUT /api/account/change-password  { currentPassword, newPassword }
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "كلمة المرور الحالية والجديدة مطلوبة",
      });
    }
    if (String(newPassword).length < 6) {
      return res.status(400).json({
        success: false,
        message: "كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل",
      });
    }

    // Need the hash, which is select:false on the model.
    const user = await User.findById(req.user._id).select("+password");
    if (!user) {
      return res.status(404).json({ success: false, message: "المستخدم غير موجود" });
    }

    if (user.authProvider && user.authProvider !== "local") {
      return res.status(400).json({
        success: false,
        message: "هذا الحساب مسجَّل عبر مزود خارجي ولا يملك كلمة مرور",
      });
    }

    const ok = await user.matchPassword(currentPassword);
    if (!ok) {
      return res.status(401).json({
        success: false,
        message: "كلمة المرور الحالية غير صحيحة",
      });
    }

    user.password = newPassword; // hashed by the pre-save hook
    await user.save();

    await createNotification(user._id, {
      type: "security",
      title: "تم تغيير كلمة المرور",
      body: "تم تحديث كلمة مرور حسابك بنجاح.",
    });

    return res.json({ success: true, message: "تم تحديث كلمة المرور بنجاح" });
  } catch (err) {
    console.error("❌ changePassword:", err);
    return res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
};

// PUT /api/account/biometric  { enabled }  -> persist app-lock preference
export const setBiometric = async (req, res) => {
  try {
    const enabled = req.body.enabled === true || req.body.enabled === "true";
    await User.updateOne({ _id: req.user._id }, { biometricEnabled: enabled });
    return res.json({ success: true, enabled });
  } catch (err) {
    console.error("❌ setBiometric:", err);
    return res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
};

// ============================================================
// 🔐 Two-Factor (TOTP)
// ============================================================

// GET /api/account/2fa/status
export const twoFactorStatus = async (req, res) => {
  const u = req.user;
  return res.json({
    success: true,
    enabled: !!(u.twoFactor && u.twoFactor.enabled),
  });
};

// POST /api/account/2fa/setup -> generate a pending secret + otpauth URL
export const twoFactorSetup = async (req, res) => {
  try {
    const secret = generateSecret();
    await User.updateOne(
      { _id: req.user._id },
      { "twoFactor.pendingSecret": secret }
    );

    const label = req.user.email || req.user.phone || "DoctorCar";
    return res.json({
      success: true,
      secret,
      otpauthUrl: otpauthURL({ secret, label }),
    });
  } catch (err) {
    console.error("❌ twoFactorSetup:", err);
    return res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
};

// POST /api/account/2fa/enable  { token } -> verify pending secret then enable
export const twoFactorEnable = async (req, res) => {
  try {
    const token = String(req.body.token || "").trim();
    const user = await User.findById(req.user._id).select(
      "+twoFactor.pendingSecret +twoFactor.secret"
    );

    const pending = user?.twoFactor?.pendingSecret;
    if (!pending) {
      return res.status(400).json({
        success: false,
        message: "ابدأ إعداد التحقق بخطوتين أولًا",
      });
    }

    if (!verifyToken(pending, token)) {
      return res.status(400).json({ success: false, message: "الرمز غير صحيح" });
    }

    user.twoFactor.enabled = true;
    user.twoFactor.secret = pending;
    user.twoFactor.pendingSecret = "";
    await user.save();

    await createNotification(user._id, {
      type: "security",
      title: "تم تفعيل التحقق بخطوتين",
      body: "أصبح حسابك محميًا بخطوة تحقق إضافية.",
    });

    return res.json({ success: true, enabled: true });
  } catch (err) {
    console.error("❌ twoFactorEnable:", err);
    return res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
};

// POST /api/account/2fa/disable  { password }
export const twoFactorDisable = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select(
      "+password +twoFactor.secret +twoFactor.pendingSecret"
    );

    // Re-authenticate with password before disabling (local accounts).
    if (user.authProvider === "local") {
      const ok = await user.matchPassword(req.body.password || "");
      if (!ok) {
        return res.status(401).json({
          success: false,
          message: "كلمة المرور غير صحيحة",
        });
      }
    }

    user.twoFactor.enabled = false;
    user.twoFactor.secret = "";
    user.twoFactor.pendingSecret = "";
    await user.save();

    await createNotification(user._id, {
      type: "security",
      title: "تم إيقاف التحقق بخطوتين",
      body: "تم تعطيل خطوة التحقق الإضافية على حسابك.",
    });

    return res.json({ success: true, enabled: false });
  } catch (err) {
    console.error("❌ twoFactorDisable:", err);
    return res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
};
