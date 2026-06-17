// PATH: backend/models/storeOrderModel.js
// Marketplace (store) orders placed from the parts store, persisted per-user.
import mongoose from "mongoose";

const itemSchema = new mongoose.Schema(
  {
    name: { type: String, default: "", trim: true },
    qty: { type: Number, default: 1, min: 1 },
    price: { type: Number, default: 0, min: 0 },
    image: { type: String, default: "" },
  },
  { _id: false }
);

const storeOrderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    items: { type: [itemSchema], default: [] },
    itemCount: { type: Number, default: 0 },
    total: { type: Number, default: 0, min: 0 },
    address: { type: String, default: "", trim: true },
    paymentMethod: { type: String, default: "cash", trim: true },
    notes: { type: String, default: "", trim: true },
    status: {
      type: String,
      enum: ["pending", "confirmed", "shipping", "delivered", "cancelled"],
      default: "pending",
    },
  },
  { timestamps: true }
);

storeOrderSchema.index({ user: 1, createdAt: -1 });

const StoreOrder =
  mongoose.models.StoreOrder ||
  mongoose.model("StoreOrder", storeOrderSchema);

export default StoreOrder;
