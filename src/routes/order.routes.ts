import express from "express";
import {
  createOrder,
  getOrders,
  getOrderBook,
  updateOrderStatus,
} from "../controllers/order.controller";

const router = express.Router();

router.post("/", createOrder);
router.get("/", getOrders);
router.get("/book", getOrderBook);
router.patch("/:id/status", updateOrderStatus);

export default router;
