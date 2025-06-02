import express from "express";
import {
  createOrder,
  getOrders,
  getOrderBook,
  updateOrderStatus,
  getOrderDetails,
  updateOrderProducts,
  getPendingOrders,
  getDispatchedOrders,
  getCancelledOrders,
  filterOrders,
  filterOrderBook,
  searchOrders,
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

router.get("/pending", getPendingOrders);
router.get("/dispatched", getDispatchedOrders);
router.get("/cancelled", getCancelledOrders);

router.get("/filter", filterOrders);
router.get("/filter/getBook", filterOrderBook); // use this route to filter in both orders and order book

router.get("/search-orders-book", searchOrders);

export default router;
