import { useEffect, useState } from "react";
import axios from "axios";
import {
  Building2,
  MapPin,
  MessageSquareQuote,
  RefreshCw,
  Star,
  Wrench,
} from "lucide-react";

import { API_URL } from "../config";

function formatRating(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return "0.0";
  return num.toFixed(1);
}

export default function CenterCatalog() {
  const [centers, setCenters] = useState([]);
  const [reviewsByCenter, setReviewsByCenter] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const res = await axios.get(`${API_URL}/api/centers/maintenance`);
        const list = Array.isArray(res.data?.centers) ? res.data.centers : [];

        if (cancelled) return;
        setCenters(list);

        const reviewPairs = await Promise.allSettled(
          list.map((center) =>
            axios
              .get(`${API_URL}/api/centers/${center.id}/reviews`)
              .then((r) => [center.id, r.data?.reviews || []])
          )
        );

        if (cancelled) return;

        const map = {};
        for (const result of reviewPairs) {
          if (result.status === "fulfilled") {
            const [id, reviews] = result.value;
            map[id] = reviews;
          }
        }
        setReviewsByCenter(map);
      } catch (err) {
        if (cancelled) return;
        setError(
          err?.response?.data?.message ||
            "تعذّر تحميل بيانات المراكز من قاعدة البيانات"
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

  return (
    <section className="catalog-panel">
      <div className="catalog-head">
        <div>
          <span className="catalog-kicker">
            <Building2 size={14} />
            بيانات حية من قاعدة البيانات
          </span>

          <h2>مراكز الصيانة والخدمات</h2>

          <p>
            القائمة الكاملة للمراكز المعتمدة، الخدمات التي يقدمها كل مركز، وآخر
            تقييمات العملاء. البيانات مأخوذة مباشرة من MongoDB عبر
            <code> /api/centers/maintenance</code> و
            <code> /api/centers/:id/reviews</code>.
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
          <Building2 size={28} />
          <h3>لم يتم تحميل المراكز</h3>
          <p>{error}</p>
        </div>
      ) : loading && centers.length === 0 ? (
        <div className="empty-box">
          <RefreshCw size={28} />
          <h3>جاري تحميل المراكز</h3>
          <p>يتم جلب البيانات من قاعدة البيانات...</p>
        </div>
      ) : centers.length === 0 ? (
        <div className="empty-box">
          <Building2 size={28} />
          <h3>لا توجد مراكز مسجّلة</h3>
          <p>أضف مراكز عبر /api/centers/import/manual أو نقطة seed.</p>
        </div>
      ) : (
        <div className="catalog-grid">
          {centers.map((center) => {
            const reviews = reviewsByCenter[center.id] || [];
            const services = Array.isArray(center.services) ? center.services : [];

            return (
              <article key={center.id} className="catalog-card">
                <div className="catalog-card-head">
                  <div>
                    <h3>{center.name}</h3>
                    <p className="catalog-meta">
                      <MapPin size={13} /> {center.address || center.governorate || "—"}
                    </p>
                  </div>

                  <span className="catalog-rating">
                    <Star size={13} fill="currentColor" />
                    {formatRating(center.rating)}
                    {center.userRatingsTotal
                      ? ` · ${center.userRatingsTotal}`
                      : ""}
                  </span>
                </div>

                {services.length > 0 && (
                  <div>
                    <div className="catalog-services">
                      {services.map((service) => (
                        <span key={service} className="chip">
                          <Wrench size={11} /> {service}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="catalog-reviews">
                  <h4>
                    <MessageSquareQuote size={13} /> آخر التقييمات
                  </h4>

                  {reviews.length === 0 ? (
                    <p className="catalog-empty">لا توجد تقييمات بعد.</p>
                  ) : (
                    reviews.slice(0, 3).map((review) => (
                      <div key={review.id} className="catalog-review">
                        <div className="catalog-review-top">
                          <b>{review.userName || "مستخدم"}</b>
                          <span>
                            <Star size={11} fill="currentColor" />{" "}
                            {formatRating(review.rating)}
                          </span>
                        </div>
                        {review.comment && <p>{review.comment}</p>}
                      </div>
                    ))
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
