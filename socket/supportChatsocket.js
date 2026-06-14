import SupportChat from "../models/supportChat.model.js";
import SupportMessage from "../models/supportMessage.model.js";

/**
 * ===============================
 * 💬 Support Chat Socket
 * ===============================
 * - User ↔ Technician
 * - Real-time
 * - Safe (no io.on inside)
 * - Compatible with Flutter
 */
export function attachSupportChatSocket(io, socket) {
  if (!io || !socket) return;

  console.log("💬 Support chat attached to socket:", socket.id);

  // =====================================================
  // 🚪 Join chat room
  // =====================================================
  socket.on("joinSupportChat", async ({ chatId }) => {
    if (!chatId) return;

    socket.join(chatId);
    socket.emit("supportChat:joined", { chatId });

    console.log(`🔗 ${socket.id} joined chat ${chatId}`);
  });

  // =====================================================
  // 💬 Send message
  // =====================================================
  socket.on("supportMessage:send", async (payload) => {
    try {
      if (!payload) return;

      const {
        chatId,
        text,
        senderType, // user | technician
        senderId,
        clientTempId,
      } = payload;

      if (!chatId || !text || !senderType) return;

      const chat = await SupportChat.findById(chatId);
      if (!chat) {
        console.warn("⚠️ Chat not found:", chatId);
        return;
      }

      const message = await SupportMessage.create({
        chat: chatId,
        senderType,
        senderId: senderId || null,
        text: text.trim(),
      });

      chat.lastMessageAt = new Date();
      await chat.save();

      // 📢 Broadcast to room
      io.to(chatId).emit("supportMessage:new", message);

      // ✅ ACK (for optimistic UI)
      socket.emit("supportMessage:ack", {
        chatId,
        clientTempId,
        serverId: message._id,
        createdAt: message.createdAt,
      });
    } catch (error) {
      console.error("❌ supportMessage:send error:", error.message);
      socket.emit("supportMessage:error", {
        message: "Failed to send message",
      });
    }
  });

  // =====================================================
  // ✍️ Typing indicator
  // =====================================================
  socket.on("supportChat:typing", ({ chatId, typing, senderType }) => {
    if (!chatId) return;

    socket.to(chatId).emit("supportChat:typing", {
      chatId,
      typing: Boolean(typing),
      senderType,
    });
  });

  // =====================================================
  // 👀 Read receipt
  // =====================================================
  socket.on("supportChat:read", async ({ chatId, readerType }) => {
    if (!chatId || !readerType) return;

    const now = new Date();

    try {
      if (readerType === "user") {
        await SupportMessage.updateMany(
          { chat: chatId, readByUserAt: null },
          { $set: { readByUserAt: now } }
        );
      }

      if (readerType === "technician") {
        await SupportMessage.updateMany(
          { chat: chatId, readByTechnicianAt: null },
          { $set: { readByTechnicianAt: now } }
        );
      }

      socket.to(chatId).emit("supportChat:read", {
        chatId,
        readerType,
        at: now,
      });
    } catch (error) {
      console.error("❌ supportChat:read error:", error.message);
    }
  });

  // =====================================================
  // 🔴 Disconnect
  // =====================================================
  socket.on("disconnect", () => {
    console.log("🔴 Support chat socket disconnected:", socket.id);
  });
}
