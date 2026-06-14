import { socket } from "../socket";

const DEFAULT_LOCATION = {
  lat: 30.0444,
  lng: 31.2357,
};

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function validLatLng(lat, lng) {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180 &&
    !(lat === 0 && lng === 0)
  );
}

function pickLatLng(...sources) {
  for (const source of sources) {
    if (!source) continue;

    const lat = toNumber(source.lat ?? source.latitude);
    const lng = toNumber(source.lng ?? source.longitude);

    if (validLatLng(lat, lng)) {
      return { lat, lng };
    }
  }

  return null;
}

export function getCustomerLocation(order) {
  const picked = pickLatLng(
    order,
    order?.customerLocation,
    order?.location,
    order?.pickupLocation,
    order?.accidentLocation,
    order?.geo,
    order?.coordinates
  );

  return picked || DEFAULT_LOCATION;
}

export function getLocationFromPayload(data) {
  const id = String(
    data?.orderId ||
      data?.order_id ||
      data?.requestId ||
      data?.bookingId ||
      data?.accidentId ||
      data?._id ||
      ""
  ).trim();

  const picked = pickLatLng(
    data,
    data?.location,
    data?.coords,
    data?.position,
    data?.technicianLocation
  );

  if (!id || !picked) return null;

  const bearing = toNumber(
    data?.location?.bearing ??
      data?.bearing ??
      data?.heading ??
      data?.location?.heading
  );

  const speed = toNumber(data?.location?.speed ?? data?.speed);

  return {
    id,
    lat: picked.lat,
    lng: picked.lng,
    bearing: bearing ?? 0,
    speed: speed ?? 0,
  };
}

export function joinOrderRoom(id) {
  const cleanId = String(id || "").trim();
  if (!cleanId || !socket?.connected) return;

  socket.emit("order:join", { orderId: cleanId });
  socket.emit("joinOrderRoom", { orderId: cleanId });
  socket.emit("join_order", { orderId: cleanId });
  socket.emit("accident:join", { accidentId: cleanId });
}

export function leaveOrderRoom(id) {
  const cleanId = String(id || "").trim();
  if (!cleanId || !socket?.connected) return;

  socket.emit("order:leave", { orderId: cleanId });
  socket.emit("leaveOrderRoom", { orderId: cleanId });
  socket.emit("accident:leave", { accidentId: cleanId });
}

export function distanceMeters(a, b) {
  if (!a || !b) return 0;

  const lat1Raw = toNumber(a.lat);
  const lng1Raw = toNumber(a.lng);
  const lat2Raw = toNumber(b.lat);
  const lng2Raw = toNumber(b.lng);

  if (!validLatLng(lat1Raw, lng1Raw) || !validLatLng(lat2Raw, lng2Raw)) {
    return 0;
  }

  const r = 6371000;
  const lat1 = (lat1Raw * Math.PI) / 180;
  const lat2 = (lat2Raw * Math.PI) / 180;
  const dLat = ((lat2Raw - lat1Raw) * Math.PI) / 180;
  const dLng = ((lng2Raw - lng1Raw) * Math.PI) / 180;

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return r * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function etaMinutes(customer, tech, speedMetersPerSecond = 8.5) {
  const d = distanceMeters(customer, tech);
  const speed = Number(speedMetersPerSecond);

  if (!d || !Number.isFinite(speed) || speed <= 0) return "-";

  return Math.max(1, Math.ceil(d / speed / 60));
}