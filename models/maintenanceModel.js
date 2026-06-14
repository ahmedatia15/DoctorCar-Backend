import mongoose from "mongoose";

const maintenanceSchema = new mongoose.Schema(
  {
    vehicle: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vehicle",
      required: true,
    },

    type: { type: String, required: true },
    km: { type: Number, required: true },
    cost: { type: Number, default: 0 },
    notes: { type: String },
    date: { type: Date, required: true },
  },
  { timestamps: true }
);

const Maintenance =
  mongoose.models.Maintenance ||
  mongoose.model("Maintenance", maintenanceSchema);

export default Maintenance;
