import { Router } from "express";
import { getOrders, createOrder } from "../controllers/orderController";
import { authenticateToken, authorizeRoles } from "../middleware/auth";

const router = Router();

router.get("/", authenticateToken, getOrders);
router.post(
  "/",
  authenticateToken,
  authorizeRoles("ADMIN", "MANAGER", "SALES"),
  createOrder
);

export default router;
