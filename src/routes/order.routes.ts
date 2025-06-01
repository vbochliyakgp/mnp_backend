import express from "express";
import {
  createOrder,
  getOrders,
  getOrderBook,
  updateOrderStatus,
  getOrderDetails,
  updateOrderProducts,
} from "../controllers/order.controller";

const router = express.Router();

router.post("/", createOrder);
router.get("/", getOrders);
router.get("/book", getOrderBook);
router.patch("/:id/status", updateOrderStatus);

router.get("/:id", getOrderDetails);

// Update order status
router.patch("/:id/status", updateOrderStatus);

// Update order products
router.patch("/:id/products", updateOrderProducts);

export default router;
