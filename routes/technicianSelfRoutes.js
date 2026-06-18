// PATH: backend/routes/technicianSelfRoutes.js
import express from "express";
import { technicianOnly } from "../middleware/technicianOnly.js";
import {
  getMe,
  updateProfile,
  updateAvailability,
  updateLocation,
  getMyJobs,
  getMyJobById,
  acceptJob,
  markOnTheWay,
  markArrived,
  completeJob,
  getMyHistory,
  getMyEarnings,
} from "../controllers/technicianSelfController.js";

const router = express.Router();

router.use(technicianOnly);

router.get("/", getMe);
router.patch("/profile", updateProfile);
router.patch("/availability", updateAvailability);
router.patch("/location", updateLocation);

router.get("/jobs", getMyJobs);
router.get("/jobs/:id", getMyJobById);

router.put("/jobs/:id/accept", acceptJob);
router.put("/jobs/:id/on-the-way", markOnTheWay);
router.put("/jobs/:id/arrived", markArrived);
router.put("/jobs/:id/complete", completeJob);

router.get("/history", getMyHistory);
router.get("/earnings", getMyEarnings);

export default router;
