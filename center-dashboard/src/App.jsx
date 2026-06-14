import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { useJsApiLoader } from "@react-google-maps/api";
import { Code2, Play, Plus, Radio, Route, X } from "lucide-react";

import "./App.css";
import { API_URL, CENTER_ID } from "./config";
import { socket } from "./socket";

import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import StatsCards from "./components/StatsCards";
import OrdersPanel from "./components/OrdersPanel";
import TrackingMap from "./components/TrackingMap";
import TrackingInfo from "./components/TrackingInfo";
import LogsPanel from "./components/LogsPanel";
import FullTracking from "./components/FullTracking";

import {
  assignedTech,
  canAssign,
  customerName,
  isEmergency,
  locationListenEvents,
  orderId,
  orderStatus,
  serviceName,
  shortId,
  upsertOrder,
  waitingStatuses,
} from "./utils/orderHelpers";

import {
  distanceMeters,
  etaMinutes,
  getCustomerLocation,
  getLocationFromPayload,
  joinOrderRoom,
} from "./utils/trackingHelpers";

const FINISHED_STATUSES = [
  "arrived",
  "completed",
  "canceled",
  "cancelled",
  "وصل",
  "مكتمل",
  "ملغي",
];

function isFinished(orderOrStatus) {
  const status =
    typeof orderOrStatus === "string"
      ? orderOrStatus
      : orderStatus(orderOrStatus);

  return FINISHED_STATUSES.includes(String(status || "").trim());
}

function DeveloperToolsDrawer({
  open,
  onClose,
  technicianId,
  setTechnicianId,
  selectedOrder,
  autoMove,
  setAutoMove,
  testTechnicianMove,
  createFakeOrder,
}) {
  if (!open) return null;

  return (
    <div className="dev-drawer-overlay" onClick={onClose}>
      <aside className="dev-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="dev-drawer-head">
          <div>
            <span className="dev-kicker">
              <Code2 size={16} />
              أدوات المطور
            </span>

            <h2>اختبارات النظام</h2>

            <p>
              هذه الأدوات مخصصة للتجربة فقط ولا تظهر للمستخدم العادي داخل لوحة
              التشغيل الرئيسية.
            </p>
          </div>

          <button className="dev-close" type="button" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="dev-selected-order">
          <span>الطلب المحدد حاليًا</span>
          <b>{selectedOrder ? `#${shortId(orderId(selectedOrder))}` : "لا يوجد طلب محدد"}</b>
        </div>

        <label className="dev-field">
          <span>رقم الفني المستخدم في الاختبار</span>

          <input
            value={technicianId}
            onChange={(e) => setTechnicianId(e.target.value)}
            placeholder="مثال: tech1"
          />
        </label>

        <div className="dev-actions">
          <button className="btn soft dev-action" onClick={testTechnicianMove}>
            <Route size={18} />
            <div>
              <b>تحريك الفني مرة واحدة</b>
              <span>إرسال موقع تجربة جديد للفني</span>
            </div>
          </button>

          <button
            className={autoMove ? "btn warning dev-action" : "btn soft dev-action"}
            onClick={() => setAutoMove((value) => !value)}
          >
            {autoMove ? <Radio size={18} /> : <Play size={18} />}

            <div>
              <b>{autoMove ? "إيقاف التتبع التلقائي" : "تشغيل التتبع التلقائي"}</b>
              <span>محاكاة حركة الفني على الخريطة</span>
            </div>
          </button>

          <button className="btn primary dev-action" onClick={createFakeOrder}>
            <Plus size={18} />

            <div>
              <b>إنشاء طلب تجربة</b>
              <span>إضافة طلب جديد لاختبار الواجهة</span>
            </div>
          </button>
        </div>
      </aside>
    </div>
  );
}

