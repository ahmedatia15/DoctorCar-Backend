import jwt from "jsonwebtoken";
import User from "../models/userModel.js";

/**
 * ✅ Middleware لحماية المسارات
 * يتحقق من وجود التوكن ويستخرج المستخدم منه
 */
export const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      // استخراج التوكن من الهيدر
      token = req.headers.authorization.split(" ")[1];

      // التحقق من التوكن
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // جلب المستخدم من قاعدة البيانات بدون كلمة المرور
      req.user = await User.findById(decoded.id).select("-password");

      if (!req.user) {
        return res.status(404).json({ message: "المستخدم غير موجود ❌" });
      }

      next(); // ✅ كل شيء تمام
    } catch (error) {
      console.error("❌ خطأ في التحقق من التوكن:", error);
      res.status(401).json({ message: "فشل التحقق من التوكن ⚠️" });
    }
  }

  if (!token) {
    res.status(401).json({ message: "🚫 لا يوجد توكن، الوصول مرفوض" });
  }
};
