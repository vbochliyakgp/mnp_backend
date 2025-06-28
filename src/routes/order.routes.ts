import express from "express";
import {
  createOrder,
  createOrderByWhatsApp,
  getCustomerByWhatsApp,
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

// Standard order routes
router.post("/", createOrder);
router.get("/", getOrders);
router.get("/book", getOrderBook);
router.get("/:id", getOrderDetails);
router.patch("/:id/status", updateOrderStatus);
router.patch("/:id/products", updateOrderProducts);

// Status filtered routes
router.get("/pending", getPendingOrders);
router.get("/dispatched", getDispatchedOrders);
router.get("/cancelled", getCancelledOrders);

// Filter and search routes
router.get("/filter", filterOrders);
router.get("/filter/book", filterOrderBook);
router.get("/search", searchOrders);

// WhatsApp integration routes
router.post("/whatsapp", createOrderByWhatsApp);
router.get("/customer/:whatsapp", getCustomerByWhatsApp);

export default router;
