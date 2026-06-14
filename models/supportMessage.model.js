// PATH: backend/models/supportMessage.model.js
import mongoose from "mongoose";

const supportMessageSchema = new mongoose.Schema(
  {
    chat: { type: mongoose.Schema.Types.ObjectId, ref: "SupportChat", required: true, index: true },

    senderType: { type: String, enum: ["user", "technician", "system"], required: true },
    senderId: { type: mongoose.Schema.Types.ObjectId, required: false },

    text: { type: String, required: true, trim: true },

    readByUserAt: { type: Date, default: null },
    readByTechnicianAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export default mongoose.model("SupportMessage", supportMessageSchema);
