import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Info,
  Radio,
} from "lucide-react";

function getLogMeta(text = "") {
  const value = String(text).toLowerCase();

  if (
    value.includes("فشل") ||
    value.includes("فصل") ||
    value.includes("offline") ||
    value.includes("error")
  ) {
    return {
      label: "تنبيه",
      className: "alert",
      icon: AlertTriangle,
    };
  }

  if (
    value.includes("تم") ||
    value.includes("وصل") ||
    value.includes("online") ||
    value.includes("نجاح")
  ) {
    return {
      label: "نجاح",
      className: "success",
      icon: CheckCircle2,
    };
  }

  return {
    label: "تحديث",
    className: "info",
    icon: Info,
  };
}

export default function LogsPanel({ logs }) {
  const visibleLogs = logs.slice(0, 12);

  return (
    <section className="events-panel">
      <div className="events-head">
        <div>
          <span className="events-kicker">
            <Radio size={15} />
            متابعة مباشرة
          </span>

          <h2>سجل أحداث النظام</h2>

          <p>
            يعرض آخر العمليات التي تمت داخل المركز مثل استقبال الطلبات،
            تعيين الفنيين، وتحديث حالة التتبع.
          </p>
        </div>

        <div className="events-count">
          <b>{visibleLogs.length}</b>
          <span>حدث</span>
        </div>
      </div>

      <div className="events-list">
        {visibleLogs.length === 0 ? (
          <div className="events-empty">
            <Radio size={34} />
            <h3>لا توجد أحداث حالية</h3>
            <p>ستظهر هنا أي عملية جديدة تتم داخل النظام.</p>
          </div>
        ) : (
          visibleLogs.map((log) => {
            const meta = getLogMeta(log.text);
            const Icon = meta.icon;

            return (
              <article
                key={log.id}
                className={`event-item ${meta.className}`}
              >
                <div className="event-icon">
                  <Icon size={16} strokeWidth={2.5} />
                </div>

                <div className="event-body">
                  <div className="event-top">
                    <span className="event-label">{meta.label}</span>

                    <span className="event-time">
                      <Clock3 size={13} />
                      {log.time}
                    </span>
                  </div>

                  <p>{log.text}</p>
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}