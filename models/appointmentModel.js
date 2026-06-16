// PATH: backend/models/appointmentModel.js
// In-center periodic-maintenance appointments booked by a user.
import mongoose from "mongoose";

const appointmentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    service: { type: String, required: true, trim: true },
    center: { type: String, required: true, trim: true },

    // Scheduled appointment date/time.
    date: { type: Date, required: true },

    status: {
      type: String,
      enum: ["scheduled", "completed", "cancelled"],
      default: "scheduled",
    },

    notes: { type: String, default: "", trim: true },
  },
  { timestamps: true }
);

appointmentSchema.index({ user: 1, date: -1 });

const Appointment =
  mongoose.models.Appointment ||
  mongoose.model("Appointment", appointmentSchema);

export default Appointment;
