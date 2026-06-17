// PATH: backend/controllers/cartController.js
import Cart from "../models/cartModel.js";
import Product from "../models/productModel.js";

const getOrCreate = async (userId) => {
  let cart = await Cart.findOne({ user: userId });
  if (!cart) cart = await Cart.create({ user: userId, items: [] });
  return cart;
};

const shape = (cart) => {
  const items = cart.items.map((it) => ({
    productId: it.product,
    name: it.name,
    price: it.price,
    image: it.image,
    qty: it.qty,
    lineTotal: it.price * it.qty,
  }));
  const total = items.reduce((s, it) => s + it.lineTotal, 0);
  const count = items.reduce((s, it) => s + it.qty, 0);
  return { items, total, count };
};

// GET /api/cart
export const getCart = async (req, res) => {
  try {
    const cart = await getOrCreate(req.user._id);
    return res.json({ success: true, cart: shape(cart) });
  } catch (err) {
    console.error("❌ getCart:", err);
    return res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
};

// POST /api/cart/add   { productId, qty? }
export const addItem = async (req, res) => {
  try {
    const productId = String(req.body.productId || "").trim();
    const qty = Math.max(1, Number(req.body.qty) || 1);

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: "المنتج غير موجود" });
    }

    const cart = await getOrCreate(req.user._id);
    const existing = cart.items.find(
      (it) => it.product.toString() === productId
    );
    if (existing) {
      existing.qty += qty;
    } else {
      cart.items.push({
        product: product._id,
        name: product.name,
        price: product.price,
        image: product.image,
        qty,
      });
    }
    await cart.save();
    return res.json({ success: true, cart: shape(cart) });
  } catch (err) {
    console.error("❌ addItem:", err);
    return res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
};

// PATCH /api/cart/item   { productId, qty }
export const setQty = async (req, res) => {
  try {
    const productId = String(req.body.productId || "").trim();
    const qty = Number(req.body.qty);

    const cart = await getOrCreate(req.user._id);
    if (qty <= 0) {
      cart.items = cart.items.filter(
        (it) => it.product.toString() !== productId
      );
    } else {
      const item = cart.items.find((it) => it.product.toString() === productId);
      if (item) item.qty = qty;
    }
    await cart.save();
    return res.json({ success: true, cart: shape(cart) });
  } catch (err) {
    console.error("❌ setQty:", err);
    return res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
};

// DELETE /api/cart/item/:productId
export const removeItem = async (req, res) => {
  try {
    const productId = String(req.params.productId || "").trim();
    const cart = await getOrCreate(req.user._id);
    cart.items = cart.items.filter((it) => it.product.toString() !== productId);
    await cart.save();
    return res.json({ success: true, cart: shape(cart) });
  } catch (err) {
    console.error("❌ removeItem:", err);
    return res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
};

// DELETE /api/cart
export const clearCart = async (req, res) => {
  try {
    const cart = await getOrCreate(req.user._id);
    cart.items = [];
    await cart.save();
    return res.json({ success: true, cart: shape(cart) });
  } catch (err) {
    console.error("❌ clearCart:", err);
    return res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
};
