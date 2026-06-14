import { io } from "socket.io-client";
import { API_URL } from "./config";

// ✅ مهم: منع duplicate connections
let socketInstance = null;

export function getSocket() {
  if (socketInstance) return socketInstance;

  socketInstance = io(API_URL, {
    path: "/socket.io",

    // 🚀 سرعة واستقرار
    transports: ["websocket"], // خليك websocket فقط (أسرع)
    upgrade: true,

    autoConnect: true,

    // 🔁 إعادة الاتصال الذكية
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,

    // 🧠 مهم جدًا للـ stability
    timeout: 20000,
    pingInterval: 25000,
    pingTimeout: 20000,

    withCredentials: true,
    forceNew: false,
  });

  // =========================
  // 🔥 LOGGING احترافي
  // =========================

  socketInstance.on("connect", () => {
    console.log("🟢 SOCKET CONNECTED:", socketInstance.id);
  });

  socketInstance.on("disconnect", (reason) => {
    console.log("🔴 SOCKET DISCONNECTED:", reason);
  });

  socketInstance.io.on("reconnect", (attempt) => {
    console.log("🔄 RECONNECTED after attempts:", attempt);
  });

  socketInstance.io.on("reconnect_attempt", (attempt) => {
    console.log("🔁 reconnect attempt:", attempt);
  });

  socketInstance.io.on("reconnect_error", (err) => {
    console.log("❌ reconnect error:", err.message);
  });

  socketInstance.io.on("reconnect_failed", () => {
    console.log("💀 reconnect failed completely");
  });

  return socketInstance;
}

// export مباشر (للتوافق مع الكود القديم)
export const socket = getSocket();