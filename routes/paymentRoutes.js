import express from "express";
import Order from "../models/orderModel.js";
const router = express.Router();

// 💰 إنشاء فاتورة ودفع
router.post("/pay", async (req, res) => {
  try {
    const { orderId, amount, method } = req.body;

    const order = await Order.findByIdAndUpdate(
      orderId,
      { cost: amount, status: "completed" },
      { new: true }
    );

    res.json({
      success: true,
      message: "تم الدفع بنجاح ✅",
      order,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "فشل الدفع" });
  }
});

export default router;
