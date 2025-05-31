import { Router } from "express";
import {
  createMNPRequest,
  getMNPRequests,
  getMNPRequestById,
  updateMNPRequestStatus,
  uploadMNPDocument,
} from "../controller/mnp.controller";
import { authenticate, authorize } from "../middleware/auth.middleware";

const router = Router();

router.use(authenticate);

router.post("/", createMNPRequest);
router.get("/", getMNPRequests);
router.get("/:id", getMNPRequestById);
router.put(
  "/:id/status",
  authorize(["ADMIN", "SUPER_ADMIN"]),
  updateMNPRequestStatus
);
router.post("/:id/documents", uploadMNPDocument);

export default router;
