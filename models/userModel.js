// PATH: backend/models/userModel.js
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "الاسم مطلوب"],
      trim: true,
      minlength: [2, "الاسم قصير جدًا"],
    },

    email: {
      type: String,
      required: [true, "البريد الإلكتروني مطلوب"],
      unique: true, // ✅ كفاية لوحدها + هنسيب index واحد بس
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "يرجى إدخال بريد إلكتروني صالح"],
      // ❌ شيلنا sparse هنا لأنه required
    },

    phone: {
      type: String,
      // ✅ phone اختياري: عشان كده نخليه sparse + unique
      unique: true,
      sparse: true,
      trim: true,
      match: [/^[0-9]{10,15}$/, "رقم الهاتف غير صالح"],
    },

    // ✅ Google Login
    googleId: {
      type: String,
      default: "",
      // نخليه sparse عشان ما يعملش مشاكل لو فاضي
      index: true,
      sparse: true,
    },

    authProvider: {
      type: String,
      enum: ["local", "google", "phone"],
      default: "local",
    },

    password: {
      type: String,
      required: function () {
        return this.authProvider === "local";
      },
      minlength: [6, "كلمة المرور يجب أن تحتوي على 6 أحرف على الأقل"],
      select: false,
    },

    role: {
      type: String,
      enum: ["customer", "technician", "admin"],
      default: "customer",
      set: (v) => (v === "user" ? "customer" : v),
    },

    // ============================================================
    // 📍 Common profile (added for typed registration)
    // - kept lenient at schema level for backward compatibility with
    //   existing users; strict rules are enforced in the controller.
    // ============================================================
    governorate: {
      type: String,
      default: "",
      trim: true,
    },

    // Customer only (optional)
    vehicleType: {
      type: String,
      default: "",
      trim: true,
    },

    // Technician only (required at registration via controller validation)
    specialty: {
      type: String,
      default: "",
      trim: true,
    },

    avatar: {
      type: String,
      default: "",
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    lastLogin: {
      type: Date,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        delete ret.password;
        delete ret.__v;
        return ret;
      },
    },
  }
);

/* =======================================================
   ✅ Validation
   - بما إن email required: مش محتاجين validate "email OR phone"
======================================================= */
// ❌ حذفنا pre-validate لأنه غير ضروري مع required email

/* =======================================================
   🔐 Hash password
======================================================= */
userSchema.pre("save", async function (next) {
  try {
    // Google user أو password مش موجود: skip
    if (!this.password) return next();
    // لو مش متغير: skip
    if (!this.isModified("password")) return next();

    const saltRounds = 10;
    this.password = await bcrypt.hash(this.password, saltRounds);
    next();
  } catch (err) {
    next(err);
  }
});

/* =======================================================
   🔑 Match password
======================================================= */
userSchema.methods.matchPassword = async function (enteredPassword) {
  if (!this.password) return false;
  return bcrypt.compare(String(enteredPassword), this.password);
};

/* =======================================================
   🎟️ Generate JWT
======================================================= */
userSchema.methods.generateToken = function () {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET غير موجود في env");
  }

  return jwt.sign(
    { id: this._id, email: this.email, role: this.role },
    process.env.JWT_SECRET,
    { expiresIn: "30d" }
  );
};

/* =======================================================
   📌 Indexes
   - ❗ لا تكرر index لنفس الحقل (unique + schema.index)
======================================================= */
userSchema.index({ role: 1 });
// ملاحظة: email/phone unique متغطيين من field unique
// phone sparse متغطي من field sparse

const User = mongoose.models.User || mongoose.model("User", userSchema);
export default User;
