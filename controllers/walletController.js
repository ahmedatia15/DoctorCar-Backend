import Wallet from "../models/walletModel.js";
import User from "../models/userModel.js";
import { createNotification } from "../utils/notify.js";

// 💳 شحن الرصيد — يحدّث رصيد المستخدم بشكل ذرّي ويعيد الرصيد الجديد
// POST /api/wallet/recharge   { amount }
export const rechargeBalance = async (req, res) => {
  try {
    const amount = Number(req.body.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ success: false, message: "مبلغ غير صالح" });
    }
    if (amount > 100000) {
      return res
        .status(400)
        .json({ success: false, message: "الحد الأقصى للشحن 100000" });
    }

    // ✅ Atomic increment on the user record (source of truth).
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $inc: { balance: amount } },
      { new: true }
    ).select("balance name");

    if (!user) {
      return res.status(404).json({ success: false, message: "المستخدم غير موجود" });
    }

    // Best-effort: keep a transaction trail in the wallet collection too.
    try {
      let wallet = await Wallet.findOne({ user: req.user._id });
      if (!wallet) {
        wallet = await Wallet.create({
          user: req.user._id,
          balance: user.balance,
          transactions: [],
        });
      }
      wallet.balance = user.balance;
      wallet.transactions.push({
        type: "credit",
        amount,
        description: "شحن رصيد",
      });
      await wallet.save();
    } catch (_) {}

    await createNotification(user._id, {
      type: "wallet",
      title: "تم شحن الرصيد بنجاح",
      body: `تمت إضافة ${amount} ج.م إلى رصيدك. الرصيد الحالي ${user.balance} ج.م.`,
      data: { amount, balance: user.balance },
    });

    return res.json({
      success: true,
      message: "تم شحن الرصيد بنجاح",
      added: amount,
      balance: user.balance,
    });
  } catch (err) {
    console.error("❌ rechargeBalance:", err);
    return res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
};

// 🔹 جلب المحفظة الخاصة بالمستخدم
export const getWallet = async (req, res) => {
  try {
    const wallet = await Wallet.findOne({ user: req.user._id });
    if (!wallet) {
      return res.status(404).json({ message: "المحفظة غير موجودة" });
    }
    res.json(wallet);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 🔹 إضافة رصيد للمحفظة
export const addFunds = async (req, res) => {
  try {
    const { amount } = req.body;
    if (!amount || amount <= 0) {
      return res.status(400).json({ message: "مبلغ غير صالح" });
    }

    let wallet = await Wallet.findOne({ user: req.user._id });
    if (!wallet) {
      wallet = await Wallet.create({
        user: req.user._id,
        balance: 0,
        transactions: [],
      });
    }

    wallet.balance += amount;
    wallet.transactions.push({
      type: "credit",
      amount,
      description: "إضافة رصيد يدوي",
    });

    await wallet.save();
    res.json({ message: "تمت إضافة الرصيد بنجاح", wallet });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 🔹 سحب رصيد (الفني فقط)
export const withdrawFunds = async (req, res) => {
  try {
    const { amount } = req.body;
    if (!amount || amount <= 0) {
      return res.status(400).json({ message: "مبلغ غير صالح" });
    }

    const wallet = await Wallet.findOne({ user: req.user._id });
    if (!wallet) {
      return res.status(404).json({ message: "المحفظة غير موجودة" });
    }

    if (wallet.balance < amount) {
      return res.status(400).json({ message: "رصيد غير كافٍ" });
    }

    wallet.balance -= amount;
    wallet.transactions.push({
      type: "debit",
      amount,
      description: "سحب رصيد",
    });

    await wallet.save();
    res.json({ message: "تم السحب بنجاح", wallet });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
