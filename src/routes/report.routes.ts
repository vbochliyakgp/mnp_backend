import express from "express";
import {
  getDashboardSummary,
  getSalesReport,
  getProductionReport,
  getInventoryReport,
  getCustomerAnalysis,
} from "../controllers/report.controller";
import { requireEitherPageAccess } from "../middlewares/auth";

const router = express.Router();

// Main dashboard endpoint
router.get("/dashboard",requireEitherPageAccess(["dasboard"]), getDashboardSummary);

// Individual report endpoints
router.get("/sales", getSalesReport);
router.get("/production",requireEitherPageAccess(["inventory"]), getProductionReport);
router.get("/inventory",requireEitherPageAccess(["inventory"]), getInventoryReport);
router.get("/customers",requireEitherPageAccess(["admin"]), getCustomerAnalysis);

export default router;
