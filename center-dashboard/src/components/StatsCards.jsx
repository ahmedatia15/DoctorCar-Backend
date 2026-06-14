import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Headset,
  MapPinned,
} from "lucide-react";

export default function StatsCards({ stats }) {
  const total = stats?.total || 0;
  const waiting = stats?.waiting || 0;
  const assigned = stats?.assigned || 0;
  const live = stats?.live || 0;
  const emergency = stats?.emergency || 0;

  const cards = [
    {
      title: "إجمالي الطلبات",
      value: total,
      hint: "كل الطلبات داخل المركز",
      icon: Headset,
      className: "summary-total",
    },
    {
      title: "تحتاج تعيين فني",
      value: waiting,
      hint: waiting > 0 ? "يوجد طلبات تنتظر إجراء" : "لا توجد طلبات منتظرة",
      icon: Clock3,
      className: waiting > 0 ? "summary-warning" : "summary-normal",
    },
    {
      title: "قيد التنفيذ",
      value: assigned,
      hint: "طلبات تم إسنادها لفني",
      icon: CheckCircle2,
      className: "summary-active",
    },
    {
      title: "تتبع مباشر",
      value: live,
      hint: "فنيين يتم تتبعهم الآن",
      icon: MapPinned,
      className: "summary-live",
    },
    {
      title: "بلاغات عاجلة",
      value: emergency,
      hint: emergency > 0 ? "تحتاج أولوية فورية" : "لا توجد بلاغات عاجلة",
      icon: AlertTriangle,
      className: emergency > 0 ? "summary-danger" : "summary-normal",
    },
  ];

  return (
    <section className="center-summary">
      <div className="center-summary-head">
        <div>
          <span>ملخص حالة المركز</span>
          <h2>نظرة سريعة على التشغيل</h2>
          <p>
            أرقام مباشرة تساعد موظف المركز على تحديد الطلبات التي تحتاج متابعة
            أو تدخل سريع.
          </p>
        </div>
      </div>

      <div className="center-summary-grid">
        {cards.map((card) => {
          const Icon = card.icon;

          return (
            <article
              key={card.title}
              className={`center-summary-card ${card.className}`}
            >
              <div className="summary-card-top">
                <div className="summary-card-icon">
                  <Icon size={23} strokeWidth={2.6} />
                </div>

                <div>
                  <h3>{card.title}</h3>
                  <p>{card.hint}</p>
                </div>
              </div>

              <strong>{card.value}</strong>
            </article>
          );
        })}
      </div>
    </section>
  );
}