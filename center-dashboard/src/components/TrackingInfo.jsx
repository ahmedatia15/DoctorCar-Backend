import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  MapPin,
  PhoneCall,
  Route,
  User,
  UserCheck,
  Wrench,
} from "lucide-react";

import {
  assignedTech,
  customerName,
  isEmergency,
  orderStatus,
  serviceName,
  shortId,
  statusLabels,
} from "../utils/orderHelpers";

const FINISHED_STATUSES = [
  "arrived",
  "completed",
  "canceled",
  "cancelled",
  "وصل",
  "مكتمل",
  "ملغي",
];

function isFinishedStatus(status) {
  return FINISHED_STATUSES.includes(String(status || "").trim());
}

function DetailItem({ icon: Icon, label, value, tone = "default" }) {
  return (
    <div className={`tracking-detail-item ${tone}`}>
      <span className="tracking-detail-icon">
        <Icon size={18} strokeWidth={2.5} />
      </span>

      <div>
        <p>{label}</p>
        <b>{value}</b>
      </div>
    </div>
  );
}

export default function TrackingInfo({
  selectedOrder,
  technicianLocation,
  currentDistanceKm,
  currentEta,
}) {
  if (!selectedOrder) {
    return (
      <section className="tracking-details">
        <div className="tracking-empty-state">
          <MapPin size={32} />
          <h3>اختر طلبًا من القائمة</h3>
          <p>سيتم عرض بيانات العميل والفني والمسافة المتبقية هنا.</p>
        </div>
      </section>
    );
  }

  const status = orderStatus(selectedOrder);
  const tech = assignedTech(selectedOrder);
  const emergency = isEmergency(selectedOrder);
  const finished = isFinishedStatus(status);

  const arrived =
    status === "arrived" ||
    status === "completed" ||
    status === "وصل" ||
    status === "مكتمل";

  const trackingStatus = arrived
    ? "تم الوصول"
    : finished
    ? "التتبع متوقف"
    : technicianLocation
    ? "يعمل الآن"
    : "بانتظار موقع الفني";

  return (
    <section className="tracking-details">
      <div className="tracking-details-head">
        <div>
          <span className={emergency ? "tracking-type danger" : "tracking-type"}>
            {emergency ? "بلاغ عاجل" : "تفاصيل الطلب"}
          </span>

          <h3>{serviceName(selectedOrder)}</h3>

          <p>
            بيانات مختصرة تساعد موظف المركز على متابعة الطلب بدون زحمة في
            الواجهة.
          </p>
        </div>

        <div className={technicianLocation && !finished ? "tracking-live-pill on" : "tracking-live-pill"}>
          <span />
          {trackingStatus}
        </div>
      </div>

      <div className="tracking-details-grid">
        <DetailItem
          icon={User}
          label="العميل"
          value={customerName(selectedOrder)}
          tone="blue"
        />

        <DetailItem
          icon={UserCheck}
          label="الفني"
          value={tech ? shortId(tech) : "لم يتم التعيين"}
          tone="purple"
        />

        <DetailItem
          icon={CheckCircle2}
          label="حالة الطلب"
          value={statusLabels[status] || status}
          tone={arrived ? "green" : "cyan"}
        />

        <DetailItem
          icon={Route}
          label="المسافة المتبقية"
          value={
            arrived
              ? "0.00 كم"
              : technicianLocation
              ? `${currentDistanceKm} كم`
              : "غير متاحة"
          }
          tone="orange"
        />

        <DetailItem
          icon={Clock3}
          label="وقت الوصول المتوقع"
          value={
            arrived
              ? "وصل"
              : technicianLocation
              ? `${currentEta} دقيقة`
              : "غير متاح"
          }
          tone="yellow"
        />

        <DetailItem
          icon={MapPin}
          label="موقع الفني"
          value={
            arrived
              ? "وصل لموقع العميل"
              : technicianLocation
              ? `${technicianLocation.lat.toFixed(4)}, ${technicianLocation.lng.toFixed(4)}`
              : "لم يتم استقبال الموقع"
          }
          tone="red"
        />

        {emergency && (
          <DetailItem
            icon={PhoneCall}
            label="رقم الطوارئ"
            value={selectedOrder.emergencyContactPhone || "غير متوفر"}
            tone="danger"
          />
        )}

        {emergency && selectedOrder.notes && (
          <div className="tracking-alert-note">
            <AlertTriangle size={17} />
            <div>
              <b>ملاحظات البلاغ</b>
              <p>{selectedOrder.notes}</p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}