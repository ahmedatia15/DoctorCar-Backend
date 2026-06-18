// PATH: backend/middleware/technicianOnly.js
//
// Combined gate: must be authenticated (protect) + role === "technician".
// Also resolves the paired Technician document and attaches it as
// req.technician so controllers do not re-query for it.
import { protect } from "./authMiddleware.js";
import { ensureTechnicianProfile } from "../utils/ensureTechnicianProfile.js";

export const technicianOnly = [
  protect,
  async (req, res, next) => {
    try {
      if (!req.user || req.user.role !== "technician") {
        return res.status(403).json({
          success: false,
          message: "🚫 هذه الخدمة متاحة لحسابات الفنيين فقط",
        });
      }

      const tech = await ensureTechnicianProfile(req.user);
      if (!tech) {
        return res.status(500).json({
          success: false,
          message: "تعذر تحميل بيانات الفني",
        });
      }

      req.technician = tech;
      return next();
    } catch (err) {
      console.error("❌ technicianOnly error:", err?.message || err);
      return res.status(500).json({
        success: false,
        message: err?.message || "حدث خطأ في التحقق من الصلاحيات",
      });
    }
  },
];

export default technicianOnly;
