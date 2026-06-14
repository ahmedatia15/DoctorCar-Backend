import {
  Bell,
  Car,
  ChevronLeft,
  Code2,
  Gauge,
  Headset,
  MapPinned,
  Settings,
  ShieldCheck,
  Users,
  Wifi,
  WifiOff,
} from "lucide-react";

export default function Sidebar({
  connected,
  selectedOrder,
  setTrackingFullScreen,
  showToast,
  onOpenDeveloperTools,
}) {
  const navItems = [
    {
      label: "لوحة التحكم",
      icon: Gauge,
      active: true,
    },
    {
      label: "الطلبات",
      icon: Headset,
    },
    {
      label: "الفنيين",
      icon: Users,
    },
    {
      label: "التتبع المباشر",
      icon: MapPinned,
      onClick: () => {
        if (selectedOrder) setTrackingFullScreen(true);
        else showToast("اختار طلب الأول", "danger");
      },
    },
    {
      label: "الإشعارات",
      icon: Bell,
    },
    {
      label: "الإعدادات",
      icon: Settings,
    },
  ];

  return (
    <aside className="side">
      <div className="brand">
        <div className="logo">
          <Car size={28} strokeWidth={2.7} />
        </div>

        <div>
          <h2>Doctor Car</h2>
          <p>مركز إدارة الطلبات</p>
        </div>
      </div>

      <div
        className={
          connected
            ? "side-status status-online"
            : "side-status status-offline"
        }
      >
        <div className="status-icon">
          {connected ? <Wifi size={22} /> : <WifiOff size={22} />}
        </div>

        <div>
          <b>{connected ? "متصل" : "غير متصل"}</b>
          <p>{connected ? "النظام يعمل الآن" : "جاري إعادة الاتصال"}</p>
        </div>
      </div>

      <nav className="side-nav">
        {navItems.map((item) => {
          const Icon = item.icon;

          return (
            <button
              key={item.label}
              className={item.active ? "nav-active" : ""}
              onClick={item.onClick || undefined}
              type="button"
            >
              <span className="nav-icon">
                <Icon size={21} strokeWidth={2.5} />
              </span>

              <span className="nav-label">{item.label}</span>

              <ChevronLeft className="nav-arrow" size={18} strokeWidth={2.5} />
            </button>
          );
        })}
      </nav>

      <div className="side-footer">
        <div className="side-footer-icon">
          <ShieldCheck size={22} />
        </div>

        <div>
          <b>مركز آمن</b>
          <p>لوحة تشغيل داخلية</p>
        </div>
      </div>

      <button
        type="button"
        className="developer-tools-btn"
        onClick={onOpenDeveloperTools}
      >
        <span className="nav-icon">
          <Code2 size={21} strokeWidth={2.5} />
        </span>

        <span>
          <b>أدوات المطور</b>
          <small>اختبارات وتجارب فقط</small>
        </span>
      </button>
    </aside>
  );
}