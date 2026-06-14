import Wallet from "../models/walletModel.js";

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
