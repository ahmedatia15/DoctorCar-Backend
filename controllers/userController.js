// PATH: backend/controllers/userController.js
import User from "../models/userModel.js";
import jwt from "jsonwebtoken";
import {
  normalizeRegistration,
  validateRegistration,
} from "../utils/validateRegistration.js";

// helper: generate JWT
const generateToken = (user) => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET غير موجود في env");
  }

  return jwt.sign(
    { id: user._id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "30d" }
  );
};

// helper: normalize email
const normalizeEmail = (email) => String(email || "").trim().toLowerCase();

// helper: map a portal/legacy role token to a canonical account role
const mapRole = (role) => {
  const r = String(role || "").trim().toLowerCase();
  if (["driver", "technician", "mechanic", "service_provider"].includes(r)) {
    return "technician";
  }
  if (r === "admin") return "admin";
  return "customer";
};

/* ======================================================
   ✅ REGISTER (typed: customer | technician)
   - Single source of truth used by /api/auth/register
     and /api/users/register.
   - Returns structured field errors: { success:false, errors:[...] }
====================================================== */
export const registerUser = async (req, res) => {
  try {
    // 1) Normalize input (trim, lowercase email, normalize phone, map role)
    const data = normalizeRegistration(req.body);

    // 2) Validate (collects per-field errors)
    const errors = validateRegistration(data);
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: "بيانات غير صالحة",
        errors,
      });
    }

    // 3) Duplicate checks (email + phone)
    const dupErrors = [];

    const emailExists = await User.findOne({ email: data.email })
      .select("_id")
      .lean();
    if (emailExists) {
      dupErrors.push({
        field: "email",
        message: "Email is already registered",
      });
    }

    const phoneExists = await User.findOne({ phone: data.phone })
      .select("_id")
      .lean();
    if (phoneExists) {
      dupErrors.push({
        field: "phone",
        message: "Phone number is already registered",
      });
    }

    if (dupErrors.length > 0) {
      return res.status(409).json({
        success: false,
        message: "الحساب موجود بالفعل",
        errors: dupErrors,
      });
    }

    // 4) Build role-specific document (only relevant fields are saved)
    const doc = {
      name: data.name,
      email: data.email,
      phone: data.phone,
      password: data.password, // hashed by the model pre-save hook
      governorate: data.governorate,
      role: data.role,
      authProvider: "local",
    };

    if (data.role === "customer") {
      doc.vehicleType = data.vehicleType || "";
    } else if (data.role === "technician") {
      doc.specialty = data.specialty;
    }

    const user = await User.create(doc);

    const token = generateToken(user);

    // password is stripped automatically (select:false + toJSON transform)
    return res.status(201).json({
      success: true,
      message: "تم التسجيل بنجاح ✅",
      token,
      user,
    });
  } catch (err) {
    // Mongo duplicate key → structured error
    if (err && err.code === 11000) {
      const field =
        Object.keys(err.keyPattern || err.keyValue || {})[0] || "email";
      return res.status(409).json({
        success: false,
        message: "الحساب موجود بالفعل",
        errors: [
          {
            field,
            message:
              field === "phone"
                ? "Phone number is already registered"
                : "Email is already registered",
          },
        ],
      });
    }

    // Mongoose schema validation → structured errors
    if (err && err.name === "ValidationError") {
      const fieldErrors = Object.values(err.errors || {}).map((e) => ({
        field: e.path,
        message: e.message,
      }));
      return res.status(400).json({
        success: false,
        message: "بيانات غير صالحة",
        errors: fieldErrors,
      });
    }

    console.error("❌ registerUser:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "حدث خطأ في الخادم",
    });
  }
};

/* ======================================================
   ✅ LOGIN
====================================================== */
export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "يرجى إدخال البريد الإلكتروني وكلمة المرور",
      });
    }

    const safeEmail = normalizeEmail(email);

    // ✅ لازم نختار password لأن select:false في الموديل
    const user = await User.findOne({ email: safeEmail }).select("+password");

    // رسالة موحدة (حماية)
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "❌ بيانات الدخول غير صحيحة",
      });
    }

    // ✅ منع local login لو الحساب Google (لو بتستخدم authProvider)
    if (user.authProvider && user.authProvider !== "local") {
      return res.status(401).json({
        success: false,
        message: "❌ هذا الحساب مسجل عبر Google",
      });
    }

    const valid = await user.matchPassword(password);
    if (!valid) {
      return res.status(401).json({
        success: false,
        message: "❌ بيانات الدخول غير صحيحة",
      });
    }

    // 🔒 Strict role separation: reject a mismatched portal login.
    const expectedRole = req.body.role ? mapRole(req.body.role) : null;
    if (expectedRole && user.role !== "admin" && user.role !== expectedRole) {
      return res.status(403).json({
        success: false,
        message:
          user.role === "technician"
            ? "🚫 هذا الحساب مسجَّل كحساب فني. الرجاء تسجيل الدخول من دخول الفنيين."
            : "🚫 هذا الحساب مسجَّل كحساب عميل. الرجاء تسجيل الدخول من دخول العملاء.",
      });
    }

    user.lastLogin = new Date();
    await user.save();

    const token = generateToken(user);

    // لا ترجع كلمة السر
    user.password = undefined;

    return res.json({
      success: true,
      message: "تم تسجيل الدخول بنجاح ✅",
      token,
      user,
    });
  } catch (err) {
    console.error("❌ loginUser:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "حدث خطأ في الخادم",
    });
  }
};

/* ======================================================
   ✅ GET PROFILE (Protected)
   - يفترض middleware حاطط req.user
====================================================== */
export const getProfile = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "غير مصرح",
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "المستخدم غير موجود",
      });
    }

    return res.json({
      success: true,
      user,
    });
  } catch (err) {
    console.error("❌ getProfile:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "حدث خطأ في الخادم",
    });
  }
};
