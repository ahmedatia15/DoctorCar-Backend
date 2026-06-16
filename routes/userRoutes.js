// PATH: backend/routes/userRoutes.js
import express from "express";
import jwt from "jsonwebtoken";
import User from "../models/userModel.js";
import Vehicle from "../models/vehicleModel.js";
import { OAuth2Client } from "google-auth-library";
import { protect } from "../middleware/authMiddleware.js";
import { registerUser } from "../controllers/userController.js";
import { rateLimit } from "../utils/rateLimit.js";
import {
  recordLoginSession,
  recordFailedLogin,
} from "../utils/sessions.js";
import { verifyToken } from "../utils/totp.js";
import { createNotification } from "../utils/notify.js";

const router = express.Router();

// Throttle registration attempts (backward-compatible endpoint).
const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Too many registration attempts. Please try again later.",
});

/* ======================================================
   🔧 Helpers
====================================================== */
const normalizeEmail = (email) => String(email || "").trim().toLowerCase();

const normalizePhone = (phone = "") => {
  let p = String(phone || "").trim().replace(/\s+/g, "");

  if (p.startsWith("01")) p = `+2${p}`;
  if (p.startsWith("201")) p = `+${p}`;

  return p;
};

const isValidPhone = (phone) => {
  const p = normalizePhone(phone);
  return /^(\+201[0-9]{9})$/.test(p);
};

const makeOtp = () => Math.floor(100000 + Math.random() * 900000).toString();

const makePhoneEmail = (phone) => {
  const digits = String(phone || "").replace(/\D/g, "");
  return `phone_${digits}@doctorcar.local`;
};

const sanitizeUser = (userDocOrObj) => {
  if (!userDocOrObj) return userDocOrObj;

  const u =
    typeof userDocOrObj.toObject === "function"
      ? userDocOrObj.toObject()
      : { ...userDocOrObj };

  delete u.password;
  delete u.__v;
  return u;
};

const getJwtSecret = () => process.env.JWT_SECRET;

/* ======================================================
   🔐 Generate Token
====================================================== */
const generateToken = (user, jti) => {
  const secret = getJwtSecret();

  if (!secret) {
    throw new Error("JWT_SECRET غير موجود في .env");
  }

  const payload = {
    id: user._id,
    email: user.email,
    phone: user.phone,
    role: user.role,
  };
  // jti lets us tie the token to a revocable session.
  if (jti) payload.jti = jti;

  return jwt.sign(payload, secret, { expiresIn: "30d" });
};

/* ======================================================
   ✅ Google OAuth Client
====================================================== */
const googleClient = new OAuth2Client();

/* ======================================================
   ✅ Google Audiences
====================================================== */
const getGoogleAudiences = () => {
  const list = [
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_ID_WEB,
    process.env.GOOGLE_CLIENT_ID_ANDROID,
    process.env.GOOGLE_CLIENT_ID_IOS,
  ]
    .filter(Boolean)
    .map((x) => String(x).trim());

  if (list.length === 0) {
    throw new Error("لا يوجد GOOGLE_CLIENT_ID في .env");
  }

  return list;
};

/* ======================================================
   ✅ ROLE MAPPING
====================================================== */
const mapRole = (role) => {
  const r = String(role || "").trim().toLowerCase();

  if (
    r === "driver" ||
    r === "technician" ||
    r === "mechanic" ||
    r === "service_provider"
  ) {
    return "technician";
  }

  if (r === "admin") return "admin";

  return "customer";
};

/* ======================================================
   🔒 Strict role separation
   Rejects a login attempt when the account's real role
   does not match the portal the user logged in from
   (customer portal vs technician portal). Admins bypass.
====================================================== */
const roleMismatch = (actualRole, expectedRole) => {
  if (!expectedRole) return false;
  if (actualRole === "admin") return false;
  return actualRole !== expectedRole;
};

const roleMismatchMessage = (actualRole) =>
  actualRole === "technician"
    ? "🚫 هذا الحساب مسجَّل كحساب فني. الرجاء تسجيل الدخول من دخول الفنيين."
    : "🚫 هذا الحساب مسجَّل كحساب عميل. الرجاء تسجيل الدخول من دخول العملاء.";

/* ======================================================
   📱 OTP STORE - Development / Temporary
====================================================== */
const otpStore = new Map();

const saveOtp = ({ phone, otp, role }) => {
  otpStore.set(phone, {
    otp,
    role,
    attempts: 0,
    createdAt: Date.now(),
    expiresAt: Date.now() + 5 * 60 * 1000,
  });
};

const getOtp = (phone) => otpStore.get(phone);

const deleteOtp = (phone) => otpStore.delete(phone);

