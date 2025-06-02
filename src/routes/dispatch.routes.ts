import express from "express";
import {
  createDispatch,
  getTodayDispatches,
  getAllDispatches,
  updateDispatchStatus,
  searchShipments,
  getDeliveredShipments,
  getInTransitShipments,
} from "../controllers/dispatch.controller";
import { searchOrders } from "../controllers/order.controller";

const router = express.Router();

router.post("/", createDispatch);
router.get("/today", getTodayDispatches);
router.get("/", getAllDispatches);
router.patch("/:id/status", updateDispatchStatus);
router.get("/search-shipment", searchShipments);
router.get("/delivered", getDeliveredShipments);
router.get("/in-transit", getInTransitShipments);

export default router;
