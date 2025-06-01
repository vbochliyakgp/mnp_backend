import express from "express";
import {
  createDispatch,
  updateDispatchStatus,
  getDispatches,
} from "../controllers/dispatch.controller";

const router = express.Router();

router.post("/", createDispatch);
router.patch("/:id/status", updateDispatchStatus);
router.get("/", getDispatches);

export default router;
