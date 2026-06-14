import express from "express";
import Order from "../models/orderModel.js";
import { onlineTechnicians } from "../server.js";

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const {
      userId,
      user,
      serviceName,
      serviceType,
      location,
      customerLocation,
      pickupLocation,
      address,
      notes,
      paymentMethod,
      vehicle,
      vehicleId,
      selectedServices,
      services,
    } = req.body;

    const finalUserId = userId || user;

    const finalLocation = location || customerLocation || pickupLocation;

    if (
      !finalUserId ||
      !serviceName ||
      !serviceType ||
      !finalLocation ||
      finalLocation.lat == null ||
      finalLocation.lng == null
    ) {
      return res.status(400).json({
        success: false,
        message: "⚠️ بيانات ناقصة",
        required: ["userId/user", "serviceName", "serviceType", "location.lat", "location.lng"],
        received: req.body,
      });
    }

    const io = req.io;

    const order = await Order.create({
      user: finalUserId,
      serviceName,
      serviceType,

      selectedServices: Array.isArray(selectedServices)
        ? selectedServices
        : serviceType
          ? [serviceType]
          : [],

      services: Array.isArray(services)
        ? services
        : serviceType
          ? [serviceType]
          : [],

      vehicle: vehicle || vehicleId || null,
      vehicleId: vehicleId || vehicle || null,

      location: {
        lat: Number(finalLocation.lat),
        lng: Number(finalLocation.lng),
        address: finalLocation.address || address || "",
      },

      customerLocation: {
        lat: Number(finalLocation.lat),
        lng: Number(finalLocation.lng),
        address: finalLocation.address || address || "",
      },

      pickupLocation: {
        lat: Number(finalLocation.lat),
        lng: Number(finalLocation.lng),
        address: finalLocation.address || address || "",
      },

      address: address || finalLocation.address || "",
      notes: notes || "",

      payment: {
        method: paymentMethod || "cash",
        isPaid: false,
      },

      status: "pending",
    });

    const orderPayload = {
      _id: String(order._id),
      user: String(finalUserId),
      userName: req.body.userName || "عميل",
      serviceName,
      serviceType,
      selectedServices: order.selectedServices,
      services: order.services,
      vehicle: order.vehicle,
      vehicleId: order.vehicleId,
      location: order.location,
      customerLocation: order.customerLocation,
      pickupLocation: order.pickupLocation,
      address: order.address,
      notes: order.notes,
      payment: order.payment,
      status: order.status,
      createdAt: order.createdAt,
    };

    if (io) {
      io.to(`user:${String(finalUserId)}`).emit("orderStatusUpdated", {
        orderId: String(order._id),
        status: "pending",
        message: "تم إرسال الطلب للمركز",
      });

      io.to(String(order._id)).emit("orderStatusUpdated", {
        orderId: String(order._id),
        status: "pending",
        message: "تم إرسال الطلب للمركز",
      });

      // ✅ الأهم: إرسال الطلب للداشبورد
      io.to("centers").emit("order:new", orderPayload);

      console.log("📦 order:new sent to centers:", String(order._id));

      // اختياري: نسيبه للفنيين كمان، لكن المركز هو اللي هيعين
      io.to("technicians").emit("order:new", orderPayload);

      if (onlineTechnicians && onlineTechnicians.size > 0) {
        for (const [techId, socketId] of onlineTechnicians.entries()) {
          if (!socketId) continue;
          io.to(socketId).emit("order:new", orderPayload);
          console.log(`📡 order:new → tech:${techId}`);
        }
      }
    }

    return res.status(201).json({
      success: true,
      message: "تم إرسال الطلب للمركز بنجاح",
      order,
    });
  } catch (error) {
    console.error("❌ createOrder error:", error);

    return res.status(500).json({
      success: false,
      message: error?.message || "خطأ في إنشاء الطلب",
    });
  }
});

export default router;