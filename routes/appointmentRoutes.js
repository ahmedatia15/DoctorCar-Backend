// PATH: backend/routes/appointmentRoutes.js
import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  createAppointment,
  getMyAppointments,
  getCenterAppointments,
  cancelAppointment,
} from "../controllers/appointmentController.js";

const router = express.Router();

// Dashboard-side listing (internal). Not user-scoped, so it must NOT sit
// behind `protect`. Keep it ABOVE the protect middleware below.
router.get("/center", getCenterAppointments);

router.use(protect);

router.post("/", createAppointment);
router.get("/my", getMyAppointments);
router.patch("/:id/cancel", cancelAppointment);

export default router;
