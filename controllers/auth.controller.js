import User from "../models/User.js";

/**
 * ============================
 * 🧑‍💻 Register Customer
 * ============================
 * email + password
 */
export const registerCustomer = async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "بيانات غير مكتملة" });
    }

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: "البريد الإلكتروني مستخدم بالفعل" });
    }

    const user = await User.create({
      name,
      email,
      password,
      phone,
      role: "customer",
    });

    res.status(201).json({
      user,
      token: user.generateToken(),
    });
  } catch (error) {
    console.error("Register Customer Error:", error);
    res.status(500).json({ message: "خطأ في السيرفر" });
  }
};

/**
 * ============================
 * 🔐 Login Customer
 * ============================
 * email + password
 */
export const loginCustomer = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "يرجى إدخال البريد وكلمة المرور" });
    }

    const user = await User.findOne({ email, role: "customer" }).select("+password");
    if (!user) {
      return res.status(401).json({ message: "بيانات غير صحيحة" });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: "بيانات غير صحيحة" });
    }

    user.lastLogin = new Date();
    await user.save();

    res.json({
      user,
      token: user.generateToken(),
    });
  } catch (error) {
    console.error("Login Customer Error:", error);
    res.status(500).json({ message: "خطأ في السيرفر" });
  }
};

/**
 * ============================
 * 🔧 Register Technician
 * ============================
 * phone + password
 */
export const registerTechnician = async (req, res) => {
  try {
    const { name, phone, password } = req.body;

    if (!name || !phone || !password) {
      return res.status(400).json({ message: "بيانات غير مكتملة" });
    }

    const techExists = await User.findOne({ phone });
    if (techExists) {
      return res.status(400).json({ message: "رقم الهاتف مستخدم بالفعل" });
    }

    const technician = await User.create({
      name,
      phone,
      password,
      role: "technician",
    });

    res.status(201).json({
      user: technician,
      token: technician.generateToken(),
    });
  } catch (error) {
    console.error("Register Technician Error:", error);
    res.status(500).json({ message: "خطأ في السيرفر" });
  }
};

/**
 * ============================
 * 🔐 Login Technician
 * ============================
 * phone + password
 */
export const loginTechnician = async (req, res) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res.status(400).json({ message: "يرجى إدخال رقم الهاتف وكلمة المرور" });
    }

    const technician = await User.findOne({
      phone,
      role: "technician",
    }).select("+password");

    if (!technician) {
      return res.status(401).json({ message: "بيانات غير صحيحة" });
    }

    const isMatch = await technician.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: "بيانات غير صحيحة" });
    }

    technician.lastLogin = new Date();
    await technician.save();

    res.json({
      user: technician,
      token: technician.generateToken(),
    });
  } catch (error) {
    console.error("Login Technician Error:", error);
    res.status(500).json({ message: "خطأ في السيرفر" });
  }
};
