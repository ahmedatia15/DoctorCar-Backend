import express from "express";
import { createPaymentLink } from "../paymob/paymob.controller.js";

const router = express.Router();

router.post("/pay", createPaymentLink);

export default router;

