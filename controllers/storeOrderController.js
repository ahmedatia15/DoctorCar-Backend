// PATH: backend/controllers/storeOrderController.js
import StoreOrder from "../models/storeOrderModel.js";
import { createNotification } from "../utils/notify.js";

// POST /api/store-orders   { items, total, address?, paymentMethod?, notes? }
export const createStoreOrder = async (req, res) => {
  try {
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    const total = Number(req.body.total);

    if (!Number.isFinite(total) || total < 0) {
      return res
        .status(400)
        .json({ success: false, message: "إجمالي غير صالح" });
    }

    const cleanItems = items.map((it) => ({
      name: String(it.name || "").trim(),
      qty: Number(it.qty) > 0 ? Number(it.qty) : 1,
      price: Number(it.price) || 0,
      image: String(it.image || ""),
    }));

    const itemCount = cleanItems.reduce((sum, it) => sum + it.qty, 0);

    const order = await StoreOrder.create({
      user: req.user._id,
      items: cleanItems,
      itemCount,
      total,
      address: String(req.body.address || "").trim(),
      paymentMethod: String(req.body.paymentMethod || "cash").trim(),
      notes: String(req.body.notes || "").trim(),
      status: "pending",
    });

    await createNotification(req.user._id, {
      type: "order",
      title: "تم استلام طلبك من المتجر",
      body: `طلب بقيمة ${total} ج.م قيد المراجعة.`,
      data: { storeOrderId: order._id },
    });

    return res.status(201).json({ success: true, order });
  } catch (err) {
    console.error("❌ createStoreOrder:", err);
    return res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
};

// GET /api/store-orders/my
export const getMyStoreOrders = async (req, res) => {
  try {
    const orders = await StoreOrder.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    return res.json({ success: true, orders });
  } catch (err) {
    console.error("❌ getMyStoreOrders:", err);
    return res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
};
