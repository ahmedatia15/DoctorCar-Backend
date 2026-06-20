import express from "express";
import mongoose from "mongoose";
import Order from "../models/orderModel.js";
import Accident from "../models/accidentModel.js";
import { onlineTechnicians } from "../server.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

function accidentToOrderLike(a) {
  const doc = a?.toObject ? a.toObject() : a;
  const id = String(doc._id);

  return {
    _id: id,
    id,
    orderId: id,
    type: doc.type || "emergency",
    priority: doc.priority || "high",
    serviceType: doc.serviceType || "accident",
    serviceName: doc.serviceName || doc.serviceType || "accident",
    status: doc.status || "pending",
    userName: doc.emergencyContactName || "بلاغ طوارئ",
    customerName: doc.emergencyContactName || "بلاغ طوارئ",
    emergencyContactName: doc.emergencyContactName || "",
    emergencyContactPhone: doc.emergencyContactPhone || "",
    notes: doc.notes || "",
    imageUrls: doc.imageUrls || [],
    audioUrl: doc.audioUrl || "",
    customerLocation: { lat: Number(doc.lat), lng: Number(doc.lng), address: doc.address || "" },
    location: { lat: Number(doc.lat), lng: Number(doc.lng), address: doc.address || "" },
    pickupLocation: { lat: Number(doc.lat), lng: Number(doc.lng), address: doc.address || "" },
    technician: doc.assignedTechnician
      ? { techId: String(doc.assignedTechnician) }
      : doc.assignedTechnicianName
      ? { techName: String(doc.assignedTechnicianName) }
      : null,
    center: doc.assignedCenter ? String(doc.assignedCenter) : null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

// GET /api/orders/center?center=<id>&limit=200
// Unified feed of orders + accidents for the center dashboard (initial load).
// Public on purpose (same pattern as /api/appointments/center).
router.get("/center", async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 200, 500);
    const centerId = String(req.query.center || "").trim();

    const orderFilter = {};
    const accidentFilter = {};

    if (centerId && mongoose.Types.ObjectId.isValid(centerId)) {
      orderFilter.center = centerId;
      accidentFilter.assignedCenter = centerId;
    }

    const [orders, accidents] = await Promise.all([
      Order.find(orderFilter)
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate("user", "name phone")
        .lean(),
      Accident.find(accidentFilter)
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean(),
    ]);

    const shapedOrders = orders.map((o) => ({
      ...o,
      _id: String(o._id),
      userName: o.user?.name || o.userName || "عميل",
      userPhone: o.user?.phone || "",
    }));

    const shapedAccidents = accidents.map(accidentToOrderLike);

    const merged = [...shapedAccidents, ...shapedOrders].sort((a, b) => {
      const at = new Date(a.createdAt || 0).getTime();
      const bt = new Date(b.createdAt || 0).getTime();
      return bt - at;
    });

    return res.json({
      success: true,
      count: merged.length,
      orders: merged.slice(0, limit),
    });
  } catch (error) {
    console.error("❌ GET /api/orders/center:", error);
    return res.status(500).json({
      success: false,
      message: error?.message || "خطأ في جلب الطلبات",
    });
  }
});

// GET /api/orders/my-orders?limit=100
// Returns the road-service / emergency orders that belong to the authenticated
// user, newest first. Powers the customer "Orders" screen so past requests
// are visible across devices (not just kept in local SharedPreferences).
router.get("/my-orders", protect, async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 100, 200);
    const userId = req.user._id;

    const orders = await Order.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("vehicle", "brand model plateNumber color year")
      .populate("center", "name address")
      .lean();

    const shaped = orders.map((o) => ({
      ...o,
      _id: String(o._id),
      id: String(o._id),
      vehicle: o.vehicle
        ? {
            _id: String(o.vehicle._id),
            brand: o.vehicle.brand || "",
            model: o.vehicle.model || "",
            plateNumber: o.vehicle.plateNumber || "",
            color: o.vehicle.color || "",
            year: o.vehicle.year || null,
          }
        : null,
      center: o.center
        ? {
            _id: String(o.center._id),
            name: o.center.name || "",
            address: o.center.address || "",
          }
        : null,
    }));

    return res.json({
      success: true,
      count: shaped.length,
      orders: shaped,
    });
  } catch (error) {
    console.error("❌ GET /api/orders/my-orders:", error);
    return res.status(500).json({
      success: false,
      message: error?.message || "خطأ في جلب الطلبات",
    });
  }
});

router.post("/", protect, async (req, res) => {
  try {
    const {
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

    // ✅ Canonical user id comes from the JWT, NOT the request body.
    const finalUserId = req.user._id;

    const finalLocation = location || customerLocation || pickupLocation;

    if (
      !serviceName ||
      !serviceType ||
      !finalLocation ||
      finalLocation.lat == null ||
      finalLocation.lng == null
    ) {
      return res.status(400).json({
        success: false,
        message: "⚠️ بيانات ناقصة",
        required: ["serviceName", "serviceType", "location.lat", "location.lng"],
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