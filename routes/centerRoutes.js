// PATH: backend/routes/centerRoutes.js
import express from "express";
import {
  getNearbyCenters,
  importDamiettaCenters,
  importCentersManual,
} from "../controllers/centerController.js";
import {
  getMaintenanceCenters,
  getCenterById,
  getCenterReviews,
  addCenterReview,
} from "../controllers/centerMaintenanceController.js";
import { protect, authorize } from "../middleware/authMiddleware.js";

const router = express.Router();

// ✅ GET nearby centers (used by Flutter)
router.get("/nearby", getNearbyCenters);

// ✅ Maintenance centers (DB-backed, filtered by ?service=)
router.get("/maintenance", getMaintenanceCenters);

// ✅ OPTIONAL (Google Places) - will fail without Billing — admin only
router.post(
  "/import/damietta",
  protect,
  authorize("admin"),
  importDamiettaCenters
);

// ✅ Manual import (no Google needed) — admin only
router.post(
  "/import/manual",
  protect,
  authorize("admin"),
  importCentersManual
);

// ✅ Per-center reviews (param routes last so they don't shadow the above)
router.get("/:id/reviews", getCenterReviews);
router.post("/:id/reviews", protect, addCenterReview);
router.get("/:id", getCenterById);

export default router;
