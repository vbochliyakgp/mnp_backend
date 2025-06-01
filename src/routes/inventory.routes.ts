import express from "express";
import {
  getInventorySummary,
  getLowStockAlerts,
  getTopSellingProducts,
} from "../controllers/inventory.controller";

const router = express.Router();

router.get("/summary", getInventorySummary);
router.get("/alerts", getLowStockAlerts);
router.get("/top-selling", getTopSellingProducts);

export default router;
