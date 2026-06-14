import { Activity, MapPinned, ShieldCheck } from "lucide-react";

export default function Header() {
  return (
    <header className="hero doctor-header">
      <div className="doctor-header-content">
        <span className="doctor-header-label">لوحة تشغيل المركز</span>

        <h1>غرفة عمليات Doctor Car</h1>

        <p>
          شاشة موحدة لإدارة طلبات المساعدة على الطريق، متابعة حالة كل طلب،
          تعيين الفني المناسب، ومراقبة التتبع المباشر من مكان واحد.
        </p>

        <div className="doctor-header-points">
          <div>
            <Activity size={18} />
            <span>إدارة الطلبات</span>
          </div>

          <div>
            <MapPinned size={18} />
            <span>التتبع المباشر</span>
          </div>

          <div>
            <ShieldCheck size={18} />
            <span>متابعة آمنة ومنظمة</span>
          </div>
        </div>
      </div>
    </header>
  );
}