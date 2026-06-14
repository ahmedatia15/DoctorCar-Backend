import Service from "../models/serviceModel.js";
import Technician from "../models/technicianModel.js";

/**
 * 🧭 جلب الطلبات القريبة من الفني
 * GET /api/technicians/requests?lat=24.7&lng=46.7
 */
export const getNearbyRequests = async (req, res) => {
  try {
    const { lat, lng, radius = 10 } = req.query; // كم كم من الفني
    const userLat = parseFloat(lat);
    const userLng = parseFloat(lng);

    if (!userLat || !userLng) {
      return res
        .status(400)
        .json({ message: "يرجى إرسال الإحداثيات (lat, lng)" });
    }

    // 🔍 جلب الطلبات "المنتظرة" فقط
    const services = await Service.find({ status: "pending" })
      .populate("user", "name phone")
      .populate("vehicle", "brand model plateNumber");

    // 🧮 فلترة الطلبات حسب المسافة (لو فيها location)
    const nearby = services.filter((s) => {
      if (!s.location || !s.location.lat || !s.location.lng) return false;
      const d = getDistance(userLat, userLng, s.location.lat, s.location.lng);
      return d <= radius;
    });

    res.json(nearby);
  } catch (err) {
    console.error("❌ Error in getNearbyRequests:", err);
    res.status(500).json({ message: "حدث خطأ أثناء جلب الطلبات" });
  }
};

/**
 * 🧰 قبول طلب من الفني
 * PUT /api/technicians/requests/:id/accept
 */
export const acceptRequest = async (req, res) => {
  try {
    const service = await Service.findById(req.params.id);
    if (!service)
      return res.status(404).json({ message: "❌ الطلب غير موجود" });

    if (service.status !== "pending") {
      return res
        .status(400)
        .json({ message: "⚠️ الطلب تم قبوله أو تنفيذه مسبقًا" });
    }

    // 🧑‍🔧 تحديد الفني الذي قبل الطلب
    service.status = "in_progress";
    service.technician = req.user._id;
    service.acceptedAt = new Date();
    await service.save();

    // 🧩 تحديث حالة الفني إلى غير متاح
    await Technician.findByIdAndUpdate(req.user._id, { isAvailable: false });

    // 💬 إخطار العميل (لاحقًا عبر Socket.IO)
    res.json({ message: "✅ تم قبول الطلب بنجاح", service });
  } catch (err) {
    console.error("❌ Error in acceptRequest:", err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * ✅ إنهاء الطلب من قبل الفني
 * PUT /api/technicians/requests/:id/complete
 */
export const completeRequest = async (req, res) => {
  try {
    const service = await Service.findById(req.params.id);
    if (!service)
      return res.status(404).json({ message: "❌ الطلب غير موجود" });

    service.status = "completed";
    service.completedAt = new Date();
    await service.save();

    // 🔄 إتاحة الفني من جديد
    await Technician.findByIdAndUpdate(req.user._id, { isAvailable: true });

    res.json({ message: "✅ تم إنهاء الخدمة بنجاح", service });
  } catch (err) {
    console.error("❌ Error in completeRequest:", err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * 📏 دالة مساعدة لحساب المسافة (km)
 */
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // نصف قطر الأرض كم
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) *
      Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function deg2rad(deg) {
  return deg * (Math.PI / 180);
}
