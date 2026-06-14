import { useEffect, useMemo, useRef, useState } from "react";
import {
  DirectionsRenderer,
  GoogleMap,
  Marker,
  OverlayView,
} from "@react-google-maps/api";
import {
  CheckCircle2,
  Clock3,
  MapPinned,
  Navigation,
  Route,
  ShieldAlert,
  UserRound,
  XCircle,
} from "lucide-react";

import {
  isEmergency,
  orderStatus,
  statusLabels,
} from "../utils/orderHelpers";

const mapContainerStyle = {
  width: "100%",
  height: "100%",
  borderRadius: "24px",
};

const darkMapStyle = [
  { elementType: "geometry", stylers: [{ color: "#0b1220" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#cbd5e1" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#020617" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#1e293b" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#334155" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#2563eb" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0f172a" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
];

const finishedStatuses = [
  "arrived",
  "completed",
  "canceled",
  "cancelled",
  "وصل",
  "مكتمل",
  "ملغي",
];

function safePosition(position) {
  if (!position) return null;

  const lat = Number(position.lat);
  const lng = Number(position.lng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat === 0 && lng === 0) return null;

  return { lat, lng };
}

function metersBetween(a, b) {
  const p1 = safePosition(a);
  const p2 = safePosition(b);

  if (!p1 || !p2 || !window.google) return Infinity;

  return window.google.maps.geometry?.spherical
    ? window.google.maps.geometry.spherical.computeDistanceBetween(
        new window.google.maps.LatLng(p1.lat, p1.lng),
        new window.google.maps.LatLng(p2.lat, p2.lng)
      )
    : Math.sqrt(
        Math.pow(p1.lat - p2.lat, 2) + Math.pow(p1.lng - p2.lng, 2)
      ) * 111000;
}

function MarkerBubble({ position, type, title, subtitle, emergency }) {
  const safe = safePosition(position);
  if (!safe) return null;

  return (
    <OverlayView position={safe} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
      <div className={`map-marker-bubble ${type} ${emergency ? "emergency" : ""}`}>
        <div className="map-marker-icon">
          {type === "customer" ? (
            emergency ? <ShieldAlert size={18} /> : <UserRound size={18} />
          ) : (
            <Navigation size={18} />
          )}
        </div>

        <div className="map-marker-text">
          <b>{title}</b>
          <span>{subtitle}</span>
        </div>
      </div>
    </OverlayView>
  );
}

export default function TrackingMap({
  big = false,
  isLoaded,
  selectedOrder,
  mapCenter,
  customerLocation,
  technicianLocation,
  mapRef,
  fullMapRef,
}) {
  const [directions, setDirections] = useState(null);
  const [routeInfo, setRouteInfo] = useState(null);
  const [routeStatus, setRouteStatus] = useState("");
  const [initialCenter, setInitialCenter] = useState(null);

  const lastRoutePointRef = useRef(null);
  const directionsTimerRef = useRef(null);

  const status = selectedOrder ? orderStatus(selectedOrder) : "";
  const emergency = selectedOrder ? isEmergency(selectedOrder) : false;
  const trackingFinished = finishedStatuses.includes(status);

  const customer = safePosition(customerLocation);
  const technician = trackingFinished ? null : safePosition(technicianLocation);
  const fallbackCenter = safePosition(mapCenter) || customer || { lat: 30.0444, lng: 31.2357 };

  const canShowLiveRoute =
    isLoaded &&
    !trackingFinished &&
    customer &&
    technician &&
    window.google;

  const selectedKey = useMemo(() => {
    return String(selectedOrder?._id || selectedOrder?.id || selectedOrder?.orderId || "");
  }, [selectedOrder]);

  useEffect(() => {
    setInitialCenter(fallbackCenter);
    lastRoutePointRef.current = null;
    setDirections(null);
    setRouteInfo(null);
    setRouteStatus("");
  }, [selectedKey]);

  useEffect(() => {
    if (!canShowLiveRoute) {
      setDirections(null);
      setRouteInfo(null);
      setRouteStatus(trackingFinished ? "FINISHED" : "");
      return;
    }

    const moved = metersBetween(lastRoutePointRef.current, technician);

    if (lastRoutePointRef.current && moved < 80) {
      return;
    }

    lastRoutePointRef.current = technician;

    if (directionsTimerRef.current) {
      window.clearTimeout(directionsTimerRef.current);
    }

    directionsTimerRef.current = window.setTimeout(() => {
      const service = new window.google.maps.DirectionsService();

      service.route(
        {
          origin: technician,
          destination: customer,
          travelMode: window.google.maps.TravelMode.DRIVING,
          provideRouteAlternatives: false,
        },
        (result, routeResultStatus) => {
          if (routeResultStatus === "OK" && result) {
            const leg = result.routes?.[0]?.legs?.[0];

            setDirections(result);
            setRouteStatus("OK");
            setRouteInfo({
              distance: leg?.distance?.text || "",
              duration: leg?.duration?.text || "",
            });
          } else {
            setDirections(null);
            setRouteInfo(null);
            setRouteStatus(routeResultStatus || "ERROR");
          }
        }
      );
    }, 700);

    return () => {
      if (directionsTimerRef.current) {
        window.clearTimeout(directionsTimerRef.current);
      }
    };
  }, [
    canShowLiveRoute,
    selectedKey,
    technician?.lat,
    technician?.lng,
    customer?.lat,
    customer?.lng,
  ]);

  if (!selectedOrder) {
    return (
      <div className="empty-box premium-map-empty">
        <MapPinned size={36} />
        <h3>اختر طلب</h3>
        <p>اختار طلب من القائمة عشان يظهر التتبع المباشر.</p>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="empty-box premium-map-empty">
        <Route size={36} />
        <h3>جاري تحميل الخريطة</h3>
        <p>بنجهز Google Maps والتتبع اللحظي.</p>
      </div>
    );
  }

  return (
    <div className="uber-map-shell">
<GoogleMap
  key={selectedKey}
  mapContainerStyle={big ? { width: "100%", height: "100%" } : mapContainerStyle}
  center={customer || fallbackCenter}
  zoom={15}
onLoad={(map) => {
  if (big) fullMapRef.current = map;
  else mapRef.current = map;

  const center = customer || fallbackCenter;
  if (center) {
    map.setCenter(center);
    map.setZoom(15);
  }
}}
        options={{
          styles: darkMapStyle,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
          clickableIcons: false,
          gestureHandling: "greedy",
          zoomControlOptions: {
            position: window.google?.maps?.ControlPosition?.LEFT_BOTTOM,
          },
        }}
      >
        {customer && (
          <>
            <Marker position={customer} opacity={0} />
            <MarkerBubble
              position={customer}
              type="customer"
              emergency={emergency}
              title={emergency ? "موقع الحادث" : "العميل"}
              subtitle={emergency ? "بلاغ طوارئ" : "موقع الطلب"}
            />
          </>
        )}

        {technician && (
          <>
            <Marker position={technician} opacity={0} />
            <MarkerBubble
              position={technician}
              type="technician"
              title="الفني"
              subtitle="يتحرك الآن"
            />

            {directions && (
              <DirectionsRenderer
                directions={directions}
                options={{
                  suppressMarkers: true,
                  preserveViewport: true,
                  polylineOptions: {
                    strokeColor: emergency ? "#f43f5e" : "#22d3ee",
                    strokeWeight: big ? 7 : 6,
                    strokeOpacity: 0.95,
                  },
                }}
              />
            )}
          </>
        )}
      </GoogleMap>

      <div className={`map-floating-card ${emergency ? "emergency" : ""}`}>
        <div className="map-floating-icon">
          {trackingFinished ? (
            status === "completed" || status === "arrived" || status === "وصل" ? (
              <CheckCircle2 size={20} />
            ) : (
              <XCircle size={20} />
            )
          ) : emergency ? (
            <ShieldAlert size={20} />
          ) : (
            <Navigation size={20} />
          )}
        </div>

        <div>
          <b>
            {trackingFinished
              ? statusLabels[status] || "تم إنهاء التتبع"
              : emergency
              ? "Emergency Route"
              : "Live Route"}
          </b>

          <span>
            {trackingFinished
              ? "تم إيقاف التتبع المباشر لهذا الطلب"
              : routeInfo
              ? `${routeInfo.distance} • ${routeInfo.duration}`
              : technician
              ? routeStatus && routeStatus !== "OK"
                ? `تعذر حساب الطريق: ${routeStatus}`
                : "جاري حساب الطريق..."
              : "بانتظار موقع الفني"}
          </span>
        </div>
      </div>

      {routeInfo && !trackingFinished && (
        <div className={`map-route-pill ${emergency ? "emergency" : ""}`}>
          <Clock3 size={16} />
          <span>{routeInfo.duration}</span>
        </div>
      )}

      {trackingFinished && (
        <div className="map-route-pill finished">
          {status === "completed" || status === "arrived" || status === "وصل" ? (
            <CheckCircle2 size={16} />
          ) : (
            <XCircle size={16} />
          )}
          <span>{statusLabels[status] || status}</span>
        </div>
      )}
    </div>
  );
}