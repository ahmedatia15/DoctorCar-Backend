import Order from "../models/orderModel.js";
import { onlineTechnicians } from "../server.js";
import mongoose from "mongoose";

export const createOrder = async (req, res) => {
  try {
    const { userId, serviceName, serviceType, location } = req.body;

    // =========================
    // Validation
    // =========================
    if (
      !userId ||
      !serviceName ||
      !serviceType ||
      !location ||
      location.lat == null ||
      location.lng == null
    ) {
      return res.status(400).json({
        success: false,
        message: "⚠️ بيانات ناقصة",
      });
    }

    // لو الـ model محتاج ObjectId
    const userObjectId = mongoose.Types.ObjectId.isValid(userId)
      ? new mongoose.Types.ObjectId(userId)
      : userId;

    // =========================
    // Create Order
    // =========================
    const order = await Order.create({
      user: userObjectId,
      serviceName,
      serviceType,
      location: {
        lat: location.lat,
        lng: location.lng,
      },
      status: "pending",
      chatId: `chat_${Date.now()}`, // ✅ مهم جدًا
    });

    const payload = order.toObject();

    // =========================
    // Emit to ONLINE technicians
    // =========================
    if (req.io && onlineTechnicians.size > 0) {
      for (const [techId, socketId] of onlineTechnicians.entries()) {
        req.io.to(socketId).emit("order:new", payload);
        console.log(
          `📡 order:new sent to tech ${techId} (socket ${socketId})`
        );
      }
    } else {
      console.warn("⚠️ No online technicians");
    }

    return res.status(201).json({
      success: true,
      message: "✅ تم إنشاء الطلب وإرساله للفنيين",
      order: payload,
    });
  } catch (error) {
    console.error("❌ createOrder:", error);
    return res.status(500).json({
      success: false,
      message: "❌ خطأ في إنشاء الطلب",
      error: error.message,
    });
  }
};
