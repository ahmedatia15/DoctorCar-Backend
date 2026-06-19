import {
  AlertTriangle,
  Building2,
  CircleDot,
  RefreshCw,
  Wifi,
  WifiOff,
} from "lucide-react";

import { CENTER_ID } from "../config";

export default function Header({
  connected,
  totalOrders = 0,
  liveCount = 0,
  emergencyCount = 0,
  loading = false,
  onRefresh,
  lastUpdated,
}) {
  const updatedLabel = lastUpdated
    ? new Date(lastUpdated).toLocaleTimeString("ar-EG", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : "—";

  return (
    <header className="dash-header">
      <div className="dash-header-main">
        <div className="dash-header-title">
          <span className="dash-header-kicker">
            <Building2 size={14} />
            لوحة المركز
          </span>
          <h1>غرفة عمليات Doctor Car</h1>
          <p>إدارة طلبات المساعدة والبلاغات الطارئة وتعيين الفنيين.</p>
        </div>

        <div className="dash-header-side">
          <div
            className={`dash-chip ${connected ? "ok" : "bad"}`}
            title="حالة الاتصال بالسيرفر"
          >
            {connected ? <Wifi size={14} /> : <WifiOff size={14} />}
            <span>{connected ? "متصل" : "غير متصل"}</span>
          </div>

          <div className="dash-chip neutral">
            <CircleDot size={12} />
            <span>{CENTER_ID}</span>
          </div>

          <button
            type="button"
            className="dash-refresh-btn"
            onClick={onRefresh}
            disabled={loading || !onRefresh}
          >
            <RefreshCw size={15} className={loading ? "spin" : ""} />
            {loading ? "جاري التحديث" : "تحديث الطلبات"}
          </button>
        </div>
      </div>

      <div className="dash-header-meta">
        <div className="dash-meta-item">
          <span>إجمالي</span>
          <b>{totalOrders}</b>
        </div>
        <div className="dash-meta-item live">
          <span>تتبع مباشر</span>
          <b>{liveCount}</b>
        </div>
        <div className={`dash-meta-item ${emergencyCount > 0 ? "danger" : ""}`}>
          <span>
            <AlertTriangle size={12} /> بلاغات عاجلة
          </span>
          <b>{emergencyCount}</b>
        </div>
        <div className="dash-meta-item subtle">
          <span>آخر تحديث</span>
          <b>{updatedLabel}</b>
        </div>
      </div>
    </header>
  );
}
