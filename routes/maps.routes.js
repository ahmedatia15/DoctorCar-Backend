// PATH: backend/routes/maps.routes.js
import express from "express";
import axios from "axios";

const router = express.Router();

router.get("/directions", async (req, res) => {
  try {
    const { origin, destination, mode = "driving" } = req.query;

    if (!origin || !destination) {
      return res.status(400).json({
        status: "BAD_REQUEST",
        message: "origin and destination are required",
      });
    }

    const key = process.env.GOOGLE_SERVER_MAPS_KEY || "";

    if (!key) {
      return res.status(500).json({
        status: "SERVER_KEY_MISSING",
        message: "GOOGLE_SERVER_MAPS_KEY is missing in .env",
      });
    }

    const response = await axios.get(
      "https://maps.googleapis.com/maps/api/directions/json",
      {
        params: {
          origin,
          destination,
          mode,
          alternatives: "false",
          departure_time: "now",
          traffic_model: "best_guess",
          language: "ar",
          region: "eg",
          key,
        },
        timeout: 10000,
      }
    );

    return res.json(response.data);
  } catch (error) {
    return res.status(500).json({
      status: "SERVER_ERROR",
      message: error.message,
      details: error.response?.data ?? null,
    });
  }
});

export default router;