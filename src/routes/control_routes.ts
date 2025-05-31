import { Router } from "express";
import {
  createControl,
  getControlsForPanel,
  getControlById,
  updateControl,
  deleteControl,
  getControlLogs,
} from "../controller/control.controller";
import { authenticate } from "../middleware/auth.middleware";

const router = Router();

router.use(authenticate);

router.post("/", createControl);
router.get("/panel/:panelId", getControlsForPanel);
router.get("/:id", getControlById);
router.put("/:id", updateControl);
router.delete("/:id", deleteControl);
router.get("/:id/logs", getControlLogs);

export default router;
