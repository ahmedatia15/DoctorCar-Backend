import { useEffect, useState } from "react";
import axios from "axios";
import {
  CalendarClock,
  Car,
  CheckCircle2,
  Phone,
  RefreshCw,
  User,
  Wrench,
  XCircle,
} from "lucide-react";

import { API_URL } from "../config";

const STATUS_META = {
  scheduled: { label: "محجوز", className: "active", icon: CalendarClock },
  completed: { label: "تم", className: "success", icon: CheckCircle2 },
  cancelled: { label: "ملغي", className: "danger", icon: XCircle },
};

function formatDate(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("ar-EG", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(value);
  }
}

export default function AppointmentsPanel() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const res = await axios.get(`${API_URL}/api/appointments/center`);
        if (cancelled) return;
        setAppointments(
          Array.isArray(res.data?.appointments) ? res.data.appointments : []
        );
      } catch (err) {
        if (cancelled) return;
        setError(
          err?.response?.data?.message ||
            "تعذّر تحميل حجوزات الصيانة من قاعدة البيانات"
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const upcoming = appointments.filter((a) => a.status === "scheduled").length;

  return (
    <section className="catalog-panel">
      <div className="catalog-head">
        <div>
          <span className="catalog-kicker">
            <CalendarClock size={14} />
            حجوزات صيانة دوريّة
          </span>

          <h2>مواعيد العملاء داخل المركز</h2>

          <p>
            مواعيد الصيانة الدورية التي حجزها العملاء من تطبيق Doctor Car.
            البيانات مأخوذة مباشرة من MongoDB عبر
            <code> /api/appointments/center</code>.
            {" "}عدد المواعيد القادمة:
            {" "}
            <b>{upcoming}</b>.
          </p>
        </div>

        <button
          type="button"
          className="catalog-refresh"
          onClick={() => setRefreshKey((k) => k + 1)}
          disabled={loading}
        >
          <RefreshCw size={16} />
          {loading ? "جاري التحديث" : "تحديث"}
        </button>
      </div>

      {error ? (
        <div className="empty-box">
          <CalendarClock size={28} />
          <h3>تعذّر تحميل الحجوزات</h3>
          <p>{error}</p>
        </div>
      ) : loading && appointments.length === 0 ? (
        <div className="empty-box">
          <RefreshCw size={28} />
          <h3>جاري تحميل الحجوزات</h3>
          <p>يتم جلب الحجوزات من قاعدة البيانات...</p>
        </div>
      ) : appointments.length === 0 ? (
        <div className="empty-box">
          <CalendarClock size={28} />
          <h3>لا توجد مواعيد محجوزة</h3>
          <p>سيظهر هنا أي موعد صيانة دورية يحجزه العميل من التطبيق.</p>
        </div>
      ) : (
        <div className="catalog-grid">
          {appointments.slice(0, 12).map((a) => {
            const meta = STATUS_META[a.status] || STATUS_META.scheduled;
            const StatusIcon = meta.icon;

            return (
              <article key={a.id} className="catalog-card">
                <div className="catalog-card-head">
                  <div>
                    <h3>
                      <Wrench size={15} /> {a.service}
                    </h3>
                    <p className="catalog-meta">
                      <CalendarClock size={13} /> {formatDate(a.date)}
                    </p>
                  </div>

                  <span className={`clean-status-badge ${meta.className}`}>
                    <StatusIcon size={13} />
                    {meta.label}
                  </span>
                </div>

                <div className="clean-order-details">
                  <div>
                    <User size={14} />
                    <span>{a.userName || "—"}</span>
                  </div>
                  <div>
                    <Phone size={14} />
                    <span>{a.userPhone || "—"}</span>
                  </div>
                  {a.vehicle && (
                    <div>
                      <Car size={14} />
                      <span>{a.vehicle}</span>
                    </div>
                  )}
                  <div>
                    <Wrench size={14} />
                    <span>{a.center}</span>
                  </div>
                </div>

                {a.notes && (
                  <p className="catalog-meta" style={{ margin: 0 }}>
                    {a.notes}
                  </p>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
