// PATH: backend/server.js
import express from "express";
import dotenv from "dotenv";
import http from "http";
import cors from "cors";
import helmet from "helmet";
import mongoose from "mongoose";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import { Server } from "socket.io";

import connectDB from "./config/db.js";

import authRoutes from "./routes/authroutes.js";
import userRoutes from "./routes/userRoutes.js";
import vehicleRoutes from "./routes/vehicleRoutes.js";
import serviceRoutes from "./routes/serviceRoutes.js";
import technicianRoutes from "./routes/technicianRoutes.js";
import walletRoutes from "./routes/walletRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import feedbackRoutes from "./routes/feedbackRoutes.js";
import accidentRoutes from "./routes/accidentRoutes.js";
import carTypesRoutes from "./routes/carTypes.routes.js";
import maintenanceRoutes from "./routes/maintenance.routes.js";
import supportChatRoutes from "./routes/supportChatRoutes.js";
import centerRoutes from "./routes/centerRoutes.js";
import orderEstimateRoutes from "./routes/orderEstimate.routes.js";
import mapsRoutes from "./routes/maps.routes.js";
import aiRoutes from "./routes/aiRoutes.js";

import { attachSupportChatSocket } from "./socket/supportChatsocket.js";
import Order from "./models/orderModel.js";
import Center from "./models/centerModel.js";
import Accident from "./models/accidentModel.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, ".env") });

const app = express();
const server = http.createServer(app);

const IS_PROD = process.env.NODE_ENV === "production";
const PORT = Number(process.env.PORT || 5555);
const HOST = process.env.HOST || "0.0.0.0";
const ORDER_TIMEOUT_SEC = Number(process.env.ORDER_TIMEOUT_SEC || 60);
const BODY_LIMIT = process.env.BODY_LIMIT || "2mb";
const SOCKET_PATH = process.env.SOCKET_PATH || "/socket.io";

const CORS_ORIGINS = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.set("trust proxy", 1);

mongoose.set("autoIndex", !IS_PROD);
mongoose.set("bufferCommands", false);

app.use(
  helmet({
    crossOriginResourcePolicy: false,
    crossOriginOpenerPolicy: false,
    contentSecurityPolicy: false,
  })
);

app.use(express.json({ limit: BODY_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: BODY_LIMIT }));

// Serve uploaded accident images/audio
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

function isOriginAllowed(origin) {
  if (!origin) return true;
  if (!IS_PROD) return true;
  if (CORS_ORIGINS.length === 0) return true;
  return CORS_ORIGINS.includes(origin);
}

function normalizeDoc(doc) {
  return doc?.toObject ? doc.toObject() : doc;
}

function getId(value) {
  if (!value) return "";
  return String(value?._id || value);
}

function isValidObjectId(id) {
  return id && mongoose.Types.ObjectId.isValid(String(id));
}

function isAnyId(id) {
  return id !== null && id !== undefined && String(id).trim().length >= 2;
}

function getOrderUserId(order) {
  return getId(order?.user || order?.customer || order?.customerId);
}

function getOrderTechnicianId(order) {
  return getId(
    order?.technician?.techId ||
      order?.technician?.id ||
      order?.technician?._id ||
      order?.technicianId ||
      order?.technician
  );
}

function getOrderRooms(orderId) {
  const id = String(orderId || "").trim();
  return id ? [id, `order:${id}`, `accident:${id}`] : [];
}

function emitToOrder(orderId, event, payload) {
  for (const room of getOrderRooms(orderId)) {
    io.to(room).emit(event, payload);
  }
}

function joinOrderRooms(socket, orderId) {
  for (const room of getOrderRooms(orderId)) {
    socket.join(room);
  }
}

function leaveOrderRooms(socket, orderId) {
  for (const room of getOrderRooms(orderId)) {
    socket.leave(room);
  }
}

function isTerminalOrderStatus(status) {
  return ["arrived", "completed", "canceled", "cancelled"].includes(
    String(status || "")
  );
}

function isTimeoutProtectedStatus(status) {
  return [
    "assigned",
    "accepted",
    "on_the_way",
    "arrived",
    "in_progress",
    "completed",
    "canceled",
    "cancelled",
    "timeout",
  ].includes(String(status || ""));
}

