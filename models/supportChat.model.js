// PATH: backend/models/supportChat.model.js
import mongoose from "mongoose";

const supportChatSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    technician: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Technician",
      default: null,
      index: true,
    },

    status: {
      type: String,
      enum: ["open", "assigned", "closed"],
      default: "open",
      index: true,
    },

    lastMessageAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  { timestamps: true }
);

// ✅ يمنع OverwriteModelError نهائيًا
export default mongoose.models.SupportChat ||
  mongoose.model("SupportChat", supportChatSchema);

