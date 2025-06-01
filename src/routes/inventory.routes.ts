import express from "express";
import {
  getInventorySummary,
  addRawMaterial,
  addFinishedProduct,
  generateInventoryReport,
  getLowStockAlerts,
} from "../controllers/inventory.controller";

const router = express.Router();

router.get("/summary", getInventorySummary);
router.get("/alerts", getLowStockAlerts);
router.post("/raw-materials", addRawMaterial);
router.post("/finished-products", addFinishedProduct);
router.get("/report", generateInventoryReport);

export default router;
