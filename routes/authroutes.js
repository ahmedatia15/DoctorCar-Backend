// PATH: backend/routes/authroutes.js
// ============================================================
// Auth routes — typed registration + login.
// Delegates to the canonical userController so we keep a single
// registration/validation implementation.
// ============================================================
import express from "express";
import { registerUser, loginUser } from "../controllers/userController.js";
import { rateLimit } from "../utils/rateLimit.js";

const router = express.Router();

const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Too many registration attempts. Please try again later.",
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: "Too many login attempts. Please try again later.",
});

// POST /api/auth/register  (customer | technician)
router.post("/register", registerLimiter, registerUser);

// POST /api/auth/login
router.post("/login", loginLimiter, loginUser);

export default router;
