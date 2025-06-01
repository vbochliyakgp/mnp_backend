import express from "express";
import {
  createDispatch,
  getTodayDispatches,
  getAllDispatches,
  updateDispatchStatus,
} from "../controllers/dispatch.controller";

const router = express.Router();

router.post("/", createDispatch);
router.get("/today", getTodayDispatches);
router.get("/", getAllDispatches);
router.patch("/:id/status", updateDispatchStatus);

export default router;
