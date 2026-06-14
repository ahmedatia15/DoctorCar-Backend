export const statusLabels = {
  pending: "بانتظار فني",
  searching: "جاري البحث",
  contacting: "تواصل",
  timeout: "انتهى الوقت",

  emergency: "بلاغ طوارئ",
  critical: "حالة حرجة",

  assigned: "تم التعيين",
  accepted: "مقبول",
  on_the_way: "في الطريق",
  arrived: "وصل",
  in_progress: "قيد التنفيذ",
  completed: "مكتمل",
  canceled: "ملغي",
  cancelled: "ملغي",
};

export const waitingStatuses = [
  "pending",
  "searching",
  "contacting",
  "timeout",
  "emergency",
  "critical",
];

export const locationListenEvents = [
  "order:location:update",
  "order:technician:location",
  "technicianLocationUpdate",
  "technician:location:update",
  "technician:location:updated",
  "technician_location",
  "technicianLocation",
];

export function orderId(order) {
  return String(order?._id || order?.id || order?.orderId || "");
}

export function orderStatus(order) {
  return String(order?.status || "pending");
}

export function isEmergency(order) {
  const type = String(order?.type || "").toLowerCase();
  const service = String(order?.serviceType || order?.serviceName || "").toLowerCase();

  return (
    type === "emergency" ||
    service === "accident" ||
    service === "emergency" ||
    Boolean(order?.emergencyContactPhone) ||
    Boolean(order?.audioUrl) ||
    Array.isArray(order?.imageUrls)
  );
}

export function serviceName(order) {
  if (isEmergency(order)) return "🚨 بلاغ حادث";

  return (
    order?.serviceType ||
    order?.serviceName ||
    order?.service?.name ||
    order?.selectedServices?.[0] ||
    "خدمة طريق"
  );
}

export function customerName(order) {
  if (isEmergency(order)) {
    return (
      order?.userName ||
      order?.user?.name ||
      order?.customerName ||
      order?.emergencyContactName ||
      "بلاغ طوارئ"
    );
  }

  return order?.userName || order?.user?.name || order?.customerName || "عميل";
}

export function assignedTech(order) {
  const tech = order?.technician;

  if (typeof tech === "string") return tech;

  return (
    tech?.techId ||
    tech?.id ||
    tech?._id ||
    tech?.techName ||
    order?.technicianId ||
    ""
  );
}

export function shortId(id) {
  const value = String(id || "");
  if (value.length <= 14) return value;
  return `${value.slice(0, 8)}...${value.slice(-5)}`;
}

export function canAssign(order) {
  return !["completed", "canceled", "cancelled"].includes(orderStatus(order));
}

export function orderPriority(order) {
  if (isEmergency(order)) return 3;

  const status = orderStatus(order);
  if (waitingStatuses.includes(status)) return 2;
  if (["assigned", "accepted", "on_the_way", "arrived"].includes(status)) return 1;

  return 0;
}

export function orderCreatedTime(order) {
  const value = order?.createdAt || order?.updatedAt || order?.date;
  const time = value ? new Date(value).getTime() : 0;
  return Number.isFinite(time) ? time : 0;
}

export function upsertOrder(prev, incoming) {
  const id = orderId(incoming);
  if (!id) return prev;

  const exists = prev.some((o) => orderId(o) === id);

  const updated = exists
    ? prev.map((o) => (orderId(o) === id ? { ...o, ...incoming } : o))
    : [incoming, ...prev];

  return updated.sort((a, b) => {
    const priorityDiff = orderPriority(b) - orderPriority(a);
    if (priorityDiff !== 0) return priorityDiff;

    return orderCreatedTime(b) - orderCreatedTime(a);
  });
}