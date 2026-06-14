import mongoose from "mongoose";
import Service from "../models/serviceModel.js";
import Wallet from "../models/walletModel.js";

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);
const ALLOWED_TYPES = new Set(["sos", "tow", "battery", "fuel", "tire"]);
const ALLOWED_STATUS = new Set(["pending", "accepted", "in_progress", "completed", "canceled"]);

// إنشاء طلب
export const createService = async (req, res) => {
  try {
    const { vehicle, type, location, notes } = req.body;

    if (!vehicle || !isValidId(vehicle)) {
      return res.status(400).json({ message: "vehicle غير صالح" });
    }
    if (!type || !ALLOWED_TYPES.has(type)) {
      return res.status(400).json({ message: "type غير صالح (sos|tow|battery|fuel|tire)" });
    }

    const doc = await Service.create({
      user: req.user._id,
      vehicle,
      type,
      status: "pending",
      location,
      notes,
    });

    return res.status(201).json(doc);
  } catch (err) {
    console.error("createService error:", err);
    return res.status(500).json({ message: err.message });
  }
};

// طلبات العميل
export const getMyServices = async (req, res) => {
  try {
    const list = await Service.find({ user: req.user._id })
      .populate("vehicle", "brand model year")
      .populate("technician", "name email role")
      .sort({ createdAt: -1 });

    return res.json(list);
  } catch (err) {
    console.error("getMyServices error:", err);
    return res.status(500).json({ message: err.message });
  }
};

// تحديث حالة الطلب
export const updateServiceStatus = async (req, res) => {
  try {
    if (!["technician", "admin"].includes(req.user.role)) {
      return res.status(403).json({ message: "مسموح للفني أو الأدمن فقط" });
    }

    const { id } = req.params;
    if (!isValidId(id)) return res.status(400).json({ message: "معرف الطلب غير صالح" });

    const service = await Service.findById(id);
    if (!service) return res.status(404).json({ message: "الطلب غير موجود" });

    const { status, technician } = req.body;

    if (status && !ALLOWED_STATUS.has(status)) {
      return res.status(400).json({ message: "status غير صالح" });
    }

    if (status === "in_progress" && !service.technician) {
      service.technician = req.user._id;
    }

    if (technician && isValidId(technician) && req.user.role === "admin") {
      service.technician = technician;
    }

    if (status) service.status = status;

    await service.save();
    const populated = await Service.findById(id)
      .populate("vehicle", "brand model year")
      .populate("technician", "name email role");

    return res.json(populated);
  } catch (err) {
    console.error("updateServiceStatus error:", err);
    return res.status(500).json({ message: err.message });
  }
};

// قبول الطلب (فني)
export const acceptService = async (req, res) => {
  try {
    if (req.user.role !== "technician" && req.user.role !== "admin") {
      return res.status(403).json({ message: "مسموح للفني أو الأدمن فقط" });
    }

    const { id } = req.params;
    if (!isValidId(id)) return res.status(400).json({ message: "معرف الطلب غير صالح" });

    const service = await Service.findById(id);
    if (!service) return res.status(404).json({ message: "الطلب غير موجود" });

    if (service.status !== "pending") {
      return res.status(400).json({ message: "لا يمكن القبول—الحالة ليست pending" });
    }

    service.status = "in_progress";
    service.technician = req.user._id;
    await service.save();

    return res.json({ message: "تم قبول الطلب بنجاح", service });
  } catch (err) {
    console.error("acceptService error:", err);
    return res.status(500).json({ message: err.message });
  }
};

// إنهاء الطلب (فني)
export const completeService = async (req, res) => {
  try {
    if (req.user.role !== "technician" && req.user.role !== "admin") {
      return res.status(403).json({ message: "مسموح للفني أو الأدمن فقط" });
    }

    const { id } = req.params;
    if (!isValidId(id)) return res.status(400).json({ message: "معرف الطلب غير صالح" });

    const service = await Service.findById(id);
    if (!service) return res.status(404).json({ message: "الطلب غير موجود" });

    service.status = "completed";
    await service.save();

    return res.json({ message: "تم إنهاء الخدمة بنجاح", service });
  } catch (err) {
    console.error("completeService error:", err);
    return res.status(500).json({ message: err.message });
  }
};

