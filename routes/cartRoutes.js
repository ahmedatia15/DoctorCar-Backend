// PATH: backend/routes/cartRoutes.js
import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  getCart,
  addItem,
  setQty,
  removeItem,
  clearCart,
} from "../controllers/cartController.js";

const router = express.Router();

router.use(protect);

router.get("/", getCart);
router.post("/add", addItem);
router.patch("/item", setQty);
router.delete("/item/:productId", removeItem);
router.delete("/", clearCart);

export default router;
