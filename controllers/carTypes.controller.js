// 📁 backend/controllers/carTypes.controller.js

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const MODELS_FILE = path.join(__dirname, "../data/car_models.json");

// 🟦 1) جلب كل الماركات
export const getCarBrands = async (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(MODELS_FILE));

    // استخراج الماركات فقط
    const brands = data.brands.map((b) => ({
      name: b.name,
    }));

    res.json(brands);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// 🟩 2) جلب الموديلات حسب الماركة
export const getModelsByBrand = async (req, res) => {
  try {
    const brandReq = req.params.brand.toLowerCase();

    const data = JSON.parse(fs.readFileSync(MODELS_FILE));

    const found = data.brands.find(
      (b) => b.name.toLowerCase() === brandReq
    );

    if (!found) return res.json([]);

    res.json(found.models);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// 🟧 3) جلب سنوات التصنيع حسب الماركة والموديل
export const getYearsByBrandModel = async (req, res) => {
  try {
    let years = [];
    for (let i = 2025; i >= 1990; i--) {
      years.push(i.toString());
    }
    res.json(years);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
