import express from "express";
import {
  getDashboardSummary,
  getSalesReport,
  getProductionReport,
  getInventoryReport,
  getCustomerAnalysis,
} from "../controllers/report.controller";

const router = express.Router();

// Main dashboard endpoint
router.get("/dashboard", getDashboardSummary);

// Individual report endpoints
router.get("/sales", getSalesReport);
router.get("/production", getProductionReport);
router.get("/inventory", getInventoryReport);
router.get("/customers", getCustomerAnalysis);

export default router;
