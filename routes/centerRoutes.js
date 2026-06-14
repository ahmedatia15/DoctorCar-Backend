// PATH: backend/routes/centerRoutes.js
import express from "express";
import {
  getNearbyCenters,
  importDamiettaCenters,
  importCentersManual,
} from "../controllers/centerController.js";

const router = express.Router();

// ✅ GET nearby centers (used by Flutter)
router.get("/nearby", getNearbyCenters);

// ✅ OPTIONAL (Google Places) - will fail without Billing
router.post("/import/damietta", importDamiettaCenters);

// ✅ BEST OPTION NOW ✅ Manual import (no Google needed)
router.post("/import/manual", importCentersManual);

export default router;
