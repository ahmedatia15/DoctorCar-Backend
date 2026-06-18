import {
  Car,
  CheckCircle2,
  ChevronRight,
  MapPinned,
  Navigation,
  Play,
  Radio,
  Route,
  ShieldAlert,
  UserRoundCog,
  XCircle,
} from "lucide-react";

import TrackingMap from "./TrackingMap";
import TrackingInfo from "./TrackingInfo";

import {
  canAssign,
  isEmergency,
  orderId,
  orderStatus,
  shortId,
  statusLabels,
} from "../utils/orderHelpers";

const FINISHED_STATUSES = ["arrived", "completed", "canceled", "cancelled"];

export default function FullTracking({
  toast,
  connected,
  selectedOrder,
  technicianId,
  setTechnicianId,
  setTrackingFullScreen,
  assignTechnician,
  sendOrderOnTheWay,
  testTechnicianMove,
  autoMove,
  setAutoMove,
  isLoaded,
  mapCenter,
  customerLocation,
  technicianLocation,
  currentDistanceKm,
  currentEta,
  mapRef,
  fullMapRef,
}) {
  const id = orderId(selectedOrder);
  const status = orderStatus(selectedOrder);
  const emergency = isEmergency(selectedOrder);
  const finished = FINISHED_STATUSES.includes(status);

  return (
    <div
      className={`uber-tracking-page ${emergency ? "emergency-full-page" : ""}`}
      dir="rtl"
    >
      {toast && <div className={`toast ${toast.type}`}>{toast.message}</div>}

      <div className="uber-topbar">
        <button
          className="uber-back-btn"
          onClick={() => setTrackingFullScreen(false)}
        >
          <ChevronRight size={20} strokeWidth={2.6} />
          <span>رجوع للطلبات</span>
        </button>

        <div className={connected ? "uber-live-pill on" : "uber-live-pill off"}>
          <span />
          {connected ? "Online" : "Offline"}
        </div>
      </div>

      <section className="uber-tracking-shell">
        <div className="uber-map-area">
          <TrackingMap
            big
            isLoaded={isLoaded}
            selectedOrder={selectedOrder}
            mapCenter={mapCenter}
            customerLocation={customerLocation}
            technicianLocation={finished ? null : technicianLocation}
            mapRef={mapRef}
            fullMapRef={fullMapRef}
          />
        </div>

        <aside className="uber-control-panel">
          <div className="uber-panel-head">
            <div className={emergency ? "uber-panel-icon danger" : "uber-panel-icon"}>
              {emergency ? <ShieldAlert size={26} /> : <Navigation size={26} />}
            </div>

            <div>
              <h1>{emergency ? "Emergency Tracking" : "Live Tracking"}</h1>
              <p>
                الطلب #{shortId(id)} • {statusLabels[status] || status}
              </p>
            </div>
          </div>

          {emergency && (
            <div className="full-emergency-alert">
              <ShieldAlert size={18} />
              <div>
                <b>بلاغ حادث بأولوية قصوى</b>
                <span>راجع الموقع والملاحظات والمرفقات قبل تعيين الفني.</span>
              </div>
            </div>
          )}

          {finished && (
            <div className="full-finished-alert">
              {status === "completed" || status === "arrived" ? (
                <CheckCircle2 size={18} />
              ) : (
                <XCircle size={18} />
              )}
              <div>
                <b>تم إيقاف التتبع</b>
                <span>{statusLabels[status] || status}</span>
              </div>
            </div>
          )}

          <div className="uber-route-summary">
            <div>
              <Route size={20} />
              <span>المسافة</span>
              <b>{technicianLocation && !finished ? `${currentDistanceKm} كم` : "-"}</b>
            </div>

            <div>
              <Car size={20} />
              <span>الوصول</span>
              <b>{technicianLocation && !finished ? `${currentEta} دقيقة` : "-"}</b>
            </div>
          </div>

          <label className="uber-tech-input">
            <span>
              <UserRoundCog size={16} />
              ID الفني
            </span>

            <input
              value={technicianId}
              onChange={(e) => setTechnicianId(e.target.value)}
              placeholder="مثال: tech1"
              disabled={finished}
            />
          </label>

          <div className="uber-actions">
            <button
              className={emergency ? "uber-primary danger" : "uber-primary"}
              disabled={!canAssign(selectedOrder)}
              onClick={() => assignTechnician(selectedOrder)}
            >
              <UserRoundCog size={18} />
              {emergency ? "استلام البلاغ / تعيين فني" : "تعيين / تغيير فني"}
            </button>

            <button
              disabled={finished}
              onClick={() => sendOrderOnTheWay(selectedOrder)}
            >
              <Navigation size={18} />
              بدء الطريق
            </button>

            <button disabled={finished} onClick={testTechnicianMove}>
              <MapPinned size={18} />
              تحريك الفني تجربة
            </button>

            <button
              disabled={finished}
              className={autoMove ? "uber-warning" : ""}
              onClick={() => setAutoMove((v) => !v)}
            >
              {autoMove ? <Radio size={18} /> : <Play size={18} />}
              {autoMove ? "إيقاف الحركة" : "تشغيل حركة لايف"}
            </button>
          </div>

          <TrackingInfo
            selectedOrder={selectedOrder}
            technicianLocation={finished ? null : technicianLocation}
            currentDistanceKm={finished ? "-" : currentDistanceKm}
            currentEta={finished ? "-" : currentEta}
          />
        </aside>
      </section>
    </div>
  );
}