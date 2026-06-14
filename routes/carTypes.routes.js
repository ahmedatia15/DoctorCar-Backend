// 📁 backend/routes/carTypes.routes.js

import express from "express";
import {
  getCarBrands,
  getModelsByBrand,
  getYearsByBrandModel,
} from "../controllers/carTypes.controller.js";

const router = express.Router();

// 🟦 جلب الماركات
router.get("/brands", getCarBrands);

// 🟩 جلب الموديلات حسب الماركة
router.get("/models/:brand", getModelsByBrand);

// 🟧 جلب سنوات التصنيع حسب الماركة والموديل
router.get("/years/:brand/:model", getYearsByBrandModel);

export default router;
