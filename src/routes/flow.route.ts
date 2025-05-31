import { Router } from "express";
import {
  createFlow,
  getFlowsForPanel,
  getFlowById,
  updateFlow,
  deleteFlow,
  executeFlow,
  getFlowExecutions,
} from "../controller/flow.controller";
import { authenticate } from "../middleware/auth.middleware";

const router = Router();

router.use(authenticate);

router.post("/", createFlow);
router.get("/panel/:panelId", getFlowsForPanel);
router.get("/:id", getFlowById);
router.put("/:id", updateFlow);
router.delete("/:id", deleteFlow);
router.post("/:id/execute", executeFlow);
router.get("/:id/executions", getFlowExecutions);

export default router;
