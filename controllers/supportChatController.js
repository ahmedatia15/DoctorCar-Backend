// PATH: backend/controllers/supportChatController.js
import SupportChat from "../models/supportChat.model.js";
import SupportMessage from "../models/supportMessage.model.js";

/**
 * GET /api/support/me
 * يرجع شات مفتوح/assigned للمستخدم أو ينشئ واحد جديد
 */
export const getOrCreateMyChat = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ message: "🚫 غير مصرح" });

    let chat = await SupportChat.findOne({
      user: userId,
      status: { $in: ["open", "assigned"] },
    }).sort({ updatedAt: -1 });

    if (!chat) {
      chat = await SupportChat.create({ user: userId });
    }

    return res.json(chat);
  } catch (e) {
    console.error("❌ getOrCreateMyChat:", e.message);
    return res.status(500).json({ message: "حدث خطأ في السيرفر" });
  }
};

/**
 * GET /api/support/:chatId/messages
 * يرجع رسائل الشات
 */
export const getMessages = async (req, res) => {
  try {
    const userId = req.user?._id;
    const { chatId } = req.params;

    const chat = await SupportChat.findById(chatId);
    if (!chat) return res.status(404).json({ message: "الشات غير موجود" });

    // تأكد إن المستخدم صاحب الشات
    if (String(chat.user) !== String(userId)) {
      return res.status(403).json({ message: "⛔ ليس لديك صلاحية" });
    }

    const messages = await SupportMessage.find({ chat: chatId })
      .sort({ createdAt: 1 })
      .limit(500);

    return res.json(messages);
  } catch (e) {
    console.error("❌ getMessages:", e.message);
    return res.status(500).json({ message: "حدث خطأ في السيرفر" });
  }
};

/**
 * POST /api/support/:chatId/messages
 * Body: { text }
 * إرسال رسالة
 */
export const sendMessage = async (req, res) => {
  try {
    const userId = req.user?._id;
    const { chatId } = req.params;
    const { text } = req.body;

    if (!text?.trim()) {
      return res.status(400).json({ message: "النص مطلوب" });
    }

    const chat = await SupportChat.findById(chatId);
    if (!chat) return res.status(404).json({ message: "الشات غير موجود" });

    if (String(chat.user) !== String(userId)) {
      return res.status(403).json({ message: "⛔ ليس لديك صلاحية" });
    }

    const msg = await SupportMessage.create({
      chat: chatId,
      senderType: "user",
      senderId: userId,
      text: text.trim(),
    });

    chat.lastMessageAt = new Date();
    await chat.save();

    return res.status(201).json(msg);
  } catch (e) {
    console.error("❌ sendMessage:", e.message);
    return res.status(500).json({ message: "حدث خطأ في السيرفر" });
  }
};
