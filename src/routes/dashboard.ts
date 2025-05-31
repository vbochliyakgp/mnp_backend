import { Router } from "express";
import { getDashboardStats } from "../controllers/dashboardController";
import { authenticateToken } from "../middleware/auth";

const router = Router();

router.get("/stats", authenticateToken, getDashboardStats);

export default router;
