import express from "express";
import {
  getManufacturingDashboard,
  searchDashboard,
} from "../controllers/dashboard.controller";

const router = express.Router();

router.get("/", getManufacturingDashboard);
router.get("/search", searchDashboard);

export default router;