function toNumber(v) {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function parseLocationPayload(data = {}) {
  const location = data.location || {};
  const coords = data.coords || {};

  const orderId = String(
    data.orderId ||
      data.order_id ||
      data.requestId ||
      data.request_id ||
      data.bookingId ||
      data.booking_id ||
      data.accidentId ||
      data.accident_id ||
      ""
  ).trim();

  const technicianId = String(
    data.technicianId ||
      data.technician_id ||
      data.techId ||
      data.tech_id ||
      data.technician?.techId ||
      data.technician?.id ||
      data.technician ||
      ""
  ).trim();

  const lat = toNumber(
    data.lat ??
      data.latitude ??
      location.lat ??
      location.latitude ??
      coords.lat ??
      coords.latitude
  );

  const lng = toNumber(
    data.lng ??
      data.longitude ??
      location.lng ??
      location.longitude ??
      coords.lng ??
      coords.longitude
  );

  const bearing = toNumber(
    data.bearing ?? data.heading ?? location.bearing ?? location.heading
  );

  const speed = toNumber(data.speed ?? location.speed);

  return { orderId, technicianId, lat, lng, bearing, speed };
}

function accidentToOrderLike(accident) {
  const payload = normalizeDoc(accident);
  if (!payload) return null;

  return {
    ...payload,
    _id: getId(payload._id),
    id: getId(payload._id),
    orderId: getId(payload._id),
    type: payload.type || "emergency",
    priority: payload.priority || "high",
    serviceType: payload.serviceType || "accident",
    serviceName: payload.serviceName || "accident",
    status: payload.status || "pending",
    customerName:
      payload.customerName || payload.emergencyContactName || "بلاغ طوارئ",
    customerLocation: {
      lat: payload.lat,
      lng: payload.lng,
      address: payload.address,
    },
    location: {
      lat: payload.lat,
      lng: payload.lng,
      address: payload.address,
    },
    pickupLocation: {
      lat: payload.lat,
      lng: payload.lng,
      address: payload.address,
    },
  };
}

function emitAccidentUpdated(accident, options = {}) {
  const payload = accidentToOrderLike(accident);
  if (!payload) return;

  const accidentId = getId(payload._id);
  const technicianId = getOrderTechnicianId(payload);

  const statusPayload = {
    orderId: accidentId,
    accidentId,
    status: payload.status,
    technicianId: technicianId || undefined,
    message: options.message || "تم تحديث بلاغ الحادث",
    at: Date.now(),
  };

  io.to("centers").emit("order:updated", payload);
  io.to("centers").emit("accident:updated", payload);
  io.to("centers").emit("orderStatusUpdated", statusPayload);

  if (accidentId) {
    emitToOrder(accidentId, "order:updated", payload);
    emitToOrder(accidentId, "accident:updated", payload);
    emitToOrder(accidentId, "orderStatusUpdated", statusPayload);
    emitToOrder(accidentId, "order:status", statusPayload);
  }

  if (technicianId) {
    io.to(`technician:${technicianId}`).emit("order:assigned", payload);
    io.to(`technician:${technicianId}`).emit("order:updated", payload);
    io.to(`technician:${technicianId}`).emit("accident:assigned", payload);
  }
}

function emitOrderUpdated(order, options = {}) {
  const payload = normalizeDoc(order);
  if (!payload) return;

  const orderId = getId(payload._id);
  const userId = getOrderUserId(payload);
  const technicianId = getOrderTechnicianId(payload);

  const statusPayload = {
    orderId,
    status: payload.status,
    technicianId: technicianId || undefined,
    message: options.message || "تم تحديث الطلب",
    at: Date.now(),
  };

  io.to("centers").emit("order:updated", payload);
  io.to("centers").emit("orderStatusUpdated", statusPayload);

  if (orderId) {
    emitToOrder(orderId, "order:updated", payload);
    emitToOrder(orderId, "orderStatusUpdated", statusPayload);
    emitToOrder(orderId, "order:status", statusPayload);
  }

  if (userId) {
    io.to(`user:${userId}`).emit("order:updated", payload);
    io.to(`user:${userId}`).emit("orderStatusUpdated", statusPayload);
    io.to(`user:${userId}`).emit("order:status", statusPayload);
  }

  if (technicianId) {
    io.to(`technician:${technicianId}`).emit("order:assigned", payload);
    io.to(`technician:${technicianId}`).emit("order:updated", payload);
  }
}

app.use(
  cors({
    origin: (origin, cb) => {
      if (isOriginAllowed(origin)) return cb(null, true);
      return cb(new Error(`CORS blocked: ${origin}`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "Accept",
      "Origin",
      "X-Requested-With",
    ],
  })
);

app.use((req, res, next) => {
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

if (!IS_PROD) {
  console.log("GOOGLE WEB KEY LOADED:", !!process.env.GOOGLE_MAPS_API_KEY);
  console.log("GOOGLE SERVER KEY LOADED:", !!process.env.GOOGLE_SERVER_MAPS_KEY);
}

export const io = new Server(server, {
  path: SOCKET_PATH,
  cors: {
    origin: (origin, cb) => {
      if (isOriginAllowed(origin)) return cb(null, true);
      return cb(new Error(`Socket CORS blocked: ${origin}`));
    },
    credentials: true,
    methods: ["GET", "POST"],
  },
  transports: ["websocket", "polling"],
  allowEIO3: true,
  pingTimeout: 30000,
  pingInterval: 25000,
});

export const onlineTechnicians = new Map();
export const onlineCenters = new Map();

const orderTimeoutTimers = new Map();

function clearOrderTimeout(orderId) {
  const key = String(orderId);
  const old = orderTimeoutTimers.get(key);
  if (old) clearTimeout(old);
  orderTimeoutTimers.delete(key);
}

function scheduleOrderTimeout(orderId, userId) {
  if (!orderId) return;
  clearOrderTimeout(orderId);

  const timer = setTimeout(async () => {
    try {
      if (mongoose.connection?.readyState !== 1) return;

      const order = await Order.findById(orderId);
      if (!order) return;

      if (isTimeoutProtectedStatus(order.status)) return;

      order.status = "timeout";
      await order.save();

      const payload = {
        orderId: String(orderId),
        status: "timeout",
        message: "لم يتم العثور على فني الآن",
        at: Date.now(),
      };

      emitToOrder(orderId, "orderStatusUpdated", payload);
      emitToOrder(orderId, "order:timeout", payload);
      io.to("centers").emit("order:updated", normalizeDoc(order));

      if (userId) {
        io.to(`user:${String(userId)}`).emit("order:timeout", payload);
        io.to(`user:${String(userId)}`).emit("orderStatusUpdated", payload);
      }

      console.log(`⏱️ Order timeout: ${orderId}`);
    } catch (error) {
      console.error("❌ timeout handler:", error?.message || error);
    } finally {
      clearOrderTimeout(orderId);
    }
  }, ORDER_TIMEOUT_SEC * 1000);

  orderTimeoutTimers.set(String(orderId), timer);
}

app.get("/", (req, res) => {
  res.status(200).send("🚗 Doctor Car Backend يعمل بنجاح ✅");
});

app.get("/api/health", (req, res) => {
  const dbState = mongoose.connection?.readyState ?? 0;

  res.json({
    ok: true,
    message: "API is healthy ✅",
    port: PORT,
    host: HOST,
    db: {
      readyState: dbState,
      connected: dbState === 1,
      name: mongoose.connection?.name || null,
      host: mongoose.connection?.host || null,
    },
    env: process.env.NODE_ENV || "development",
    socketPath: SOCKET_PATH,
    bestLocalIP: getBestLocalIP(),
    allLocalIPs: getAllLocalIPv4(),
    onlineTechnicians: onlineTechnicians.size,
    onlineCenters: onlineCenters.size,
    uptimeSec: Math.round(process.uptime()),
    now: new Date().toISOString(),
  });
});

app.get("/api/debug/socket", (req, res) => {
  res.json({
    ok: true,
    socketPath: SOCKET_PATH,
    transports: ["websocket", "polling"],
    onlineTechnicians: onlineTechnicians.size,
    onlineCenters: onlineCenters.size,
  });
});

function dbReadyGuard(req, res, next) {
  const openPaths = new Set(["/", "/api/health", "/api/debug/socket"]);

  if (!IS_PROD) {
    openPaths.add("/api/test/fake-order");
    openPaths.add("/api/test/fake-accident");
  }

  if (openPaths.has(req.path) || req.path.startsWith(SOCKET_PATH)) {
    return next();
  }

  if (mongoose.connection?.readyState !== 1) {
    return res.status(503).json({
      success: false,
      message: "Database not connected",
      code: "DB_UNAVAILABLE",
    });
  }

  next();
}

app.use(dbReadyGuard);

app.use((req, res, next) => {
  req.io = io;

  req.emitOrderToCenters = (order, centerId = null) => {
    const payload = normalizeDoc(order);
    if (!payload) return;

    if (centerId) {
      io.to(`center:${String(centerId)}`).emit("order:new", payload);
    } else {
      io.to("centers").emit("order:new", payload);
    }
  };

  req.emitAccidentToCenters = (accident, centerId = null) => {
    const payload = accidentToOrderLike(accident);
    if (!payload) return;

    if (centerId) {
      io.to(`center:${String(centerId)}`).emit("order:new", payload);
      io.to(`center:${String(centerId)}`).emit("accident:new", payload);
    } else {
      io.to("centers").emit("order:new", payload);
      io.to("centers").emit("accident:new", payload);
    }

    console.log(`🚨 Emergency accident sent to centers: ${payload._id}`);
  };

  req.emitAccidentUpdated = emitAccidentUpdated;
  req.emitOrderUpdated = emitOrderUpdated;

  next();
});

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/vehicles", vehicleRoutes);
app.use("/api/services", serviceRoutes);
app.use("/api/technicians", technicianRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/maps", mapsRoutes);

app.use("/api/orders", (req, res, next) => {
  const originalJson = res.json.bind(res);

  res.json = (body) => {
    try {
      const isCreateOrderRequest =
        req.method === "POST" &&
        req.baseUrl === "/api/orders" &&
        (req.path === "/" || req.path === "");

      if (isCreateOrderRequest && res.statusCode === 201 && body?.order?._id) {
        const orderId = String(body.order._id);
        const userId = getOrderUserId(body.order);
        const centerId = getId(body.order.center);

        scheduleOrderTimeout(orderId, userId);

        if (centerId) {
          io.to(`center:${centerId}`).emit("order:new", body.order);
        } else {
          io.to("centers").emit("order:new", body.order);
        }

        console.log(`📦 New order sent to center dashboard: ${orderId}`);
      }
    } catch (error) {
      console.warn("⚠️ order hook failed:", error?.message || error);
    }

    return originalJson(body);
  };

  next();
});

app.use("/api/orders", orderRoutes);
app.use("/api/orders", orderEstimateRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/feedback", feedbackRoutes);
app.use("/api/accidents", accidentRoutes);
app.use("/api/maintenance", maintenanceRoutes);
app.use("/api/car-types", carTypesRoutes);
app.use("/api/support", supportChatRoutes);
app.use("/api/centers", centerRoutes);

if (!IS_PROD) {
  app.post("/api/test/fake-order", (req, res) => {
    const fakeOrder = {
      _id: `ORDER_TEST_${Date.now()}`,
      userName: "محمد إبراهيم",
      serviceType: "battery",
      distance: 3,
      chatId: "CHAT_TEST_123",
      status: "pending",
      createdAt: new Date().toISOString(),
      customerLocation: { lat: 30.0444, lng: 31.2357 },
    };

    io.to("centers").emit("order:new", fakeOrder);
    console.log("🧪 Fake order emitted to centers:", fakeOrder);

    res.json({ ok: true, sentTo: "centers", order: fakeOrder });
  });

  app.post("/api/test/fake-accident", (req, res) => {
    const fakeAccident = {
      _id: `ACCIDENT_TEST_${Date.now()}`,
      id: `ACCIDENT_TEST_${Date.now()}`,
      orderId: `ACCIDENT_TEST_${Date.now()}`,
      type: "emergency",
      priority: "high",
      serviceType: "accident",
      serviceName: "accident",
      status: "pending",
      createdAt: new Date().toISOString(),
      lat: 30.0444,
      lng: 31.2357,
      address: "موقع حادث تجربة - القاهرة",
      notes: "بلاغ تجربة: حادث على الطريق ويحتاج تدخل سريع.",
      emergencyContactName: "أحمد",
      emergencyContactPhone: "01000000000",
      imageUrls: [],
      audioUrl: "",
      customerName: "بلاغ طوارئ",
      customerLocation: { lat: 30.0444, lng: 31.2357 },
      location: { lat: 30.0444, lng: 31.2357 },
      pickupLocation: { lat: 30.0444, lng: 31.2357 },
    };

    io.to("centers").emit("order:new", fakeAccident);
    io.to("centers").emit("accident:new", fakeAccident);
    console.log("🧪 Fake accident emitted to centers:", fakeAccident);

    res.json({ ok: true, sentTo: "centers", accident: fakeAccident });
  });
}

io.on("connection", (socket) => {
  console.log("🟢 Socket connected:", socket.id);

  try {
    attachSupportChatSocket(io, socket);
  } catch (error) {
    console.warn("⚠️ supportChat attach error:", error?.message || error);
  }

  socket.on("user:join", ({ userId } = {}) => {
    if (!isAnyId(userId)) return;
    socket.join(`user:${String(userId).trim()}`);
  });

  socket.on("user:online", ({ userId } = {}) => {
    if (!isAnyId(userId)) return;

    const id = String(userId).trim();
    socket.join(`user:${id}`);

    socket.emit("user:online:ok", {
      userId: id,
      socketId: socket.id,
    });

    console.log(`👤 user online: ${id} -> ${socket.id}`);
  });

  socket.on("center:join", ({ centerId } = {}) => {
    if (!isAnyId(centerId)) return;

    const id = String(centerId).trim();

    onlineCenters.set(id, socket.id);
    socket.join("centers");
    socket.join(`center:${id}`);

    socket.emit("center:online:ok", {
      centerId: id,
      socketId: socket.id,
      onlineCenters: onlineCenters.size,
    });

    console.log(`🏢 center joined: ${id} -> ${socket.id}`);
  });

  socket.on("center:online", ({ centerId } = {}) => {
    if (!isAnyId(centerId)) return;

    const id = String(centerId).trim();

    onlineCenters.set(id, socket.id);
    socket.join("centers");
    socket.join(`center:${id}`);

    socket.emit("center:online:ok", {
      centerId: id,
      socketId: socket.id,
      onlineCenters: onlineCenters.size,
    });

    console.log(`🏢 center online: ${id} -> ${socket.id}`);
  });

  socket.on("technician:join", ({ technicianId } = {}) => {
    if (!isAnyId(technicianId)) return;

    const id = String(technicianId).trim();

    onlineTechnicians.set(id, socket.id);
    socket.join("technicians");
    socket.join(`technician:${id}`);

    socket.emit("technician:online:ok", {
      technicianId: id,
      socketId: socket.id,
      onlineCount: onlineTechnicians.size,
    });

    console.log(`🛠️ technician joined: ${id} -> ${socket.id}`);
  });

  socket.on("technician:online", ({ technicianId } = {}) => {
    if (!isAnyId(technicianId)) return;

    const id = String(technicianId).trim();

    onlineTechnicians.set(id, socket.id);
    socket.join("technicians");
    socket.join(`technician:${id}`);

    socket.emit("technician:online:ok", {
      technicianId: id,
      socketId: socket.id,
      onlineCount: onlineTechnicians.size,
    });

    console.log(`🛠️ technician online: ${id} -> ${socket.id}`);
  });

  const joinOrder = (payload = {}) => {
    const orderId =
      typeof payload === "string"
        ? payload
        : payload?.orderId || payload?._id || payload?.accidentId;

    if (!isAnyId(orderId)) return;

    const id = String(orderId).trim();
    joinOrderRooms(socket, id);

    socket.emit("joinOrderRoom:ok", {
      orderId: id,
      accidentId: id,
      socketId: socket.id,
    });

    console.log(`📦 joined order/accident room: ${id} -> ${socket.id}`);
  };

  const leaveOrder = (payload = {}) => {
    const orderId =
      typeof payload === "string"
        ? payload
        : payload?.orderId || payload?._id || payload?.accidentId;

    if (!isAnyId(orderId)) return;

    const id = String(orderId).trim();
    leaveOrderRooms(socket, id);

    socket.emit("leaveOrderRoom:ok", {
      orderId: id,
      accidentId: id,
      socketId: socket.id,
    });

    console.log(`📦 left order/accident room: ${id} -> ${socket.id}`);
  };

  socket.on("joinOrderRoom", joinOrder);
  socket.on("order:join", joinOrder);
  socket.on("join_order", joinOrder);
  socket.on("accident:join", joinOrder);

  socket.on("leaveOrderRoom", leaveOrder);
  socket.on("order:leave", leaveOrder);
  socket.on("leave_order", leaveOrder);
  socket.on("accident:leave", leaveOrder);

  socket.on("center:assign-technician", async (payload = {}) => {
    const orderId = getId(payload.orderId || payload.accidentId);
    const technicianId = getId(payload.technicianId);
    const centerId = getId(payload.centerId);

    if (!isAnyId(orderId) || !isAnyId(technicianId)) {
      socket.emit("center:assign-technician:failed", {
        orderId: orderId || null,
        reason: "orderId and technicianId are required",
      });
      return;
    }

    if (String(orderId).startsWith("ORDER_TEST_")) {
      const fakeUpdatedOrder = {
        _id: String(orderId),
        userName: "محمد إبراهيم",
        serviceType: "battery",
        distance: 3,
        chatId: "CHAT_TEST_123",
        status: "assigned",
        createdAt: new Date().toISOString(),
        acceptedAt: new Date().toISOString(),
        center: centerId || "center1",
        technician: { techId: String(technicianId) },
        customerLocation: { lat: 30.0444, lng: 31.2357 },
      };

      socket.emit("center:assign-technician:ok", fakeUpdatedOrder);
      io.to("centers").emit("order:updated", fakeUpdatedOrder);
      io.to(`technician:${String(technicianId)}`).emit(
        "order:assigned",
        fakeUpdatedOrder
      );

      emitToOrder(orderId, "orderStatusUpdated", {
        orderId: String(orderId),
        status: "assigned",
        technicianId: String(technicianId),
        message: "تم تعيين فني تجربة",
        at: Date.now(),
      });

      console.log(`🧪 Fake order ${orderId} assigned to ${technicianId}`);
      return;
    }

    if (String(orderId).startsWith("ACCIDENT_TEST_")) {
      const fakeUpdatedAccident = {
        _id: String(orderId),
        id: String(orderId),
        orderId: String(orderId),
        type: "emergency",
        priority: "high",
        serviceType: "accident",
        status: "assigned",
        createdAt: new Date().toISOString(),
        acceptedAt: new Date().toISOString(),
        center: centerId || "center1",
        technician: { techId: String(technicianId) },
        customerName: "بلاغ طوارئ",
        emergencyContactName: "أحمد",
        emergencyContactPhone: "01000000000",
        notes: "بلاغ تجربة: حادث على الطريق ويحتاج تدخل سريع.",
        lat: 30.0444,
        lng: 31.2357,
        customerLocation: { lat: 30.0444, lng: 31.2357 },
        location: { lat: 30.0444, lng: 31.2357 },
        pickupLocation: { lat: 30.0444, lng: 31.2357 },
      };

      socket.emit("center:assign-technician:ok", fakeUpdatedAccident);
      io.to("centers").emit("order:updated", fakeUpdatedAccident);
      io.to("centers").emit("accident:updated", fakeUpdatedAccident);
      io.to(`technician:${String(technicianId)}`).emit(
        "accident:assigned",
        fakeUpdatedAccident
      );

      emitToOrder(orderId, "orderStatusUpdated", {
        orderId: String(orderId),
        accidentId: String(orderId),
        status: "assigned",
        technicianId: String(technicianId),
        message: "تم تعيين فني لبلاغ تجربة",
        at: Date.now(),
      });

      console.log(`🧪 Fake accident ${orderId} assigned to ${technicianId}`);
      return;
    }

    try {
      if (mongoose.connection?.readyState !== 1) {
        socket.emit("center:assign-technician:failed", {
          orderId: String(orderId),
          reason: "Database not connected",
        });
        return;
      }

      if (!isValidObjectId(orderId)) {
        socket.emit("center:assign-technician:failed", {
          orderId: String(orderId),
          reason: "Invalid order id",
        });
        return;
      }

      const currentOrder = await Order.findById(orderId);

      if (currentOrder) {
        if (isTerminalOrderStatus(currentOrder.status)) {
          socket.emit("center:assign-technician:failed", {
            orderId: String(orderId),
            reason: "لا يمكن تعيين فني لطلب مكتمل أو ملغي",
          });
          return;
        }

        const updatePayload = {
          status: "assigned",
          acceptedAt: currentOrder.acceptedAt || new Date(),
          ...(centerId && isValidObjectId(centerId)
            ? { center: String(centerId) }
            : {}),
          ...(isValidObjectId(technicianId)
            ? { "technician.techId": String(technicianId) }
            : { "technician.techName": String(technicianId) }),
        };

        const updated = await Order.findByIdAndUpdate(
          orderId,
          { $set: updatePayload },
          { new: true }
        );

        if (!updated) {
          socket.emit("center:assign-technician:failed", {
            orderId: String(orderId),
            reason: "Failed to update order",
          });
          return;
        }

        clearOrderTimeout(orderId);

        const order = normalizeDoc(updated);

        socket.emit("center:assign-technician:ok", order);
        emitOrderUpdated(order, { message: "تم تعيين فني من المركز" });

        console.log(
          `🏢 Center assigned/changed order ${orderId} to technician ${technicianId}`
        );
        return;
      }

      const currentAccident = await Accident.findById(orderId);

      if (!currentAccident) {
        socket.emit("center:assign-technician:failed", {
          orderId: String(orderId),
          reason: "Order or accident not found",
        });
        return;
      }

      if (isTerminalOrderStatus(currentAccident.status)) {
        socket.emit("center:assign-technician:failed", {
          orderId: String(orderId),
          reason: "لا يمكن تعيين فني لبلاغ منتهي أو ملغي",
        });
        return;
      }

      const accidentUpdatePayload = {
        status: "assigned",
        assignedAt: currentAccident.assignedAt || new Date(),
        ...(centerId && isValidObjectId(centerId)
          ? { assignedCenter: String(centerId) }
          : {}),
        ...(isValidObjectId(technicianId)
          ? { assignedTechnician: String(technicianId) }
          : { assignedTechnicianName: String(technicianId) }),
      };

      const updatedAccident = await Accident.findByIdAndUpdate(
        orderId,
        { $set: accidentUpdatePayload },
        { new: true }
      );

      if (!updatedAccident) {
        socket.emit("center:assign-technician:failed", {
          orderId: String(orderId),
          reason: "Failed to update accident",
        });
        return;
      }

      const accidentOrderLike = accidentToOrderLike(updatedAccident);

      socket.emit("center:assign-technician:ok", accidentOrderLike);
      emitAccidentUpdated(updatedAccident, {
        message: "تم تعيين فني لبلاغ الحادث",
      });

      console.log(
        `🚨 Center assigned accident ${orderId} to technician ${technicianId}`
      );
    } catch (error) {
      console.error("❌ center:assign-technician:", error?.message || error);

      socket.emit("center:assign-technician:failed", {
        orderId: String(orderId),
        reason: error?.message || "Server error",
      });
    }
  });

  async function handleTechnicianLocation(payload = {}) {
    try {
      const parsed = parseLocationPayload(payload);
      const { orderId, technicianId, lat, lng, bearing, speed } = parsed;

      if (!isAnyId(orderId) || !isAnyId(technicianId)) return;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

      if (isValidObjectId(orderId) && mongoose.connection?.readyState === 1) {
        const order = await Order.findById(orderId).select("status").lean();
        const accident = !order
          ? await Accident.findById(orderId).select("status").lean()
          : null;

        const currentStatus = order?.status || accident?.status;

        if (isTerminalOrderStatus(currentStatus)) {
          socket.emit("technician:location:ack", {
            ok: false,
            orderId,
            technicianId,
            reason: "tracking_finished",
            status: currentStatus,
            ts: new Date().toISOString(),
          });
          return;
        }
      }

      const locationPayload = {
        orderId,
        accidentId: orderId,
        technicianId,
        lat,
        lng,
        latitude: lat,
        longitude: lng,
        bearing: bearing ?? null,
        heading: bearing ?? null,
        speed: speed ?? null,
        location: {
          lat,
          lng,
          latitude: lat,
          longitude: lng,
          bearing: bearing ?? null,
          heading: bearing ?? null,
          speed: speed ?? null,
        },
        ts: new Date().toISOString(),
        at: Date.now(),
      };

      socket.emit("technician:location:ack", {
        ok: true,
        orderId,
        technicianId,
        ts: new Date().toISOString(),
      });

      const events = [
        "order:location:update",
        "order:technician:location",
        "technicianLocationUpdate",
        "technician:location:update",
        "technician:location:updated",
        "technician_location",
        "technicianLocation",
      ];

      for (const event of events) {
        emitToOrder(orderId, event, locationPayload);
        io.to("centers").emit(event, locationPayload);
      }

      if (isValidObjectId(orderId) && mongoose.connection?.readyState === 1) {
        const update = {
          $set: {
            "tracking.lastTechnicianLocation": {
              lat,
              lng,
              ...(bearing != null ? { heading: bearing } : {}),
              ...(speed != null ? { speed } : {}),
              updatedAt: new Date(),
            },
          },
        };

        const updatedOrder = await Order.findByIdAndUpdate(orderId, update, {
          new: false,
        }).catch(() => null);

        if (!updatedOrder) {
          await Accident.findByIdAndUpdate(orderId, update, {
            new: false,
          }).catch(() => null);
        }
      }

      console.log(
        `📍 technician live location -> order/accident ${orderId} | tech ${technicianId} | ${lat}, ${lng}`
      );
    } catch (error) {
      console.error("❌ technician location:", error?.message || error);
    }
  }

  socket.on("technician:location:update", handleTechnicianLocation);
  socket.on("order:technician:location", handleTechnicianLocation);
  socket.on("technicianLocationUpdate", handleTechnicianLocation);
  socket.on("technician:location:updated", handleTechnicianLocation);
  socket.on("technician_location", handleTechnicianLocation);
  socket.on("technicianLocation", handleTechnicianLocation);

  socket.on("order:on_the_way", async ({ orderId, accidentId, technicianId } = {}) => {
    const id = orderId || accidentId;
    if (!isValidObjectId(id) || !isAnyId(technicianId)) return;

    try {
      const order = await Order.findOneAndUpdate(
        {
          _id: id,
          status: { $in: ["accepted", "assigned", "pending"] },
        },
        {
          $set: {
            status: "on_the_way",
            onTheWayAt: new Date(),
          },
        },
        { new: true }
      );

      if (order) {
        emitOrderUpdated(order, {
          message: "الفني في الطريق",
        });

        console.log(`🚗 Order ${id} on the way`);
        return;
      }

      const accident = await Accident.findOneAndUpdate(
        {
          _id: id,
          status: { $in: ["accepted", "assigned", "pending"] },
        },
        {
          $set: {
            status: "on_the_way",
            startedAt: new Date(),
          },
        },
        { new: true }
      );

      if (!accident) return;

      emitAccidentUpdated(accident, {
        message: "الفني في الطريق إلى موقع الحادث",
      });

      console.log(`🚨 Accident ${id} on the way`);
    } catch (error) {
      console.error("❌ order:on_the_way:", error?.message || error);
    }
  });

  socket.on("order:accept", async ({ orderId, accidentId, technicianId } = {}) => {
    const id = orderId || accidentId;
    if (!isValidObjectId(id) || !isAnyId(technicianId)) return;

    try {
      const updated = await Order.findOneAndUpdate(
        {
          _id: id,
          status: { $in: ["pending", "searching", "contacting", "assigned"] },
        },
        {
          $set: {
            status: "assigned",
            acceptedAt: new Date(),
            ...(isValidObjectId(technicianId)
              ? { "technician.techId": String(technicianId) }
              : { "technician.techName": String(technicianId) }),
          },
        },
        { new: true }
      );

      if (updated) {
        clearOrderTimeout(id);

        const order = normalizeDoc(updated);

        socket.emit("order:accepted", order);
        emitOrderUpdated(order, {
          message: "تم العثور على فني",
        });

        console.log(`✅ Order assigned: ${id} by tech ${technicianId}`);
        return;
      }

      const accident = await Accident.findOneAndUpdate(
        {
          _id: id,
          status: { $in: ["pending", "searching", "contacting", "assigned"] },
        },
        {
          $set: {
            status: "assigned",
            assignedAt: new Date(),
            ...(isValidObjectId(technicianId)
              ? { assignedTechnician: String(technicianId) }
              : { assignedTechnicianName: String(technicianId) }),
          },
        },
        { new: true }
      );

      if (!accident) {
        socket.emit("order:accept:failed", {
          orderId: id,
          reason: "Order/accident already taken / not pending",
        });
        return;
      }

      const accidentOrderLike = accidentToOrderLike(accident);

      socket.emit("order:accepted", accidentOrderLike);
      emitAccidentUpdated(accident, {
        message: "تم تعيين فني لبلاغ الحادث",
      });

      console.log(`✅ Accident assigned: ${id} by tech ${technicianId}`);
    } catch (error) {
      console.error("❌ order:accept:", error?.message || error);

      socket.emit("order:accept:failed", {
        orderId: id,
        reason: "Server error",
      });
    }
  });

  socket.on("order:arrived", async ({ orderId, accidentId, technicianId } = {}) => {
    const id = orderId || accidentId;
    if (!isValidObjectId(id)) return;

    try {
      const order = await Order.findOneAndUpdate(
        {
          _id: id,
          status: { $nin: ["completed", "cancelled", "canceled"] },
        },
        {
          $set: {
            status: "arrived",
            arrivedAt: new Date(),
          },
        },
        { new: true }
      );

      if (order) {
        emitOrderUpdated(order, { message: "الفني وصل" });
        return;
      }

      const accident = await Accident.findOneAndUpdate(
        {
          _id: id,
          status: { $nin: ["completed", "cancelled", "canceled"] },
        },
        {
          $set: {
            status: "arrived",
            arrivedAt: new Date(),
          },
        },
        { new: true }
      );

      if (accident) {
        emitAccidentUpdated(accident, { message: "الفني وصل لموقع الحادث" });
      }
    } catch (error) {
      console.error("❌ order:arrived:", error?.message || error);
    }
  });

  socket.on("order:complete", async ({ orderId, accidentId } = {}) => {
    const id = orderId || accidentId;
    if (!isValidObjectId(id)) return;

    try {
      const order = await Order.findOneAndUpdate(
        {
          _id: id,
          status: { $nin: ["completed", "cancelled", "canceled"] },
        },
        {
          $set: {
            status: "completed",
            completedAt: new Date(),
          },
        },
        { new: true }
      );

      if (order) {
        clearOrderTimeout(id);
        emitOrderUpdated(order, { message: "تم إكمال الطلب" });
        return;
      }

      const accident = await Accident.findOneAndUpdate(
        {
          _id: id,
          status: { $nin: ["completed", "cancelled", "canceled"] },
        },
        {
          $set: {
            status: "completed",
            completedAt: new Date(),
          },
        },
        { new: true }
      );

      if (accident) {
        emitAccidentUpdated(accident, { message: "تم إنهاء بلاغ الحادث" });
      }
    } catch (error) {
      console.error("❌ order:complete:", error?.message || error);
    }
  });

  socket.on("order:cancel", async ({ orderId, accidentId, userId, reason } = {}) => {
    const id = orderId || accidentId;
    if (!isValidObjectId(id)) return;

    try {
      const order = await Order.findOneAndUpdate(
        {
          _id: id,
          status: { $nin: ["completed", "cancelled", "canceled"] },
        },
        {
          $set: {
            status: "canceled",
            cancelledAt: new Date(),
            cancelReason: reason || "Cancelled",
          },
        },
        { new: true }
      );

      if (order) {
        clearOrderTimeout(id);

        const payloadOut = {
          orderId: String(id),
          status: "canceled",
          message: "تم إلغاء الطلب",
          at: Date.now(),
        };

        emitToOrder(id, "orderStatusUpdated", payloadOut);
        emitToOrder(id, "order:canceled", payloadOut);
        emitToOrder(id, "order:cancelled", payloadOut);

        io.to("centers").emit("order:updated", normalizeDoc(order));

        const uid = userId || getOrderUserId(order);

        if (uid) {
          io.to(`user:${String(uid)}`).emit("order:canceled", payloadOut);
          io.to(`user:${String(uid)}`).emit("order:cancelled", payloadOut);
          io.to(`user:${String(uid)}`).emit("orderStatusUpdated", payloadOut);
        }

        console.log(`🛑 Order canceled: ${id}`);
        return;
      }

      const accident = await Accident.findOneAndUpdate(
        {
          _id: id,
          status: { $nin: ["completed", "cancelled", "canceled"] },
        },
        {
          $set: {
            status: "canceled",
            cancelledAt: new Date(),
            cancelReason: reason || "Cancelled",
          },
        },
        { new: true }
      );

      if (accident) {
        emitAccidentUpdated(accident, { message: "تم إلغاء بلاغ الحادث" });
        console.log(`🛑 Accident canceled: ${id}`);
      }
    } catch (error) {
      console.error("❌ order:cancel:", error?.message || error);
    }
  });

  socket.on("order:reject", ({ orderId, technicianId } = {}) => {
    if (!isAnyId(orderId) || !isAnyId(technicianId)) return;
    console.log(`❌ Order rejected: ${orderId} by tech ${technicianId}`);
  });

  socket.on("disconnect", (reason) => {
    for (const [techId, socketId] of onlineTechnicians.entries()) {
      if (socketId === socket.id) {
        onlineTechnicians.delete(techId);
        console.log(`🛑 technician offline: ${techId}`);
        break;
      }
    }

    for (const [centerId, socketId] of onlineCenters.entries()) {
      if (socketId === socket.id) {
        onlineCenters.delete(centerId);
        console.log(`🏢 center offline: ${centerId}`);
        break;
      }
    }

    console.log("🔴 Socket disconnected:", socket.id, "| reason:", reason);
  });
});

app.post("/api/orders/:id/start-timeout", async (req, res) => {
  try {
    const orderId = String(req.params.id);

    if (!isValidObjectId(orderId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order id",
      });
    }

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    const userId = getOrderUserId(order);
    scheduleOrderTimeout(orderId, userId);

    res.json({
      success: true,
      orderId,
      timeoutSec: ORDER_TIMEOUT_SEC,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error?.message || "Server error",
    });
  }
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

app.use((err, req, res, next) => {
  console.error("🔥 Unhandled error:", err);

  res.status(err?.status || err?.statusCode || 500).json({
    success: false,
    message: err?.message || "Server error",
  });
});

function getAllLocalIPv4() {
  const interfaces = os.networkInterfaces();
  const ips = [];

  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === "IPv4" && !iface.internal) {
        ips.push({
          name,
          address: iface.address,
          netmask: iface.netmask,
        });
      }
    }
  }

  return ips;
}

function getBestLocalIP() {
  const all = getAllLocalIPv4();

  const wifiLike = all.find(
    (i) =>
      /wi-?fi|wireless|wlan/i.test(i.name) ||
      i.address.startsWith("192.168.") ||
      i.address.startsWith("10.")
  );

  if (wifiLike) return wifiLike.address;

  const nonHyperV = all.find(
    (i) => !/vEthernet|Hyper-V|VMware|VirtualBox|Default Switch/i.test(i.name)
  );

  if (nonHyperV) return nonHyperV.address;

  return all[0]?.address || "localhost";
}

async function startServer() {
  server.on("error", (err) => {
    if (err?.code === "EADDRINUSE") {
      console.error(`❌ Port ${PORT} is already in use.`);
      process.exit(1);
    }

    console.error("❌ Server error:", err?.message || err);
    process.exit(1);
  });

  try {
    await connectDB();
    console.log("✅ MongoDB connected");
  } catch (error) {
    console.error("⚠️ DB connect failed:", error?.message || error);
    if (IS_PROD) process.exit(1);
  }

  if (mongoose.connection?.readyState === 1) {
    try {
      await Center.syncIndexes();
      console.log("✅ Center indexes synced");
    } catch (error) {
      console.warn("⚠️ Center index sync failed:", error?.message || error);
    }
  }

  server.listen(PORT, HOST, () => {
    const localIP = getBestLocalIP();

    console.log("====================================");
    console.log("🚀 Doctor Car Backend Running ✅");
    console.log(`🌍 Port: ${PORT}`);
    console.log(`🧷 Bound: http://${HOST}:${PORT}`);
    console.log(`📱 Network: http://${localIP}:${PORT}`);
    console.log(`❤️ Health: http://${localIP}:${PORT}/api/health`);
    console.log(`🔌 Socket: http://${localIP}:${PORT}${SOCKET_PATH}`);
    console.log(`⏱️ Order Timeout: ${ORDER_TIMEOUT_SEC}s`);
    console.log("====================================");
  });
}

startServer().catch((error) => {
  console.error("❌ Startup failed:", error?.message || error);
  if (IS_PROD) process.exit(1);
});

async function gracefulShutdown(signal) {
  console.log(`🧹 Graceful shutdown... (${signal})`);

  try {
    for (const timer of orderTimeoutTimers.values()) clearTimeout(timer);
    orderTimeoutTimers.clear();
  } catch {}

  try {
    io.close();
  } catch {}

  try {
    await mongoose.connection.close();
  } catch {}

  try {
    server.close(() => {
      console.log("✅ Server closed");
      process.exit(0);
    });
  } catch {
    process.exit(0);
  }
}

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
