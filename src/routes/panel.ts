import { Router } from "express";
import {
  createPanel,
  getPanels,
  getPanelById,
  updatePanel,
  deletePanel,
  assignPanelToUser,
  getPanelMetrics,
} from "../controller/panelController";
import { authenticate, authorize } from "../middleware/auth.middleware";

const router = Router();

router.use(authenticate);

router.post("/", authorize(["ADMIN", "SUPER_ADMIN"]), createPanel);
router.get("/", getPanels);
router.get("/:id", getPanelById);
router.put("/:id", updatePanel);
router.delete("/:id", authorize(["ADMIN", "SUPER_ADMIN"]), deletePanel);
router.post(
  "/:panelId/assign",
  authorize(["ADMIN", "SUPER_ADMIN"]),
  assignPanelToUser
);
router.get("/:id/metrics", getPanelMetrics);

export default router;
