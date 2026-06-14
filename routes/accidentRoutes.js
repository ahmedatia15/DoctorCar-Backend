import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import Accident from "../models/accidentModel.js";

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadsRoot = path.join(__dirname, "..", "uploads");
const accidentImagesDir = path.join(uploadsRoot, "accidents", "images");
const accidentAudioDir = path.join(uploadsRoot, "accidents", "audio");

fs.mkdirSync(accidentImagesDir, { recursive: true });
fs.mkdirSync(accidentAudioDir, { recursive: true });

function safeName(file) {
  const ext = path.extname(file.originalname || "");
  return `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
}

function fileUrl(req, file, folder) {
  return `${req.protocol}://${req.get("host")}/uploads/accidents/${folder}/${file.filename}`;
}

const uploadImages = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, accidentImagesDir),
    filename: (req, file, cb) => cb(null, safeName(file)),
  }),
  limits: { files: 4, fileSize: 8 * 1024 * 1024 },
});

const uploadAudio = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, accidentAudioDir),
    filename: (req, file, cb) => cb(null, safeName(file)),
  }),
  limits: { files: 1, fileSize: 20 * 1024 * 1024 },
});

function asArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
    return value.trim() ? [value.trim()] : [];
  }
  return [];
}

function normalizeEmergencyBody(body = {}) {
  return {
    lat: Number(body.lat),
    lng: Number(body.lng),
    address: body.address || "",
    notes: body.notes || "",
    imageUrls: asArray(body.imageUrls),
    audioUrl: body.audioUrl || "",
    emergencyContactName: body.emergencyContactName || "",
    emergencyContactPhone: body.emergencyContactPhone || "",
    serviceType: body.serviceType || "accident",
    serviceName: body.serviceName || body.serviceType || "accident",
    vehicleId: body.vehicleId || undefined,
    status: body.status || "pending",
    priority: body.priority || "high",
    type: body.type || "emergency",
  };
}

function accidentToCenterOrder(accident) {
  const a = accident?.toObject ? accident.toObject() : accident;
  const id = String(a._id || a.id || a.orderId || "");

  return {
    ...a,
    _id: id,
    id,
    orderId: id,

    type: a.type || "emergency",
    priority: a.priority || "high",

    serviceType: a.serviceType || "accident",
    serviceName: a.serviceName || a.serviceType || "accident",

    status: a.status || "pending",

    userName: a.customerName || a.emergencyContactName || "بلاغ طوارئ",
    customerName: a.customerName || a.emergencyContactName || "بلاغ طوارئ",

    emergencyContactName: a.emergencyContactName || "",
    emergencyContactPhone: a.emergencyContactPhone || "",

    notes: a.notes || "",
    imageUrls: a.imageUrls || [],
    audioUrl: a.audioUrl || "",

    customerLocation: {
      lat: Number(a.lat),
      lng: Number(a.lng),
      address: a.address || "",
    },
    location: {
      lat: Number(a.lat),
      lng: Number(a.lng),
      address: a.address || "",
    },
    pickupLocation: {
      lat: Number(a.lat),
      lng: Number(a.lng),
      address: a.address || "",
    },

    createdAt: a.createdAt || new Date().toISOString(),
  };
}

function emitAccidentToCenter(req, accident) {
  const payload = accidentToCenterOrder(accident);

  req.emitAccidentToCenters?.(accident);

  req.io?.to("centers").emit("order:new", payload);
  req.io?.to("centers").emit("accident:new", payload);
  req.io?.to("centers").emit("order:updated", payload);

  console.log(`🚨 Accident emitted to center dashboard: ${payload._id}`);
}

/**
 * POST /api/accidents
 */
router.post("/", async (req, res) => {
  try {
    const payload = normalizeEmergencyBody({
      ...req.body,
      type: req.body.type || "normal",
    });

    if (!Number.isFinite(payload.lat) || !Number.isFinite(payload.lng)) {
      return res.status(400).json({
        success: false,
        error: true,
        message: "Latitude and longitude are required",
      });
    }

    const accident = await Accident.create(payload);
    emitAccidentToCenter(req, accident);

    res.status(201).json({
      success: true,
      error: false,
      message: "Accident saved successfully",
      data: accident,
      accident,
      order: accidentToCenterOrder(accident),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: true,
      message: "Error saving accident",
      details: error.message,
    });
  }
});

/**
 * POST /api/accidents/upload-images
 */
router.post("/upload-images", uploadImages.array("images", 4), async (req, res) => {
  try {
    const urls = (req.files || []).map((file) => fileUrl(req, file, "images"));

    res.status(201).json({
      success: true,
      error: false,
      message: "Images uploaded successfully",
      urls,
      imageUrls: urls,
      files: urls,
      data: { urls, imageUrls: urls, files: urls },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: true,
      message: "Error uploading images",
      details: error.message,
    });
  }
});

/**
 * POST /api/accidents/upload-audio
 */
router.post("/upload-audio", uploadAudio.single("audio"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: true,
        message: "Audio file is required",
      });
    }

    const url = fileUrl(req, req.file, "audio");

    res.status(201).json({
      success: true,
      error: false,
      message: "Audio uploaded successfully",
      url,
      audioUrl: url,
      file: url,
      data: { url, audioUrl: url, file: url },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: true,
      message: "Error uploading audio",
      details: error.message,
    });
  }
});

/**
 * POST /api/accidents/emergency
 */
router.post("/emergency", async (req, res) => {
  try {
    const payload = normalizeEmergencyBody(req.body);

    if (!Number.isFinite(payload.lat) || !Number.isFinite(payload.lng)) {
      return res.status(400).json({
        success: false,
        error: true,
        message: "Latitude and longitude are required",
      });
    }

    const accident = await Accident.create(payload);
    emitAccidentToCenter(req, accident);

    res.status(201).json({
      success: true,
      error: false,
      message: "Emergency accident created successfully",
      data: accident,
      accident,
      order: accidentToCenterOrder(accident),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: true,
      message: "Error creating emergency accident",
      details: error.message,
    });
  }
});

/**
 * POST /api/accidents/notify
 */
router.post("/notify", async (req, res) => {
  try {
    req.io?.to("centers").emit("accident:notify", {
      ...req.body,
      at: Date.now(),
    });

    res.json({
      success: true,
      error: false,
      message: "Emergency notification received",
      data: req.body,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: true,
      message: "Error sending notification",
      details: error.message,
    });
  }
});

export default router;