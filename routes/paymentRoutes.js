import express from "express";
import mongoose from "mongoose";
import Order from "../models/orderModel.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// 💰 إنشاء فاتورة ودفع
// ⚠️ Protected: caller must be authenticated, must own the order, and the order
// must not already be completed/canceled. The amount is NEVER taken from the
// client body — hook real gateway verification (Paymob callback / signature)
// here before flipping status.
router.post("/pay", protect, async (req, res) => {
  try {
    const { orderId, method } = req.body;

    if (!orderId || !mongoose.Types.ObjectId.isValid(String(orderId))) {
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

    // Ownership: only the customer who placed the order can pay for it.
    const orderUserId = String(
      order.user || order.customer || order.customerId || ""
    );
    if (
      orderUserId &&
      orderUserId !== String(req.user._id) &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({
        success: false,
        message: "غير مصرح بالدفع لهذا الطلب",
      });
    }

    // Don't re-complete a finished or cancelled order.
    if (["completed", "canceled", "cancelled"].includes(String(order.status))) {
      return res.status(409).json({
        success: false,
        message: "لا يمكن دفع طلب مكتمل أو ملغي",
        order,
      });
    }

    order.status = "completed";
    order.paidAt = new Date();
    if (method) order.paymentMethod = String(method);
    await order.save();

    return res.json({
      success: true,
      message: "تم الدفع بنجاح ✅",
      order,
    });
  } catch (error) {
    console.error("❌ payment /pay:", error?.message || error);
    return res.status(500).json({ success: false, message: "فشل الدفع" });
  }
});

export default router;
