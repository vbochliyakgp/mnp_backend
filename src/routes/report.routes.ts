import express from "express";
import {
  getSalesReport,
  getInventoryReport,
} from "../controllers/report.controller";

const router = express.Router();

router.get("/sales", getSalesReport);
router.get("/inventory", getInventoryReport);

export default router;
