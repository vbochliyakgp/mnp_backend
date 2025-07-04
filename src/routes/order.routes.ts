import express from "express";
import {
  createOrder,
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
  checkCustomerByName,
  updateItem,
  deleteItem
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

// routes for checking name and number

router.get("/customer/:whatsapp", getCustomerByWhatsApp);
router.get("/customer/check-name/:name", checkCustomerByName);

// update and delete item
router.patch('/item/:itemId', updateItem);
router.delete('/item/:itemId', deleteItem);


export default router;
