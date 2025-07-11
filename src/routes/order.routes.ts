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
import { requirePageAccess, requireEitherPageAccess } from "../middlewares/auth";

const router = express.Router();

// Standard order routes
router.post("/", requireEitherPageAccess(["orders"]), createOrder);
router.get("/", requireEitherPageAccess(["orders", "order-book"]), getOrders);
router.get("/book", requireEitherPageAccess(["order-book"]), getOrderBook);
router.get("/:id", requireEitherPageAccess(["orders", "order-book"]), getOrderDetails);
router.patch("/:id/status", requireEitherPageAccess(["orders"]), updateOrderStatus);
router.patch("/:id/products", requireEitherPageAccess(["orders"]), updateOrderProducts);

// Status filtered routes
router.get("/pending",requireEitherPageAccess(["orders", "order-book"]), getPendingOrders);
router.get("/dispatched", requireEitherPageAccess(["orders", "order-book"]), getDispatchedOrders);
router.get("/cancelled", requireEitherPageAccess(["orders", "order-book"]), getCancelledOrders);

// Filter and search routes
router.get("/filter", requireEitherPageAccess(["orders", "order-book"]), filterOrders);
router.get("/filter/book", requireEitherPageAccess(["order-book"]), filterOrderBook);
router.get("/search", requireEitherPageAccess(["orders", "order-book"]), searchOrders);

// routes for checking name and number

router.get("/customer/:whatsapp",requireEitherPageAccess(["orders"]), getCustomerByWhatsApp);
router.get("/customer/check-name/:name",requireEitherPageAccess(["orders"]), checkCustomerByName);

// update and delete item
router.patch('/item/:itemId',requireEitherPageAccess(["orders"]), updateItem);
router.delete('/item/:itemId',requireEitherPageAccess(["orders"]), deleteItem);


export default router;
