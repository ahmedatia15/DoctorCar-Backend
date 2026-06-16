// PATH: backend/controllers/appointmentController.js
import Appointment from "../models/appointmentModel.js";
import { createNotification } from "../utils/notify.js";

// POST /api/appointments   { service, center, date, notes? }
export const createAppointment = async (req, res) => {
  try {
    const { service, center, date, notes } = req.body;

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