/* ======================================================
   📱 SEND LOGIN OTP
====================================================== */
router.post("/send-login-otp", async (req, res) => {
  try {
    const phone = normalizePhone(
      req.body.phone || req.body.mobile || req.body.phoneNumber
    );

    const role = mapRole(req.body.role);

    if (!isValidPhone(phone)) {
      return res.status(400).json({
        success: false,
        message: "رقم الموبايل غير صحيح. استخدم رقم مصري مثل 01234567890",
      });
    }

    const otp = makeOtp();

    saveOtp({ phone, otp, role });

    console.log("====================================");
    console.log("📱 Doctor Car Login OTP");
    console.log(`📞 Phone: ${phone}`);
    console.log(`🔐 Code : ${otp}`);
    console.log("====================================");

    return res.status(200).json({
      success: true,
      message: "تم إرسال كود التأكيد",
      devOtp: process.env.NODE_ENV === "production" ? undefined : otp,
    });
  } catch (err) {
    console.error("❌ SEND LOGIN OTP ERROR:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "حدث خطأ أثناء إرسال الكود",
    });
  }
});

/* ======================================================
   ✅ VERIFY LOGIN OTP
====================================================== */
router.post("/verify-login-otp", async (req, res) => {
  try {
    const phone = normalizePhone(
      req.body.phone || req.body.mobile || req.body.phoneNumber
    );

    const code = String(req.body.otp || req.body.code || "").trim();
    const requestedRole = mapRole(req.body.role);

    if (!isValidPhone(phone)) {
      return res.status(400).json({
        success: false,
        message: "رقم الموبايل غير صحيح",
      });
    }

    if (!code || code.length < 4) {
      return res.status(400).json({
        success: false,
        message: "كود التأكيد مطلوب",
      });
    }

    const saved = getOtp(phone);

    if (!saved) {
      return res.status(400).json({
        success: false,
        message: "اطلب كود جديد",
      });
    }

    if (Date.now() > saved.expiresAt) {
      deleteOtp(phone);
      return res.status(400).json({
        success: false,
        message: "انتهت صلاحية الكود",
      });
    }

    saved.attempts += 1;

    if (saved.attempts > 5) {
      deleteOtp(phone);
      return res.status(429).json({
        success: false,
        message: "محاولات كثيرة، اطلب كود جديد",
      });
    }

    if (saved.otp !== code) {
      return res.status(400).json({
        success: false,
        message: "كود التأكيد غير صحيح",
      });
    }

    let user = await User.findOne({ phone });

    if (!user) {
      const phoneEmail = makePhoneEmail(phone);

      user = await User.findOne({ email: phoneEmail });

      if (!user) {
        user = await User.create({
          name: "User",
          email: phoneEmail,
          phone,
          password: `phone_${Date.now()}_${Math.random()
            .toString(16)
            .slice(2)}`,
          role: saved.role || requestedRole,
          authProvider: "phone",
          lastLogin: new Date(),
        });
      }
    }

    user.phone = phone;
    user.role = user.role || saved.role || requestedRole;
    user.lastLogin = new Date();

    if (!user.authProvider) {
      user.authProvider = "phone";
    }

    await user.save();

    deleteOtp(phone);

    const jti = await recordLoginSession(req, user._id);
    const token = generateToken(user, jti);

    return res.status(200).json({
      success: true,
      message: "تم تسجيل الدخول بنجاح ✅",
      token,
      user: sanitizeUser(user),
      userId: user._id,
    });
  } catch (err) {
    console.error("❌ VERIFY LOGIN OTP ERROR:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "حدث خطأ أثناء تأكيد الكود",
    });
  }
});

/* ======================================================
   ✅ REGISTER (LOCAL)
   Delegates to the canonical typed-registration controller
   (customer | technician) so validation lives in one place.
   Kept here for backward compatibility with existing clients
   that call POST /api/users/register.
====================================================== */
router.post("/register", registerLimiter, registerUser);

/* ======================================================
   ✅ LOGIN (LOCAL)
====================================================== */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "يرجى إدخال البريد الإلكتروني وكلمة المرور",
      });
    }

    const safeEmail = normalizeEmail(email);

    const user = await User.findOne({ email: safeEmail }).select(
      "+password +twoFactor.secret"
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "❌ بيانات الدخول غير صحيحة",
      });
    }

    if (user.authProvider && user.authProvider !== "local") {
      return res.status(401).json({
        success: false,
        message: "❌ هذا الحساب مسجل بطريقة أخرى",
      });
    }

    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
      await recordFailedLogin(req, user._id);
      return res.status(401).json({
        success: false,
        message: "❌ بيانات الدخول غير صحيحة",
      });
    }

    // 🔒 Enforce strict role separation (customer vs technician portal)
    const expectedRole = req.body.role ? mapRole(req.body.role) : null;
    if (roleMismatch(user.role, expectedRole)) {
      return res.status(403).json({
        success: false,
        message: roleMismatchMessage(user.role),
      });
    }

    // 🔐 Two-Factor: if enabled, a valid TOTP code is required to finish login.
    if (user.twoFactor && user.twoFactor.enabled) {
      const totp = String(req.body.totp || req.body.code || "").trim();
      if (!totp) {
        return res.status(200).json({
          success: false,
          twoFactorRequired: true,
          message: "أدخل رمز التحقق بخطوتين",
        });
      }
      if (!verifyToken(user.twoFactor.secret, totp)) {
        return res.status(401).json({
          success: false,
          twoFactorRequired: true,
          message: "رمز التحقق غير صحيح",
        });
      }
    }

    user.lastLogin = new Date();
    await user.save();

    const jti = await recordLoginSession(req, user._id);
    const token = generateToken(user, jti);

    await createNotification(user._id, {
      type: "security",
      title: "تسجيل دخول جديد",
      body: "تم تسجيل الدخول إلى حسابك على جهاز.",
    });

    return res.status(200).json({
      success: true,
      message: "تم تسجيل الدخول بنجاح ✅",
      token,
      user: sanitizeUser(user),
    });
  } catch (err) {
    console.error("❌ LOGIN ERROR:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "حدث خطأ في الخادم",
    });
  }
});

