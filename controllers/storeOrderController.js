// PATH: backend/controllers/storeOrderController.js
import StoreOrder from "../models/storeOrderModel.js";
import Cart from "../models/cartModel.js";
import { createNotification } from "../utils/notify.js";

// POST /api/store-orders
//   { fromCart: true, address?, paymentMethod?, notes? }            (preferred)
//   { items, total, address?, paymentMethod?, notes? }              (manual)
export const createStoreOrder = async (req, res) => {
  try {
    let cleanItems = [];
    let total;

    if (req.body.fromCart) {
      // Build the order from the user's server-side cart.
      const cart = await Cart.findOne({ user: req.user._id });
      if (!cart || cart.items.length === 0) {
        return res
          .status(400)
          .json({ success: false, message: "السلة فارغة" });
      }
      cleanItems = cart.items.map((it) => ({
        name: it.name,
        qty: it.qty,
        price: it.price,
        image: it.image,
      }));
      total = cleanItems.reduce((s, it) => s + it.price * it.qty, 0);
    } else {
      const items = Array.isArray(req.body.items) ? req.body.items : [];
      total = Number(req.body.total);
      if (!Number.isFinite(total) || total < 0) {
        return res
          .status(400)
          .json({ success: false, message: "إجمالي غير صالح" });
      }
      cleanItems = items.map((it) => ({
        name: String(it.name || "").trim(),
        qty: Number(it.qty) > 0 ? Number(it.qty) : 1,
        price: Number(it.price) || 0,
        image: String(it.image || ""),
      }));
    }

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

    // Empty the cart after a successful checkout.
    if (req.body.fromCart) {
      await Cart.updateOne({ user: req.user._id }, { $set: { items: [] } });
    }

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
