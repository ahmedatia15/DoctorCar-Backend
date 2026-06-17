// PATH: backend/routes/storeOrderRoutes.js
import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  createStoreOrder,
  getMyStoreOrders,
} from "../controllers/storeOrderController.js";

const router = express.Router();

router.use(protect);

router.post("/", createStoreOrder);
router.get("/my", getMyStoreOrders);

export default router;
