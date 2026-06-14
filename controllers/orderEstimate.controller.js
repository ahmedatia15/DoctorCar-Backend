// PATH: backend/controllers/orderEstimate.controller.js

/**
 * ======================================================
 * 🧮 Estimate Order (Price + ETA) — Uber-like
 * ======================================================
 */
export const estimateOrder = async (req, res) => {
  try {
    const { serviceType, lat, lng } = req.body;

    // ===============================
    // Validation
    // ===============================
    if (!serviceType || lat == null || lng == null) {
      return res.status(400).json({
        success: false,
        message: "بيانات غير مكتملة",
      });
    }

    /**
     * ===============================
     * Pricing Logic (مبدئي – قابل للتطوير)
     * ===============================
     */
    let basePrice = 0;
    let pricePerKm = 0;

    switch (serviceType) {
      case "tow":
        basePrice = 100;
        pricePerKm = 10;
        break;

      case "battery":
        basePrice = 150;
        pricePerKm = 0;
        break;

      case "fuel":
        basePrice = 80;
        pricePerKm = 0;
        break;

      case "maintenance":
        basePrice = 120;
        pricePerKm = 5;
        break;

      default:
        basePrice = 100;
        pricePerKm = 5;
    }

    /**
     * ===============================
     * ETA Logic (Mock – زي أوبر)
     * ===============================
     */
    const estimatedDistanceKm = 3; // مؤقت (بعدها نربطه بالـ centers)
    const etaMinutes = Math.max(3, Math.ceil(estimatedDistanceKm * 2.5));

    /**
     * ===============================
     * Final Price
     * ===============================
     */
    const totalPrice = basePrice + estimatedDistanceKm * pricePerKm;

    return res.json({
      success: true,
      estimate: {
        serviceType,
        etaMinutes,
        distanceKm: estimatedDistanceKm,
        price: Math.round(totalPrice),
        currency: "EGP",
      },
    });
  } catch (e) {
    console.error("❌ estimateOrder error:", e);
    return res.status(500).json({
      success: false,
      message: "فشل حساب التسعير",
    });
  }
};
