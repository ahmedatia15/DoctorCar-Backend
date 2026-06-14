// PATH: backend/utils/orderTimeout.js
import Order from "../models/orderModel.js";
import { io } from "../server.js";

// orderId -> timeoutTimer
const orderTimeoutTimers = new Map();

export function clearOrderTimeout(orderId) {
  const key = String(orderId);
  const t = orderTimeoutTimers.get(key);
  if (t) clearTimeout(t);
  orderTimeoutTimers.delete(key);
}

export function scheduleOrderTimeout(orderId, userId, timeoutSec = 60) {
  try {
    clearOrderTimeout(orderId);

    const t = setTimeout(async () => {
      try {
        const order = await Order.findById(orderId);
        if (!order) return;

        const st = String(order.status || "");
        // لو اتعيّن خلاص/اتقبل/اتنفذ.. خلاص
        if (
          st === "assigned" ||
          st === "accepted" ||
          st === "in_progress" ||
          st === "arrived" ||
          st === "completed"
        ) {
          return;
        }

        order.status = "timeout";
        await order.save();

        const payload = {
          orderId: String(orderId),
          status: "timeout",
          message: "لم يتم العثور على فني الآن",
        };

        // ابعت للروم + للمستخدم
        io.to(String(orderId)).emit("orderStatusUpdated", payload);
        if (userId) {
          io.to(`user:${String(userId)}`).emit("orderStatusUpdated", payload);
          io.to(`user:${String(userId)}`).emit("order:timeout", payload);
        }

        console.log(`⏱️ Order timeout: ${orderId}`);
      } catch (e) {
        console.error("❌ timeout handler:", e?.message || e);
      } finally {
        clearOrderTimeout(orderId);
      }
    }, Number(timeoutSec) * 1000);

    orderTimeoutTimers.set(String(orderId), t);
  } catch (e) {
    console.error("❌ scheduleOrderTimeout:", e?.message || e);
  }
}
