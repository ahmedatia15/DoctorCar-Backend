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
      tone: "neutral",
    },
    {
      title: "تحتاج تعيين فني",
      value: waiting,
      hint: waiting > 0 ? "يوجد طلبات تنتظر إجراء" : "لا توجد طلبات منتظرة",
      icon: Clock3,
      tone: waiting > 0 ? "warning" : "neutral",
    },
    {
      title: "قيد التنفيذ",
      value: assigned,
      hint: "طلبات تم إسنادها لفني",
      icon: CheckCircle2,
      tone: "active",
    },
    {
      title: "تتبع مباشر",
      value: live,
      hint: "فنيون يتم تتبعهم الآن",
      icon: MapPinned,
      tone: "live",
    },
    {
      title: "بلاغات عاجلة",
      value: emergency,
      hint: emergency > 0 ? "تحتاج أولوية فورية" : "لا توجد بلاغات عاجلة",
      icon: AlertTriangle,
      tone: emergency > 0 ? "danger" : "neutral",
    },
  ];

  return (
    <section className="stats-grid">
      {cards.map((card) => {
        const Icon = card.icon;

        return (
          <article key={card.title} className={`stat-card tone-${card.tone}`}>
            <div className="stat-card-icon">
              <Icon size={20} strokeWidth={2.4} />
            </div>

            <div className="stat-card-body">
              <p className="stat-card-title">{card.title}</p>
              <strong>{card.value}</strong>
              <span className="stat-card-hint">{card.hint}</span>
            </div>
          </article>
        );
      })}
    </section>
  );
}
