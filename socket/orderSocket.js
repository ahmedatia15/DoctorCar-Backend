import mongoose from "mongoose";
import Order from "../models/orderModel.js";
import SupportChat from "../models/supportChat.model.js";

const ARRIVAL_DISTANCE_METERS = Number(process.env.ARRIVAL_DISTANCE_METERS || 45);

const isValidId = (id) => id && mongoose.Types.ObjectId.isValid(String(id));

const toNumber = (v) => {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const getOrderUserId = (order) =>
  order?.user?._id || order?.user || order?.customer || order?.customerId || null;

const getOrderTechnicianId = (order) =>
  order?.technician?.id ||
  order?.technician?.techId ||
  order?.technician?._id ||
  order?.technician ||
  order?.technicianId ||
  null;

const normalizeTechnicianId = (technicianId) => {
  if (!technicianId) return null;
  if (typeof technicianId === "object") {
    return (
      technicianId._id ||
      technicianId.id ||
      technicianId.techId ||
      technicianId.technicianId ||
      null
    );
  }
  return technicianId;
};

const distanceMeters = (aLat, aLng, bLat, bLng) => {
  const R = 6371000;
  const p1 = (aLat * Math.PI) / 180;
  const p2 = (bLat * Math.PI) / 180;
  const dp = ((bLat - aLat) * Math.PI) / 180;
  const dl = ((bLng - aLng) * Math.PI) / 180;

  const x =
    Math.sin(dp / 2) ** 2 +
    Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
};

const normalizeLocationPayload = (data = {}) => {
  const location = data.location || {};
  const coords = data.coords || {};

  const orderId =
    data.orderId ||
    data.order_id ||
    data.requestId ||
    data.request_id ||
    data.bookingId ||
    data.booking_id ||
    "";

  const technicianId = normalizeTechnicianId(
    data.technicianId ||
      data.technician_id ||
      data.techId ||
      data.tech_id ||
      data.technician
  );

  const lat = toNumber(
    data.lat ??
      data.latitude ??
      location.lat ??
      location.latitude ??
      coords.lat ??
      coords.latitude
  );

  const lng = toNumber(
    data.lng ??
      data.longitude ??
      location.lng ??
      location.longitude ??
      coords.lng ??
      coords.longitude
  );

  const bearing = toNumber(
    data.bearing ?? data.heading ?? location.bearing ?? location.heading
  );

  const speed = toNumber(data.speed ?? location.speed);

  return {
    orderId: String(orderId || "").trim(),
    technicianId: technicianId ? String(technicianId).trim() : "",
    lat,
    lng,
    bearing,
    speed,
  };
};

export function attachOrderSocket(io) {
  io.on("connection", (socket) => {
    console.log("🟣 Order socket connected:", socket.id);

    const emitOrderStatus = async (order, status, extra = {}) => {
      const orderId = String(order._id || extra.orderId);
      const userId = getOrderUserId(order);
      const technicianId =
        extra.technicianId || getOrderTechnicianId(order) || null;

      const payload = {
        orderId,
        status,
        technicianId: technicianId ? String(technicianId) : null,
        at: Date.now(),
        ...extra,
      };

      io.to(`order:${orderId}`).emit("order:status", payload);
      io.to(`order:${orderId}`).emit("orderStatusUpdated", payload);

      if (status === "arrived") {
        io.to(`order:${orderId}`).emit("order:arrived", payload);
      }

      if (status === "cancelled" || status === "canceled") {
        io.to(`order:${orderId}`).emit("order:cancelled", payload);
        io.to(`order:${orderId}`).emit("order:canceled", payload);
      }

      if (userId) {
        io.to(`user:${userId}`).emit("order:status", payload);
        io.to(`user:${userId}`).emit("orderStatusUpdated", payload);

        if (status === "arrived") {
          io.to(`user:${userId}`).emit("order:arrived", payload);
        }

        if (status === "cancelled" || status === "canceled") {
          io.to(`user:${userId}`).emit("order:cancelled", payload);
          io.to(`user:${userId}`).emit("order:canceled", payload);
        }
      }

      if (technicianId) {
        io.to(`technician:${technicianId}`).emit("order:status", payload);
        io.to(`technician:${technicianId}`).emit("orderStatusUpdated", payload);
      }

      io.to("centers").emit("order:status", payload);
      io.to("centers").emit("orderStatusUpdated", payload);

      return payload;
    };

    const joinOrder = ({ orderId } = {}) => {
      if (!isValidId(orderId)) return;
      socket.join(`order:${orderId}`);
      socket.emit("joinOrderRoom:ok", { orderId });
      console.log(`📦 Joined order room: order:${orderId}`);
    };

    const leaveOrder = ({ orderId } = {}) => {
      if (!isValidId(orderId)) return;
      socket.leave(`order:${orderId}`);
      socket.emit("leaveOrderRoom:ok", { orderId });
      console.log(`🚪 Left order room: order:${orderId}`);
    };

    const handleTechnicianLocation = async (data = {}) => {
      const parsed = normalizeLocationPayload(data);
      const { orderId, technicianId, lat, lng, bearing, speed } = parsed;

      if (!isValidId(orderId) || lat === null || lng === null) {
        console.log("❌ INVALID TECH LOCATION PAYLOAD:", data);
        return;
      }

      try {
        const order = await Order.findById(orderId).select(
          "user technician technicianId status tracking location customerLocation pickupLocation"
        );

        if (!order) return;

        const assignedTech = getOrderTechnicianId(order);

        if (
          technicianId &&
          assignedTech &&
          String(assignedTech) !== String(technicianId)
        ) {
          console.log("⚠️ LOCATION IGNORED: technician not assigned", {
            orderId,
            assignedTech: String(assignedTech),
            technicianId,
          });
          return;
        }

        const payload = {
          orderId: String(orderId),
          technicianId: technicianId || (assignedTech ? String(assignedTech) : null),
          lat,
          lng,
          latitude: lat,
          longitude: lng,
          bearing: bearing ?? null,
          heading: bearing ?? null,
          speed: speed ?? null,
          location: {
            lat,
            lng,
            latitude: lat,
            longitude: lng,
            bearing: bearing ?? null,
            heading: bearing ?? null,
            speed: speed ?? null,
          },
          ts: new Date().toISOString(),
          at: Date.now(),
        };

        await Order.findByIdAndUpdate(orderId, {
          $set: {
            "tracking.lastTechnicianLocation.lat": lat,
            "tracking.lastTechnicianLocation.lng": lng,
            "tracking.lastTechnicianLocation.heading": bearing ?? null,
            "tracking.lastTechnicianLocation.speed": speed ?? null,
            "tracking.lastTechnicianLocation.updatedAt": new Date(),
            "technician.location.lat": lat,
            "technician.location.lng": lng,
          },
        }).catch(() => {});

        const locationEvents = [
          "order:location:update",
          "order:technician:location",
          "technicianLocationUpdate",
          "technician:location:update",
          "technician:location:updated",
          "technician_location",
          "technicianLocation",
        ];

        for (const event of locationEvents) {
          io.to(`order:${orderId}`).emit(event, payload);
          io.to("centers").emit(event, payload);
        }

        const userId = getOrderUserId(order);
        if (userId) {
          for (const event of locationEvents) {
            io.to(`user:${userId}`).emit(event, payload);
          }
        }

        if (payload.technicianId) {
          io.to(`technician:${payload.technicianId}`).emit(
            "order:location:ack",
            payload
          );
        }

        const destLat = toNumber(
          order.customerLocation?.lat ||
            order.location?.lat ||
            order.pickupLocation?.lat
        );

        const destLng = toNumber(
          order.customerLocation?.lng ||
            order.location?.lng ||
            order.pickupLocation?.lng
        );

        if (
          destLat !== null &&
          destLng !== null &&
          !["arrived", "completed", "cancelled", "canceled"].includes(
            String(order.status)
          )
        ) {
          const d = distanceMeters(lat, lng, destLat, destLng);

          if (d <= ARRIVAL_DISTANCE_METERS) {
            const arrivedOrder = await Order.findOneAndUpdate(
              {
                _id: orderId,
                status: {
                  $in: ["assigned", "accepted", "on_the_way", "in_progress"],
                },
              },
              {
                $set: {
                  status: "arrived",
                  arrivedAt: new Date(),
                },
              },
              { new: true }
            );

            if (arrivedOrder) {
              await emitOrderStatus(arrivedOrder, "arrived", {
                technicianId: payload.technicianId,
                distanceMeters: Math.round(d),
                message: "الفني وصل لموقع العميل",
              });

              console.log(`✅ AUTO ARRIVED order=${orderId} distance=${Math.round(d)}m`);
            }
          }
        }

        console.log("📍 technician live location ->", {
          orderId,
          tech: payload.technicianId,
          lat,
          lng,
        });
      } catch (error) {
        console.error("❌ technician location error:", error.message);
      }
    };

    socket.on("user:join", ({ userId } = {}) => {
      if (!isValidId(userId)) return;
      socket.join(`user:${userId}`);
      console.log(`👤 User joined: user:${userId}`);
    });

    socket.on("user:online", ({ userId } = {}) => {
      if (!isValidId(userId)) return;
      socket.join(`user:${userId}`);
      socket.emit("user:online:ok", { userId });
      console.log(`👤 User online: user:${userId}`);
    });

    socket.on("technician:join", ({ technicianId } = {}) => {
      if (!isValidId(technicianId)) return;
      socket.join(`technician:${technicianId}`);
      socket.join("technicians");
      console.log(`🧰 Technician joined: technician:${technicianId}`);
    });

    socket.on("technician:online", ({ technicianId } = {}) => {
      if (!isValidId(technicianId)) return;
      socket.join(`technician:${technicianId}`);
      socket.join("technicians");
      socket.emit("technician:online:ok", { technicianId });
      console.log(`🧰 Technician online: technician:${technicianId}`);
    });

    socket.on("center:join", ({ centerId } = {}) => {
      if (!centerId) return;
      socket.join("centers");
      socket.join(`center:${centerId}`);
      socket.emit("center:online:ok", { centerId });
      console.log(`🏢 Center joined: center:${centerId}`);
    });

    socket.on("center:online", ({ centerId } = {}) => {
      if (!centerId) return;
      socket.join("centers");
      socket.join(`center:${centerId}`);
      socket.emit("center:online:ok", { centerId });
      console.log(`🏢 Center online: center:${centerId}`);
    });

    socket.on("order:join", joinOrder);
    socket.on("joinOrderRoom", joinOrder);
    socket.on("join_order", (data) => {
      if (typeof data === "string") return joinOrder({ orderId: data });
      return joinOrder(data);
    });

    socket.on("order:leave", leaveOrder);
    socket.on("leaveOrderRoom", leaveOrder);
    socket.on("leave_order", (data) => {
      if (typeof data === "string") return leaveOrder({ orderId: data });
      return leaveOrder(data);
    });

    socket.on("order:accept", async ({ orderId, technicianId } = {}) => {
      if (!isValidId(orderId) || !isValidId(technicianId)) {
        socket.emit("order:accept:failed", {
          orderId,
          reason: "Invalid orderId or technicianId",
        });
        return;
      }

      try {
        const order = await Order.findOneAndUpdate(
          {
            _id: orderId,
            status: { $in: ["pending", "assigned"] },
          },
          {
            $set: {
              status: "accepted",
              technician: {
                id: technicianId,
                techId: technicianId,
              },
              acceptedAt: new Date(),
            },
          },
          { new: true }
        );

        if (!order) {
          socket.emit("order:accept:failed", {
            orderId,
            reason: "Order already taken or not available",
          });
          return;
        }

        let chat = await SupportChat.findOne({
          user: order.user,
          technician: technicianId,
          status: { $ne: "closed" },
        });

        if (!chat) {
          chat = await SupportChat.create({
            user: order.user,
            technician: technicianId,
            order: order._id,
            status: "assigned",
            lastMessageAt: new Date(),
          });
        }

        const payload = {
          ...order.toObject(),
          chatId: chat._id,
        };

        const userId = getOrderUserId(order);

        socket.join(`order:${orderId}`);
        socket.join(`technician:${technicianId}`);

        socket.emit("order:accepted", payload);
        io.to(`order:${orderId}`).emit("order:accepted", payload);
        io.to("centers").emit("order:updated", payload);

        if (userId) {
          io.to(`user:${userId}`).emit("order:accepted", payload);
        }

        await emitOrderStatus(order, "accepted", {
          technicianId,
          chatId: chat._id,
        });

        socket.to("technicians").emit("order:taken", {
          orderId,
          technicianId,
        });

        console.log(`✅ Order ${orderId} accepted by ${technicianId}`);
      } catch (error) {
        console.error("❌ order:accept error:", error);
        socket.emit("order:accept:failed", {
          orderId,
          reason: "Server error",
        });
      }
    });

    socket.on("order:reject", ({ orderId, technicianId } = {}) => {
      if (!isValidId(orderId)) return;
      socket.emit("order:rejected:ok", { orderId, technicianId });
      console.log(`❌ Order rejected: ${orderId}`);
    });

    socket.on("order:technician:location", handleTechnicianLocation);
    socket.on("technician:location:update", handleTechnicianLocation);
    socket.on("technicianLocationUpdate", handleTechnicianLocation);
    socket.on("technician:location:updated", handleTechnicianLocation);
    socket.on("technician_location", handleTechnicianLocation);
    socket.on("technicianLocation", handleTechnicianLocation);

    socket.on("order:on_the_way", async ({ orderId, technicianId } = {}) => {
      if (!isValidId(orderId) || !isValidId(technicianId)) return;

      try {
        const order = await Order.findOneAndUpdate(
          {
            _id: orderId,
            status: { $in: ["accepted", "assigned"] },
          },
          {
            $set: {
              status: "on_the_way",
              onTheWayAt: new Date(),
            },
          },
          { new: true }
        );

        if (!order) return;

        await emitOrderStatus(order, "on_the_way", { technicianId });
        io.to("centers").emit("order:updated", order);

        console.log(`🚗 Order ${orderId} on the way`);
      } catch (error) {
        console.error("❌ order:on_the_way error:", error.message);
      }
    });

    socket.on("order:arrived", async ({ orderId, technicianId } = {}) => {
      if (!isValidId(orderId)) return;

      try {
        const order = await Order.findOneAndUpdate(
          {
            _id: orderId,
            status: {
              $in: ["accepted", "assigned", "on_the_way", "in_progress"],
            },
          },
          {
            $set: {
              status: "arrived",
              arrivedAt: new Date(),
            },
          },
          { new: true }
        );

        if (!order) return;

        await emitOrderStatus(order, "arrived", {
          technicianId: technicianId || getOrderTechnicianId(order),
          message: "الفني وصل لموقع العميل",
        });

        io.to("centers").emit("order:updated", order);

        console.log(`✅ Order ${orderId} arrived`);
      } catch (error) {
        console.error("❌ order:arrived error:", error.message);
      }
    });

    socket.on("order:cancel", async ({ orderId, userId, reason } = {}) => {
      if (!isValidId(orderId)) return;

      try {
        const order = await Order.findOneAndUpdate(
          {
            _id: orderId,
            status: { $nin: ["completed", "cancelled", "canceled"] },
          },
          {
            $set: {
              status: "cancelled",
              cancelledAt: new Date(),
              cancelReason: reason || "Cancelled by user",
            },
          },
          { new: true }
        );

        if (!order) return;

        await emitOrderStatus(order, "cancelled", {
          userId,
          reason: reason || "Cancelled by user",
        });

        io.to("centers").emit("order:updated", order);

        console.log(`🛑 Order ${orderId} cancelled`);
      } catch (error) {
        console.error("❌ order:cancel error:", error.message);
      }
    });

    socket.on("disconnect", (reason) => {
      console.log("⚫ Order socket disconnected:", socket.id, reason);
    });
  });
}