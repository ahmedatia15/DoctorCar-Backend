import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Eye,
  MapPin,
  Navigation,
  PhoneCall,
  Search,
  UserCheck,
  Wrench,
  XCircle,
} from "lucide-react";

import {
  assignedTech,
  canAssign,
  customerName,
  isEmergency,
  orderId,
  orderStatus,
  serviceName,
  shortId,
  statusLabels,
} from "../utils/orderHelpers";

import { getCustomerLocation, joinOrderRoom } from "../utils/trackingHelpers";

function getStatusData(status, emergency) {
  if (emergency) {
    return {
      label: "بلاغ عاجل",
      icon: AlertTriangle,
      className: "danger",
    };
  }

  if (status === "completed") {
    return {
      label: "مكتمل",
      icon: CheckCircle2,
      className: "success",
    };
  }

  if (["canceled", "cancelled"].includes(status)) {
    return {
      label: "ملغي",
      icon: XCircle,
      className: "muted",
    };
  }

  if (["assigned", "accepted", "on_the_way", "arrived", "in_progress"].includes(status)) {
    return {
      label: statusLabels[status] || "قيد التنفيذ",
      icon: Navigation,
      className: "active",
    };
  }

  return {
    label: statusLabels[status] || "في الانتظار",
    icon: Clock3,
    className: "waiting",
  };
}

function formatTime(value) {
  return new Date(value || Date.now()).toLocaleTimeString("ar-EG", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function OrdersPanel({
  filteredOrders,
  selectedOrderId,
  setSelectedOrderId,
  filter,
  setFilter,
  query,
  setQuery,
  assigningId,
  assignTechnician,
  sendOrderOnTheWay,
  focusTracking,
}) {
  const filters = [
    ["all", "كل الطلبات"],
    ["emergency", "بلاغات عاجلة"],
    ["waiting", "تحتاج تعيين"],
    ["assigned", "تم التعيين"],
    ["on_the_way", "في الطريق"],
    ["completed", "مكتملة"],
    ["canceled", "ملغية"],
  ];

  const visibleOrders =
    filter === "emergency"
      ? filteredOrders.filter((order) => isEmergency(order))
      : filteredOrders;

  const emergencyCount = filteredOrders.filter((order) => isEmergency(order)).length;

  return (
    <section className="panel orders-panel clean-orders-panel">
      <div className="clean-orders-head">
        <div>
          <span className="clean-section-label">قائمة الطلبات</span>

          <h2>طلبات العملاء</h2>

          <p>
            اختر طلبًا لعرض موقع العميل والفني على الخريطة، أو لتعيين فني
            ومتابعة حالة الطلب.
          </p>
        </div>

        <div className={emergencyCount > 0 ? "orders-counter danger" : "orders-counter"}>
          <b>{visibleOrders.length}</b>
          <span>طلب ظاهر</span>
        </div>
      </div>

      <div className="clean-search-box">
        <Search size={18} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="ابحث باسم العميل، نوع الخدمة، رقم الطلب، أو الفني..."
        />
      </div>

      <div className="clean-filters">
        {filters.map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={filter === key ? "active" : ""}
            onClick={() => setFilter(key)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="clean-orders-list">
        {visibleOrders.length === 0 ? (
          <div className="empty-box">
            <Wrench size={34} />
            <h3>لا توجد طلبات حاليًا</h3>
            <p>أي طلب جديد سيظهر هنا بشكل مباشر.</p>
          </div>
        ) : (
          visibleOrders.map((order) => {
            const id = orderId(order);
            const status = orderStatus(order);
            const emergency = isEmergency(order);
            const tech = assignedTech(order);
            const location = getCustomerLocation(order);
            const active = selectedOrderId === id;
            const statusData = getStatusData(status, emergency);
            const StatusIcon = statusData.icon;

            return (
              <article
                key={id}
                className={[
                  "clean-order-card",
                  active ? "selected" : "",
                  emergency ? "emergency" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => {
                  setSelectedOrderId(id);
                  joinOrderRoom(id);
                }}
              >
                <div className="clean-order-main">
                  <div className="clean-order-icon">
                    {emergency ? (
                      <AlertTriangle size={22} />
                    ) : (
                      <Wrench size={22} />
                    )}
                  </div>

                  <div className="clean-order-content">
                    <div className="clean-order-top">
                      <div>
                        <h3>{serviceName(order)}</h3>

                        <p>
                          {customerName(order)} · الطلب #{shortId(id)}
                        </p>
                      </div>

                      <span className={`clean-status-badge ${statusData.className}`}>
                        <StatusIcon size={14} />
                        {statusData.label}
                      </span>
                    </div>

                    <div className="clean-order-details">
                      <div>
                        <Clock3 size={15} />
                        <span>{formatTime(order.createdAt)}</span>
                      </div>

                      <div>
                        <UserCheck size={15} />
                        <span>{tech ? `الفني: ${shortId(tech)}` : "لم يتم تعيين فني"}</span>
                      </div>

                      <div>
                        <MapPin size={15} />
                        <span>
                          {location?.lat?.toFixed(5)}, {location?.lng?.toFixed(5)}
                        </span>
                      </div>

                      {emergency && (
                        <div>
                          <PhoneCall size={15} />
                          <span>{order?.emergencyContactPhone || "لا يوجد رقم طوارئ"}</span>
                        </div>
                      )}
                    </div>

                    {emergency && order?.notes && (
                      <div className="clean-emergency-note">
                        <AlertTriangle size={15} />
                        <span>{order.notes}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="clean-order-actions">
                  <button
                    className={emergency ? "assign-btn emergency" : "assign-btn"}
                    disabled={assigningId === id || !canAssign(order)}
                    onClick={(event) => {
                      event.stopPropagation();
                      assignTechnician(order);
                    }}
                  >
                    <UserCheck size={17} />
                    {assigningId === id
                      ? "جاري التعيين"
                      : emergency
                      ? "استلام البلاغ"
                      : status === "assigned"
                      ? "تغيير الفني"
                      : "تعيين فني"}
                  </button>

                  <button
                    className="secondary"
                    onClick={(event) => {
                      event.stopPropagation();
                      sendOrderOnTheWay(order);
                    }}
                  >
                    <Navigation size={17} />
                    في الطريق
                  </button>

                  <button
                    className="secondary"
                    onClick={(event) => {
                      event.stopPropagation();
                      focusTracking(order);
                    }}
                  >
                    <Eye size={17} />
                    متابعة
                  </button>
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}