export default function App() {
  const mapRef = useRef(null);
  const fullMapRef = useRef(null);
  const moveTimerRef = useRef(null);
  const ordersRef = useRef([]);
  const technicianLocationsRef = useRef({});
  const technicianIdRef = useRef("tech1");

  const [connected, setConnected] = useState(false);
  const [orders, setOrders] = useState([]);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [technicianId, setTechnicianId] = useState("tech1");
  const [logs, setLogs] = useState([]);
  const [technicianLocations, setTechnicianLocations] = useState({});
  const [assigningId, setAssigningId] = useState(null);
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState(null);
  const [trackingFullScreen, setTrackingFullScreen] = useState(false);
  const [autoMove, setAutoMove] = useState(false);
  const [developerToolsOpen, setDeveloperToolsOpen] = useState(false);

  const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey,
    libraries: ["geometry"],
  });

  useEffect(() => {
    ordersRef.current = orders;
  }, [orders]);

  useEffect(() => {
    technicianLocationsRef.current = technicianLocations;
  }, [technicianLocations]);

  useEffect(() => {
    technicianIdRef.current = technicianId;
  }, [technicianId]);

  const selectedOrder = useMemo(() => {
    return orders.find((o) => orderId(o) === selectedOrderId) || null;
  }, [orders, selectedOrderId]);

  const selectedOrderFinished = selectedOrder ? isFinished(selectedOrder) : false;

  const customerLocation = useMemo(() => {
    return getCustomerLocation(selectedOrder);
  }, [selectedOrder]);

  const technicianLocation =
    selectedOrder && !selectedOrderFinished
      ? technicianLocations[orderId(selectedOrder)]
      : null;

  const mapCenter = technicianLocation || customerLocation;

  const currentEta = selectedOrderFinished
    ? "وصل"
    : technicianLocation && customerLocation
    ? etaMinutes(customerLocation, technicianLocation)
    : "-";

  const currentDistanceKm = selectedOrderFinished
    ? "0.00"
    : technicianLocation && customerLocation
    ? (distanceMeters(customerLocation, technicianLocation) / 1000).toFixed(2)
    : "-";

  const stats = useMemo(() => {
    const liveIds = Object.keys(technicianLocations).filter((id) => {
      const order = orders.find((o) => orderId(o) === id);
      return order && !isFinished(order);
    });

    return {
      total: orders.length,
      waiting: orders.filter((o) => waitingStatuses.includes(orderStatus(o))).length,
      assigned: orders.filter((o) =>
        ["assigned", "accepted", "on_the_way", "in_progress"].includes(orderStatus(o))
      ).length,
      live: liveIds.length,
      emergency: orders.filter((o) => isEmergency(o)).length,
    };
  }, [orders, technicianLocations]);

  const filteredOrders = useMemo(() => {
    const q = query.trim().toLowerCase();

    return orders.filter((o) => {
      const st = orderStatus(o);

      const matchesFilter =
        filter === "all" ||
        (filter === "emergency" && isEmergency(o)) ||
        (filter === "waiting" && waitingStatuses.includes(st)) ||
        filter === st;

      const matchesQuery =
        !q ||
        orderId(o).toLowerCase().includes(q) ||
        serviceName(o).toLowerCase().includes(q) ||
        customerName(o).toLowerCase().includes(q) ||
        assignedTech(o).toLowerCase().includes(q) ||
        String(o?.emergencyContactPhone || "").toLowerCase().includes(q) ||
        String(o?.notes || "").toLowerCase().includes(q);

      return matchesFilter && matchesQuery;
    });
  }, [orders, filter, query]);

  function addLog(text) {
    setLogs((prev) => [
      {
        id: `${Date.now()}-${Math.random()}`,
        time: new Date().toLocaleTimeString("ar-EG"),
        text,
      },
      ...prev,
    ]);
  }

  function showToast(message, type = "success") {
    setToast({ message, type });

    window.clearTimeout(window.__doctorCarToastTimer);
    window.__doctorCarToastTimer = window.setTimeout(() => {
      setToast(null);
    }, 3200);
  }

  function stopTrackingForOrder(id) {
    if (!id) return;

    setAutoMove(false);

    if (moveTimerRef.current) {
      window.clearInterval(moveTimerRef.current);
      moveTimerRef.current = null;
    }

    setTechnicianLocations((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  function focusTracking(order) {
    const id = orderId(order);
    if (!id) return;

    joinOrderRoom(id);
    setSelectedOrderId(id);
    setTrackingFullScreen(true);
    addLog(`تم فتح التتبع المباشر للطلب ${shortId(id)}`);
  }

  function fitMap(map, customer, tech) {
    if (!map || !customer || !tech || !window.google) return;

    const bounds = new window.google.maps.LatLngBounds();
    bounds.extend(customer);
    bounds.extend(tech);
    map.fitBounds(bounds, 90);
  }

  useEffect(() => {
    if (!selectedOrder || !customerLocation || !technicianLocation) return;
    if (selectedOrderFinished) return;

    const timer = window.setTimeout(() => {
      fitMap(mapRef.current, customerLocation, technicianLocation);
      fitMap(fullMapRef.current, customerLocation, technicianLocation);
    }, 300);

    return () => window.clearTimeout(timer);
  }, [selectedOrderId, selectedOrderFinished]);

  useEffect(() => {
    const onConnect = () => {
      setConnected(true);
      addLog("تم الاتصال بالسيرفر");

      socket.emit("center:join", { centerId: CENTER_ID });
      socket.emit("center:online", { centerId: CENTER_ID });

      for (const order of ordersRef.current) {
        const id = orderId(order);
        if (id && !isFinished(order)) joinOrderRoom(id);
      }
    };

    const onDisconnect = (reason) => {
      setConnected(false);
      addLog(`تم فصل الاتصال: ${reason || ""}`);
    };

    const onCenterOk = (data) => {
      addLog(`المركز Online: ${data?.centerId || CENTER_ID}`);
    };

    const onNewOrder = (order) => {
      const id = orderId(order);
      if (!id) return;

      setOrders((prev) => upsertOrder(prev, order));
      setSelectedOrderId(id);

      if (!isFinished(order)) joinOrderRoom(id);

      addLog(
        isEmergency(order)
          ? `🚨 وصل بلاغ حادث عاجل: ${shortId(id)}`
          : `وصل طلب جديد: ${shortId(id)}`
      );

      showToast(
        isEmergency(order) ? "🚨 وصل بلاغ حادث عاجل" : "وصل طلب جديد",
        isEmergency(order) ? "danger" : "success"
      );
    };

    const onOrderUpdated = (order) => {
      const id = orderId(order);
      if (!id) return;

      setOrders((prev) => upsertOrder(prev, order));

      if (isFinished(order)) stopTrackingForOrder(id);
      else joinOrderRoom(id);

      addLog(`تم تحديث الطلب: ${shortId(id)}`);
    };

    const onAssignOk = (order) => {
      const id = orderId(order);

      setAssigningId(null);
      setOrders((prev) => upsertOrder(prev, order));
      setSelectedOrderId(id);

      if (!isFinished(order)) joinOrderRoom(id);

      addLog(`تم تعيين الفني بنجاح: ${shortId(id)}`);
      showToast("تم تعيين الفني بنجاح", "success");
    };

    const onAssignFailed = (data) => {
      setAssigningId(null);
      const msg = data?.reason || data?.message || "فشل تعيين الفني";
      addLog(`فشل تعيين الفني: ${msg}`);
      showToast(msg, "danger");
    };

    const onOrderStatus = (data) => {
      const id = String(data?.orderId || data?._id || data?.accidentId || "");
      if (!id) return;

      const newStatus = String(data?.status || "pending").trim();

      setOrders((prev) =>
        prev.map((o) =>
          orderId(o) === id
            ? {
                ...o,
                status: newStatus,
                technicianId: data?.technicianId || o?.technicianId,
                chatId: data?.chatId || o?.chatId,
              }
            : o
        )
      );

      if (isFinished(newStatus)) {
        stopTrackingForOrder(id);
        addLog(`تم إيقاف التتبع للطلب ${shortId(id)}: ${newStatus}`);
      } else {
        joinOrderRoom(id);
      }

      addLog(`تحديث حالة الطلب ${shortId(id)}: ${newStatus}`);
    };

    const onTechLocation = (data) => {
      const parsed = getLocationFromPayload(data);
      if (!parsed) return;

      const order = ordersRef.current.find((o) => orderId(o) === parsed.id);
      if (!order) return;

      if (isFinished(order)) {
        stopTrackingForOrder(parsed.id);
        return;
      }

      setTechnicianLocations((prev) => ({
        ...prev,
        [parsed.id]: {
          lat: parsed.lat,
          lng: parsed.lng,
          bearing: parsed.bearing,
          speed: parsed.speed,
          at: Date.now(),
        },
      }));
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("center:online:ok", onCenterOk);
    socket.on("order:new", onNewOrder);
    socket.on("order:updated", onOrderUpdated);
    socket.on("center:assign-technician:ok", onAssignOk);
    socket.on("center:assign-technician:failed", onAssignFailed);
    socket.on("order:status", onOrderStatus);
    socket.on("orderStatusUpdated", onOrderStatus);
    socket.on("order:accepted", onOrderUpdated);
    socket.on("order:arrived", onOrderStatus);
    socket.on("order:cancelled", onOrderStatus);
    socket.on("order:canceled", onOrderStatus);
    socket.on("order:completed", onOrderStatus);

    for (const event of locationListenEvents) {
      socket.on(event, onTechLocation);
    }

    if (socket.connected) onConnect();

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("center:online:ok", onCenterOk);
      socket.off("order:new", onNewOrder);
      socket.off("order:updated", onOrderUpdated);
      socket.off("center:assign-technician:ok", onAssignOk);
      socket.off("center:assign-technician:failed", onAssignFailed);
      socket.off("order:status", onOrderStatus);
      socket.off("orderStatusUpdated", onOrderStatus);
      socket.off("order:accepted", onOrderUpdated);
      socket.off("order:arrived", onOrderStatus);
      socket.off("order:cancelled", onOrderStatus);
      socket.off("order:canceled", onOrderStatus);
      socket.off("order:completed", onOrderStatus);

      for (const event of locationListenEvents) {
        socket.off(event, onTechLocation);
      }
    };
  }, []);

  useEffect(() => {
    if (!autoMove || !selectedOrder || selectedOrderFinished) {
      if (moveTimerRef.current) {
        window.clearInterval(moveTimerRef.current);
        moveTimerRef.current = null;
      }

      if (selectedOrderFinished) setAutoMove(false);
      return;
    }

    moveTimerRef.current = window.setInterval(() => {
      sendTestTechnicianLocation(selectedOrder, false);
    }, 1200);

    return () => {
      if (moveTimerRef.current) {
        window.clearInterval(moveTimerRef.current);
        moveTimerRef.current = null;
      }
    };
  }, [autoMove, selectedOrder, selectedOrderFinished, technicianId]);

  async function createFakeOrder() {
    try {
      const res = await axios.post(`${API_URL}/api/test/fake-order`);
      const id = orderId(res.data?.order);

      addLog(`تم إنشاء طلب تجربة: ${shortId(id)}`);
      showToast("تم إنشاء طلب تجربة", "success");
    } catch {
      addLog("فشل إنشاء طلب تجربة");
      showToast("تأكد أن السيرفر شغال على port 5555", "danger");
    }
  }

  function assignTechnician(order) {
    const id = orderId(order);

    if (!technicianId.trim()) {
      showToast("اكتب ID الفني الحقيقي من أدوات المطور", "danger");
      return;
    }

    if (!canAssign(order)) {
      showToast("لا يمكن تعيين فني لطلب مكتمل أو ملغي", "danger");
      return;
    }

    setAssigningId(id);
    joinOrderRoom(id);

    socket.emit("center:assign-technician", {
      orderId: id,
      technicianId: technicianId.trim(),
      centerId: CENTER_ID,
    });

    addLog(`جاري تعيين الفني ${technicianId} للطلب ${shortId(id)}`);
  }

  function sendOrderOnTheWay(order) {
    const id = orderId(order);
    if (!id) return;

    if (isFinished(order)) {
      stopTrackingForOrder(id);
      showToast("لا يمكن تشغيل التتبع لطلب منتهي", "danger");
      return;
    }

    socket.emit("order:on_the_way", {
      orderId: id,
      technicianId: technicianIdRef.current.trim() || "tech1",
    });

    setOrders((prev) =>
      prev.map((o) => (orderId(o) === id ? { ...o, status: "on_the_way" } : o))
    );

    joinOrderRoom(id);
    addLog(`تم تحويل الطلب إلى في الطريق: ${shortId(id)}`);
  }

  function sendTestTechnicianLocation(order, showUi = true) {
    if (!order) return;

    const id = orderId(order);

    if (isFinished(order)) {
      stopTrackingForOrder(id);
      if (showUi) showToast("التتبع متوقف لأن الفني وصل أو الطلب انتهى", "danger");
      return;
    }

    const customer = getCustomerLocation(order);
    if (!customer) {
      showToast("لا يوجد موقع عميل لهذا الطلب", "danger");
      return;
    }

    const last = technicianLocationsRef.current[id];

    const baseLat = last?.lat ?? customer.lat + 0.012;
    const baseLng = last?.lng ?? customer.lng + 0.012;

    const nextLat =
      baseLat + (customer.lat - baseLat) * 0.18 + (Math.random() - 0.5) * 0.0008;

    const nextLng =
      baseLng + (customer.lng - baseLng) * 0.18 + (Math.random() - 0.5) * 0.0008;

    const payload = {
      orderId: id,
      technicianId: technicianIdRef.current.trim() || "tech1",
      lat: nextLat,
      lng: nextLng,
      latitude: nextLat,
      longitude: nextLng,
      bearing: 90,
      heading: 90,
      speed: 8,
      location: {
        lat: nextLat,
        lng: nextLng,
        latitude: nextLat,
        longitude: nextLng,
        bearing: 90,
        heading: 90,
        speed: 8,
      },
      at: Date.now(),
    };

    joinOrderRoom(id);

    socket.emit("order:technician:location", payload);
    socket.emit("technician:location:update", payload);
    socket.emit("technicianLocationUpdate", payload);
    socket.emit("technician:location:updated", payload);
    socket.emit("technician_location", payload);
    socket.emit("technicianLocation", payload);

    setTechnicianLocations((prev) => ({
      ...prev,
      [id]: {
        lat: nextLat,
        lng: nextLng,
        bearing: 90,
        speed: 8,
        at: Date.now(),
      },
    }));

    if (showUi) {
      showToast("تم إرسال موقع فني تجربة", "success");
      addLog(`تم إرسال موقع فني تجربة للطلب ${shortId(id)}`);
    }
  }

  function testTechnicianMove() {
    if (!selectedOrder) {
      showToast("اختار طلب الأول", "danger");
      return;
    }

    if (selectedOrderFinished) {
      stopTrackingForOrder(orderId(selectedOrder));
      showToast("التتبع متوقف لأن الفني وصل أو الطلب انتهى", "danger");
      return;
    }

    sendTestTechnicianLocation(selectedOrder, true);
  }

  const mapsReady = Boolean(googleMapsApiKey) && isLoaded && !loadError;

  if (trackingFullScreen && selectedOrder) {
    return (
      <FullTracking
        toast={toast}
        connected={connected}
        selectedOrder={selectedOrder}
        technicianId={technicianId}
        setTechnicianId={setTechnicianId}
        setTrackingFullScreen={setTrackingFullScreen}
        assignTechnician={assignTechnician}
        sendOrderOnTheWay={sendOrderOnTheWay}
        testTechnicianMove={testTechnicianMove}
        autoMove={autoMove}
        setAutoMove={setAutoMove}
        isLoaded={mapsReady}
        mapCenter={mapCenter}
        customerLocation={customerLocation}
        technicianLocation={technicianLocation}
        currentDistanceKm={currentDistanceKm}
        currentEta={currentEta}
        mapRef={mapRef}
        fullMapRef={fullMapRef}
      />
    );
  }

  return (
    <div className="premium-dashboard" dir="rtl">
      {toast && <div className={`toast ${toast.type}`}>{toast.message}</div>}

      <DeveloperToolsDrawer
        open={developerToolsOpen}
        onClose={() => setDeveloperToolsOpen(false)}
        technicianId={technicianId}
        setTechnicianId={setTechnicianId}
        selectedOrder={selectedOrder}
        autoMove={autoMove}
        setAutoMove={setAutoMove}
        testTechnicianMove={testTechnicianMove}
        createFakeOrder={createFakeOrder}
      />

      <main className="content">
        <Header />

        <StatsCards stats={stats} />

        <section className="layout">
          <OrdersPanel
            filteredOrders={filteredOrders}
            selectedOrderId={selectedOrderId}
            setSelectedOrderId={setSelectedOrderId}
            filter={filter}
            setFilter={setFilter}
            query={query}
            setQuery={setQuery}
            assigningId={assigningId}
            assignTechnician={assignTechnician}
            sendOrderOnTheWay={sendOrderOnTheWay}
            focusTracking={focusTracking}
          />

          <div className="panel map-panel">
            <div className="panel-head">
              <div>
                <h2>
                  {selectedOrder && isEmergency(selectedOrder)
                    ? "تتبع بلاغ طارئ"
                    : "التتبع المباشر"}
                </h2>

                <p>
                  {selectedOrder
                    ? `الطلب #${shortId(orderId(selectedOrder))}`
                    : "اختر طلبًا من القائمة لعرض موقع العميل والفني على الخريطة"}
                </p>
              </div>
            </div>

            <div className="map-wrap">
              {!googleMapsApiKey ? (
                <div className="empty-box">
                  ضيف VITE_GOOGLE_MAPS_API_KEY في ملف .env
                </div>
              ) : loadError ? (
                <div className="empty-box">في مشكلة في تحميل Google Maps</div>
              ) : (
                <TrackingMap
                  isLoaded={mapsReady}
                  selectedOrder={selectedOrder}
                  mapCenter={mapCenter}
                  customerLocation={customerLocation}
                  technicianLocation={technicianLocation}
                  mapRef={mapRef}
                  fullMapRef={fullMapRef}
                />
              )}
            </div>

            <TrackingInfo
              selectedOrder={selectedOrder}
              technicianLocation={technicianLocation}
              currentDistanceKm={currentDistanceKm}
              currentEta={currentEta}
            />
          </div>

          <LogsPanel logs={logs} />
        </section>
      </main>

      <Sidebar
        connected={connected}
        selectedOrder={selectedOrder}
        setTrackingFullScreen={setTrackingFullScreen}
        showToast={showToast}
        onOpenDeveloperTools={() => setDeveloperToolsOpen(true)}
      />
    </div>
  );
}