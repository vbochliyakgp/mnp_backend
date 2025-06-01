import express from "express";
import {
  createProductionBatch,
  updateProductionStatus,
  getProductionSchedule,
} from "../controllers/production.controller";

const router = express.Router();

router.post("/", createProductionBatch);
router.patch("/:id/status", updateProductionStatus);
router.get("/schedule", getProductionSchedule);

export default router;