/* ======================================================
   ✅ GOOGLE LOGIN
====================================================== */
router.post("/google", async (req, res) => {
  try {
    const { idToken, role } = req.body;

    if (!idToken || String(idToken).trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "idToken مطلوب",
      });
    }

    const audiences = getGoogleAudiences();

    const ticket = await googleClient.verifyIdToken({
      idToken: String(idToken),
      audience: audiences,
    });

    const payload = ticket.getPayload();

    if (!payload?.email) {
      return res.status(401).json({
        success: false,
        message: "Google Token غير صالح",
      });
    }

    if (payload.email_verified !== true) {
      return res.status(401).json({
        success: false,
        message: "البريد غير موثق من Google",
      });
    }

    const email = normalizeEmail(payload.email);
    const name = payload.name || email.split("@")[0];
    const googleId = payload.sub ? String(payload.sub) : "";

    if (!googleId) {
      return res.status(401).json({
        success: false,
        message: "Google Token غير صالح",
      });
    }

    let user = await User.findOne({ email });

    if (!user) {
      user = await User.create({
        name,
        email,
        role: mapRole(role),
        authProvider: "google",
        googleId,
        password: `google_${Date.now()}_${Math.random()
          .toString(16)
          .slice(2)}`,
      });
    } else {
      if (!user.googleId) user.googleId = googleId;
      if (!user.authProvider) user.authProvider = "local";
    }

    // 🔒 Enforce strict role separation for existing accounts logging in
    // through the wrong portal (new accounts get the requested role above).
    const expectedRole = role ? mapRole(role) : null;
    if (roleMismatch(user.role, expectedRole)) {
      return res.status(403).json({
        success: false,
        message: roleMismatchMessage(user.role),
      });
    }

    user.lastLogin = new Date();
    await user.save();

    const jti = await recordLoginSession(req, user._id);
    const token = generateToken(user, jti);

    return res.status(200).json({
      success: true,
      message: "تم تسجيل الدخول عبر Google ✅",
      token,
      user: sanitizeUser(user),
    });
  } catch (err) {
    console.error("❌ GOOGLE LOGIN ERROR:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "خطأ أثناء تسجيل الدخول بجوجل",
    });
  }
});

/* ======================================================
   👤 CURRENT USER
====================================================== */
router.get("/me", protect, (req, res) => {
  return res.json({
    success: true,
    user: sanitizeUser(req.user),
  });
});

/* ======================================================
   🏠 HOME SUMMARY
   Powers the home-screen user-info section:
   username, default vehicle (brand/model) and wallet balance.
   All values are read from (and persisted in) the database.
====================================================== */
router.get("/home-summary", protect, async (req, res) => {
  try {
    const user = req.user;

    // Default vehicle: explicit choice first, otherwise the latest one.
    let vehicle = null;
    if (user.defaultVehicle) {
      vehicle = await Vehicle.findOne({
        _id: user.defaultVehicle,
        user: user._id,
      });
    }
    if (!vehicle) {
      vehicle = await Vehicle.findOne({ user: user._id }).sort({
        createdAt: -1,
      });
    }

    // Balance is the canonical value stored on the user record.
    return res.json({
      success: true,
      name: user.name,
      email: user.email,
      balance: user.balance || 0,
      defaultVehicle: vehicle
        ? {
            id: vehicle._id,
            brand: vehicle.brand,
            model: vehicle.model,
            plateNumber: vehicle.plateNumber,
          }
        : null,
    });
  } catch (err) {
    console.error("❌ HOME SUMMARY ERROR:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "حدث خطأ في الخادم",
    });
  }
});

/* ======================================================
   ✅ TEST ROUTE
====================================================== */
router.get("/", (req, res) => {
  return res.json({
    success: true,
    message: "✅ Users route is working",
  });
});

export default router;