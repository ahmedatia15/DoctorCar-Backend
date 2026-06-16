// PATH: backend/middleware/authMiddleware.js
import jwt from "jsonwebtoken";
import User from "../models/userModel.js";
import Session from "../models/sessionModel.js";

// ============================================
// 🔐 Middleware: حماية الـ Routes
// ============================================
const protect = async (req, res, next) => {
  try {
    const auth = req.headers.authorization || "";

    if (!auth.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "🚫 غير مصرح، لا يوجد توكن",
      });
    }

    const token = auth.split(" ")[1];

    if (!process.env.JWT_SECRET) {
      console.error("❌ JWT_SECRET is missing in env");
      return res.status(500).json({
        success: false,
        message: "Server misconfiguration (JWT_SECRET missing)",
      });
    }

    // ✅ فك التوكن
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // ✅ Expose the JWT id so controllers can mark/skip the "current" session.
    req.tokenJti = decoded.jti || "";

    // ✅ Reject tokens whose session has been revoked (logout-from-this-device).
    // Tokens without a jti (legacy) are allowed through for compatibility.
    if (decoded.jti) {
      const session = await Session.findOne({ jti: decoded.jti })
        .select("status")
        .lean();
      if (session && session.status === "revoked") {
        return res.status(401).json({
          success: false,
          message: "❌ تم إنهاء هذه الجلسة",
        });
      }
    }

    // ✅ جلب المستخدم (بدون password)
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "❌ المستخدم غير موجود",
      });
    }

    // ✅ ممكن تتحقق من isActive لو حابب
    if (user.isActive === false) {
      return res.status(403).json({
        success: false,
        message: "⛔ الحساب غير مفعل",
      });
    }

    req.user = user; // password متشالش أصلًا لأن select:false + toJSON
    return next();
  } catch (error) {
    const msg =
      error?.name === "TokenExpiredError"
        ? "❌ التوكن منتهي"
        : "❌ التوكن غير صالح";

    console.error("❌ JWT Error:", error?.message || error);

    return res.status(401).json({
      success: false,
      message: msg,
    });
  }
};

// ============================================
// 🔑 Middleware: صلاحيات المستخدم
// ============================================
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "⛔ ليس لديك صلاحية للوصول",
      });
    }
    next();
  };
};

export { protect, authorize };