// تقييم + دفع
export const rateAndPay = async (req, res) => {
  try {
    const { id } = req.params;
    const { rating = 5, paymentMethod = "wallet" } = req.body;

    if (!isValidId(id)) return res.status(400).json({ message: "معرف الطلب غير صالح" });

    const service = await Service.findById(id);
    if (!service) return res.status(404).json({ message: "الطلب غير موجود" });

    if (service.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "غير مسموح — ليس طلبك" });
    }

    if (service.status !== "completed") {
      return res.status(400).json({ message: "يمكن التقييم فقط بعد اكتمال الخدمة" });
    }

    if (typeof rating !== "number" || rating < 1 || rating > 5) {
      return res.status(400).json({ message: "rating يجب أن يكون رقمًا بين 1 و 5" });
    }
    service.rating = rating;
    await service.save();

    const amount = service.price && service.price > 0 ? service.price : 100;

    if (paymentMethod === "wallet" || paymentMethod === "cash") {
      if (!service.technician) {
        return res.status(400).json({ message: "لا يوجد فني مرتبط بالطلب لإتمام الدفع" });
      }

      let techWallet = await Wallet.findOne({ user: service.technician });
      if (!techWallet) {
        techWallet = await Wallet.create({ user: service.technician, balance: 0, transactions: [] });
      }

      techWallet.balance += amount;
      techWallet.transactions.push({
        amount,
        type: "credit",
        description: `دفع مقابل خدمة ${service.type} – Service#${service._id}`,
      });
      await techWallet.save();
    } else {
      return res.status(400).json({ message: "paymentMethod غير مدعوم (wallet|cash)" });
    }

    return res.json({
      message: "تم التقييم والدفع بنجاح ✅",
      serviceId: service._id,
      rating: service.rating,
      paid: amount,
    });
  } catch (err) {
    console.error("rateAndPay error:", err);
    return res.status(500).json({ message: err.message });
  }
};

// قائمة pending للفني
export const getPendingForTech = async (req, res) => {
  try {
    if (req.user.role !== "technician" && req.user.role !== "admin") {
      return res.status(403).json({ message: "مسموح للفني أو الأدمن فقط" });
    }
    const list = await Service.find({ status: "pending" })
      .populate("user", "name email")
      .populate("vehicle", "brand model year")
      .sort({ createdAt: -1 });

    return res.json(list);
  } catch (err) {
    console.error("getPendingForTech error:", err);
    return res.status(500).json({ message: err.message });
  }
};

/**
 * ✅ تحديث موقع الفني (ويتم بثه عبر Socket.IO)
 * PATCH /api/services/:id/tech-location
 * body: { lat, lng }
 * (role: technician | admin)
 */
export const updateTechLocation = async (req, res) => {
  try {
    if (req.user.role !== "technician" && req.user.role !== "admin") {
      return res.status(403).json({ message: "مسموح للفني أو الأدمن فقط" });
    }

    const { id } = req.params;
    const { lat, lng } = req.body;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "معرف الطلب غير صالح" });
    }
    if (typeof lat !== "number" || typeof lng !== "number") {
      return res.status(400).json({ message: "إحداثيات غير صحيحة" });
    }

    const service = await Service.findById(id);
    if (!service) return res.status(404).json({ message: "الطلب غير موجود" });

    service.technicianLocation = { lat, lng };
    if (!service.path) service.path = [];
    service.path.push({ lat, lng, ts: new Date() });
    await service.save();

    const io = req.app.get("io");
    io.to(`service:${id}`).emit("location:update", { lat, lng, ts: Date.now() });

    return res.json({
      message: "✅ تم تحديث موقع الفني بنجاح",
      technicianLocation: service.technicianLocation,
    });
  } catch (err) {
    console.error("updateTechLocation error:", err);
    return res.status(500).json({ message: err.message });
  }
};
