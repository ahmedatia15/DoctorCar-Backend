import { useEffect, useState } from "react";
import axios from "axios";
import {
  CheckCircle2,
  Phone,
  RefreshCw,
  UserCheck,
  Users,
  Wrench,
} from "lucide-react";

import { API_URL } from "../config";
import { shortId } from "../utils/orderHelpers";

export default function TechniciansPanel({ technicianId, setTechnicianId }) {
  const [techs, setTechs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const res = await axios.get(`${API_URL}/api/technicians`);
        if (cancelled) return;
        setTechs(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        if (cancelled) return;
        setError(
          err?.response?.data?.message || "تعذّر تحميل الفنيين من قاعدة البيانات"
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

  const available = techs.filter((t) => t.isAvailable !== false).length;

  return (
    <section className="catalog-panel">
      <div className="catalog-head">
        <div>
          <span className="catalog-kicker">
            <Users size={14} />
            فنيو المركز
          </span>
          <h2>الفنيين المسجّلين</h2>
          <p>
            اختر فنيًا لتعيينه على الطلبات. المتاحون الآن:{" "}
            <b>{available}</b> من {techs.length}.
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
          <Users size={28} />
          <h3>تعذّر تحميل الفنيين</h3>
          <p>{error}</p>
        </div>
      ) : loading && techs.length === 0 ? (
        <div className="empty-box">
          <RefreshCw size={28} />
          <h3>جاري تحميل الفنيين</h3>
          <p>يتم جلب الفنيين من قاعدة البيانات...</p>
        </div>
      ) : techs.length === 0 ? (
        <div className="empty-box">
          <Users size={28} />
          <h3>لا يوجد فنيون مسجّلون</h3>
          <p>أضف فنيًا عبر POST /api/technicians.</p>
        </div>
      ) : (
        <div className="catalog-grid">
          {techs.map((t) => {
            const id = String(t._id || t.id || "");
            const active = id && technicianId === id;
            const available = t.isAvailable !== false;

            return (
              <article
                key={id}
                className={`catalog-card tech-card${active ? " selected" : ""}`}
              >
                <div className="catalog-card-head">
                  <div>
                    <h3>{t.name || "فني"}</h3>
                    <p className="catalog-meta">
                      <Wrench size={13} /> {t.serviceType || "خدمة عامة"}
                    </p>
                  </div>

                  <span
                    className={`clean-status-badge ${available ? "success" : "muted"}`}
                  >
                    <CheckCircle2 size={13} />
                    {available ? "متاح" : "غير متاح"}
                  </span>
                </div>

                <div className="clean-order-details">
                  {t.phone && (
                    <div>
                      <Phone size={14} />
                      <span>{t.phone}</span>
                    </div>
                  )}
                  <div>
                    <UserCheck size={14} />
                    <span>ID: {shortId(id)}</span>
                  </div>
                </div>

                <button
                  type="button"
                  className={active ? "assign-btn" : "secondary"}
                  onClick={() => setTechnicianId(id)}
                  style={{ marginTop: 8 }}
                >
                  <UserCheck size={16} />
                  {active ? "محدد للتعيين" : "استخدم لتعيين الطلبات"}
                </button>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
