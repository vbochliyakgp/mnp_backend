import express from "express";
import {
  getInventorySummary,
  addRawMaterial,
  addFinishedProduct,
  generateInventoryReport,
  getLowStockAlerts,
  getRawMaterials,
  getFinishedProducts,
  searchInventory,
} from "../controllers/inventory.controller";

const router = express.Router();

router.get("/summary", getInventorySummary);
router.get("/alerts", getLowStockAlerts);
router.post("/raw-materials", addRawMaterial);
router.get("/raw-materials", getRawMaterials);
router.post("/finished-products", addFinishedProduct);
router.get("/get-finished-products", getFinishedProducts);
router.get("/report", generateInventoryReport);
router.get("/search", searchInventory);

export default router;
