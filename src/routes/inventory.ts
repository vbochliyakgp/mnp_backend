import { Router } from "express";
import { getInventory, updateStock } from "../controllers/inventoryController";
import { authenticateToken, authorizeRoles } from "../middleware/auth";

const router = Router();

router.get("/", authenticateToken, getInventory);
router.put(
  "/:id/stock",
  authenticateToken,
  authorizeRoles("ADMIN", "MANAGER"),
  updateStock
);

export default router;
