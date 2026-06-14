import express from "express";
import { estimateOrder } from "../controllers/orderEstimate.controller.js";

const router = express.Router();
router.post("/estimate", estimateOrder);

export default router;
