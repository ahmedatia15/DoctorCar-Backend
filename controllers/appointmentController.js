// PATH: backend/controllers/appointmentController.js
import Appointment from "../models/appointmentModel.js";
import { createNotification } from "../utils/notify.js";

// POST /api/appointments   { service, center, date, notes? }
export const createAppointment = async (req, res) => {
  try {
    const { service, center, date, vehicle, notes } = req.body;

    if (!service || !center || !date) {
      return res.status(400).json({
        success: false,
        message: "الخدمة والمركز والموعد مطلوبة",
      });
    }

    const when = new Date(date);
    if (isNaN(when.getTime())) {
      return res
        .status(400)
        .json({ success: false, message: "تاريخ غير صالح" });
    }

    const appointment = await Appointment.create({
      user: req.user._id,
      service: String(service).trim(),
      center: String(center).trim(),
      vehicle: (vehicle || "").trim(),
      date: when,
      notes: (notes || "").trim(),
      status: "scheduled",
    });

    await createNotification(req.user._id, {
      type: "order",
      title: "تم حجز موعد صيانة",
      body: `${service} في ${center} بتاريخ ${when.toLocaleString("ar-EG")}.`,
      data: { appointmentId: appointment._id },
    });

    return res.status(201).json({ success: true, appointment });
  } catch (err) {
    console.error("❌ createAppointment:", err);
    return res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
};

// GET /api/appointments/my  -> the user's appointments (also shown in Orders)
export const getMyAppointments = async (req, res) => {
  try {
    const items = await Appointment.find({ user: req.user._id })
      .sort({ date: -1 })
      .lean();
    return res.json({ success: true, appointments: items });
  } catch (err) {
    console.error("❌ getMyAppointments:", err);
    return res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
};

// GET /api/appointments/center?center=NAME&limit=N
// Used by the center dashboard to show all incoming maintenance bookings.
// Optionally filtered by center name; returns the customer's display name.
export const getCenterAppointments = async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const filter = {};
    const centerName = String(req.query.center || "").trim();
    if (centerName) filter.center = centerName;

    const items = await Appointment.find(filter)
      .sort({ date: -1 })
      .limit(limit)
      .populate("user", "name phone")
      .lean();

    const shaped = items.map((a) => ({
      id: a._id,
      service: a.service,
      center: a.center,
      vehicle: a.vehicle,
      date: a.date,
      status: a.status,
      notes: a.notes,
      userName: a.user?.name || "",
      userPhone: a.user?.phone || "",
      createdAt: a.createdAt,
    }));

    return res.json({ success: true, appointments: shaped });
  } catch (err) {
    console.error("❌ getCenterAppointments:", err);
    return res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
};

// PATCH /api/appointments/:id/cancel
export const cancelAppointment = async (req, res) => {
  try {
    const updated = await Appointment.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { status: "cancelled" },
      { new: true }
    );
    if (!updated) {
      return res.status(404).json({ success: false, message: "غير موجود" });
    }
    return res.json({ success: true, appointment: updated });
  } catch (err) {
    console.error("❌ cancelAppointment:", err);
    return res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
};
