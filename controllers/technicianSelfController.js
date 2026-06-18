// PATH: backend/controllers/technicianSelfController.js
//
// All endpoints scoped to the logged-in technician (req.user.role === "technician").
// Each route resolves and respects req.technician (Technician doc) and only
// touches Orders that already belong to this technician — never another's.
import mongoose from "mongoose";
import Order from "../models/orderModel.js";
import Technician from "../models/technicianModel.js";

const isValidId = (id) => id && mongoose.Types.ObjectId.isValid(String(id));

const orderOwnedByTech = (order, techId) => {
  if (!order || !techId) return false;
  const assigned =
    order.technician?.techId ||
    order.technician?.id ||
    order.technician?._id ||
    order.technician ||
    order.technicianId;
  return assigned && String(assigned) === String(techId);
};

const startOfRange = (range) => {
  const now = new Date();
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  if (range === "week") {
    const dayOfWeek = d.getDay();
    d.setDate(d.getDate() - dayOfWeek);
  } else if (range === "month") {
    d.setDate(1);
  }
  return d;
};

// =======================================================
// GET /api/technicians/me
// =======================================================
export const getMe = async (req, res) => {
  try {
    const tech = req.technician;
    res.json({
      success: true,
      technician: {
        _id: tech._id,
        name: tech.name,
        phone: tech.phone,
        serviceType: tech.serviceType,
        specialty: tech.specialty,
        governorate: tech.governorate,
        rating: tech.rating,
        isAvailable: tech.isAvailable,
        isOnline: tech.isOnline,
        completedJobs: tech.completedJobs || 0,
        earnings: tech.earnings || { total: 0, currency: "EGP" },
        location: tech.location,
        lastActiveAt: tech.lastActiveAt,
      },
      user: {
        _id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        phone: req.user.phone,
        governorate: req.user.governorate,
        specialty: req.user.specialty,
      },
    });
  } catch (err) {
    console.error("❌ getMe:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// =======================================================
// PATCH /api/technicians/me/profile
// =======================================================
export const updateProfile = async (req, res) => {
  try {
    const { name, governorate, specialty, serviceType } = req.body;
    const tech = req.technician;

    if (typeof name === "string" && name.trim()) tech.name = name.trim();
    if (typeof governorate === "string") tech.governorate = governorate.trim();
    if (typeof specialty === "string") tech.specialty = specialty.trim();
    if (
      typeof serviceType === "string" &&
      ["tow", "battery", "fuel", "tire", "ride"].includes(serviceType)
    ) {
      tech.serviceType = serviceType;
    }

    await tech.save();
    res.json({ success: true, technician: tech });
  } catch (err) {
    console.error("❌ updateProfile:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// =======================================================
// PATCH /api/technicians/me/availability
// =======================================================
export const updateAvailability = async (req, res) => {
  try {
    const tech = req.technician;
    const { isAvailable, isOnline } = req.body;

    if (typeof isAvailable === "boolean") tech.isAvailable = isAvailable;
    if (typeof isOnline === "boolean") tech.isOnline = isOnline;
    tech.lastActiveAt = new Date();

    await tech.save();
    res.json({
      success: true,
      isAvailable: tech.isAvailable,
      isOnline: tech.isOnline,
    });
  } catch (err) {
    console.error("❌ updateAvailability:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// =======================================================
// PATCH /api/technicians/me/location
// =======================================================
export const updateLocation = async (req, res) => {
  try {
    const tech = req.technician;
    const lat = Number(req.body.lat);
    const lng = Number(req.body.lng);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res
        .status(400)
        .json({ success: false, message: "lat/lng غير صحيحين" });
    }

    tech.location = { type: "Point", coordinates: [lng, lat] };
    tech.lastActiveAt = new Date();
    await tech.save();

    res.json({ success: true, location: tech.location });
  } catch (err) {
    console.error("❌ updateLocation:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// =======================================================
// GET /api/technicians/me/jobs?status=open
//   open  → active jobs assigned to this tech + nearby pending matching specialty
//   active → only jobs already assigned/accepted to this tech
// =======================================================
export const getMyJobs = async (req, res) => {
  try {
    const tech = req.technician;
    const mode = String(req.query.status || "open").toLowerCase();

    const techId = tech._id;

    const myActive = await Order.find({
      "technician.techId": techId,
      status: { $in: ["assigned", "accepted", "on_the_way", "arrived", "in_progress"] },
    })
      .populate("user", "name phone")
      .populate("vehicle", "brand model plateNumber")
      .sort({ createdAt: -1 })
      .limit(50);

    let pending = [];
    if (mode === "open") {
      pending = await Order.find({
        status: { $in: ["pending", "searching", "contacting"] },
        $or: [
          { "technician.techId": null },
          { "technician.techId": { $exists: false } },
          { technician: null },
        ],
        serviceType: { $regex: tech.serviceType, $options: "i" },
      })
        .populate("user", "name phone")
        .sort({ createdAt: -1 })
        .limit(20);
    }

    res.json({
      success: true,
      active: myActive,
      pending,
    });
  } catch (err) {
    console.error("❌ getMyJobs:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// =======================================================
// GET /api/technicians/me/jobs/:id
// =======================================================
export const getMyJobById = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: "id غير صالح" });
    }

    const order = await Order.findById(req.params.id)
      .populate("user", "name phone email")
      .populate("vehicle", "brand model plateNumber color year");

    if (!order) {
      return res.status(404).json({ success: false, message: "الطلب غير موجود" });
    }

    const owns = orderOwnedByTech(order, req.technician._id);
    const isOpenAndMatching =
      ["pending", "searching", "contacting"].includes(String(order.status)) &&
      String(order.serviceType || "")
        .toLowerCase()
        .includes(String(req.technician.serviceType).toLowerCase());

    if (!owns && !isOpenAndMatching) {
      return res
        .status(403)
        .json({ success: false, message: "غير مصرح بعرض هذا الطلب" });
    }

    res.json({ success: true, order });
  } catch (err) {
    console.error("❌ getMyJobById:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// Generic status-mutating helper used by accept/on-the-way/arrived/complete.
const transitionStatus = async ({
  req,
  res,
  fromStatuses,
  toStatus,
  extraSet = {},
  forceOwnership = false,
}) => {
  if (!isValidId(req.params.id)) {
    return res.status(400).json({ success: false, message: "id غير صالح" });
  }

  const techId = req.technician._id;
  const techName = req.technician.name;

  const existing = await Order.findById(req.params.id);
  if (!existing) {
    return res.status(404).json({ success: false, message: "الطلب غير موجود" });
  }

  if (forceOwnership && !orderOwnedByTech(existing, techId)) {
    return res
      .status(403)
      .json({ success: false, message: "هذا الطلب ليس لك" });
  }

  if (!fromStatuses.includes(String(existing.status))) {
    return res.status(409).json({
      success: false,
      message: `لا يمكن تنفيذ هذه الخطوة الآن (الحالة: ${existing.status})`,
    });
  }

  const update = {
    status: toStatus,
    ...extraSet,
  };

  if (toStatus === "accepted") {
    update["technician.techId"] = techId;
    update["technician.techName"] = techName;
    update["technician.phone"] = req.technician.phone || null;
    update.acceptedAt = new Date();
  }
  if (toStatus === "on_the_way") update.onTheWayAt = new Date();
  if (toStatus === "arrived") update.arrivedAt = new Date();
  if (toStatus === "completed") update.completedAt = new Date();

  const order = await Order.findByIdAndUpdate(
    req.params.id,
    { $set: update },
    { new: true }
  )
    .populate("user", "name phone")
    .populate("vehicle", "brand model plateNumber");

  if (toStatus === "completed") {
    const earned = Number(order.price || 0);
    await Technician.findByIdAndUpdate(techId, {
      $inc: { completedJobs: 1, "earnings.total": earned },
      $set: { isAvailable: true, currentOrder: null, lastActiveAt: new Date() },
    });
  }

  if (toStatus === "accepted") {
    await Technician.findByIdAndUpdate(techId, {
      $set: { isAvailable: false, currentOrder: order._id, lastActiveAt: new Date() },
    });
  }

  if (req.emitOrderUpdated) {
    try {
      req.emitOrderUpdated(order, { message: `الفني — ${toStatus}` });
    } catch (e) {
      console.warn("⚠️ emitOrderUpdated failed:", e?.message);
    }
  }

  return res.json({ success: true, order });
};

// =======================================================
// PUT /api/technicians/me/jobs/:id/accept
// =======================================================
export const acceptJob = (req, res) =>
  transitionStatus({
    req,
    res,
    fromStatuses: ["pending", "searching", "contacting", "assigned"],
    toStatus: "accepted",
    forceOwnership: false,
  });

// PUT /api/technicians/me/jobs/:id/on-the-way
export const markOnTheWay = (req, res) =>
  transitionStatus({
    req,
    res,
    fromStatuses: ["accepted", "assigned"],
    toStatus: "on_the_way",
    forceOwnership: true,
  });

// PUT /api/technicians/me/jobs/:id/arrived
export const markArrived = (req, res) =>
  transitionStatus({
    req,
    res,
    fromStatuses: ["accepted", "assigned", "on_the_way", "in_progress"],
    toStatus: "arrived",
    forceOwnership: true,
  });

// PUT /api/technicians/me/jobs/:id/complete
export const completeJob = (req, res) =>
  transitionStatus({
    req,
    res,
    fromStatuses: ["arrived", "on_the_way", "in_progress", "accepted"],
    toStatus: "completed",
    forceOwnership: true,
  });

// =======================================================
// GET /api/technicians/me/history?status=&range=
// =======================================================
export const getMyHistory = async (req, res) => {
  try {
    const techId = req.technician._id;
    const statusFilter = String(req.query.status || "all").toLowerCase();
    const limit = Math.min(Number(req.query.limit) || 50, 100);

    const baseQuery = { "technician.techId": techId };

    if (statusFilter === "completed") {
      baseQuery.status = "completed";
    } else if (statusFilter === "cancelled") {
      baseQuery.status = { $in: ["cancelled", "canceled"] };
    } else {
      baseQuery.status = {
        $in: ["completed", "cancelled", "canceled", "failed", "timeout"],
      };
    }

    const orders = await Order.find(baseQuery)
      .populate("user", "name phone")
      .sort({ updatedAt: -1 })
      .limit(limit);

    res.json({ success: true, orders });
  } catch (err) {
    console.error("❌ getMyHistory:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// =======================================================
// GET /api/technicians/me/earnings?range=day|week|month
// =======================================================
export const getMyEarnings = async (req, res) => {
  try {
    const techId = req.technician._id;
    const range = String(req.query.range || "week").toLowerCase();
    const from = startOfRange(range);

    const completed = await Order.find({
      "technician.techId": techId,
      status: "completed",
      completedAt: { $gte: from },
    }).select("price completedAt serviceName serviceType");

    const total = completed.reduce((s, o) => s + (Number(o.price) || 0), 0);

    const buckets = {};
    for (const o of completed) {
      if (!o.completedAt) continue;
      const d = new Date(o.completedAt);
      const key =
        range === "day"
          ? `${d.getHours()}`
          : `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
      buckets[key] = (buckets[key] || 0) + (Number(o.price) || 0);
    }

    const lifetimeTotal = Number(req.technician.earnings?.total || 0);
    const lifetimeJobs = Number(req.technician.completedJobs || 0);

    res.json({
      success: true,
      range,
      from,
      total,
      currency: req.technician.earnings?.currency || "EGP",
      count: completed.length,
      buckets,
      orders: completed,
      lifetime: {
        total: lifetimeTotal,
        jobs: lifetimeJobs,
        currency: req.technician.earnings?.currency || "EGP",
      },
    });
  } catch (err) {
    console.error("❌ getMyEarnings:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};
