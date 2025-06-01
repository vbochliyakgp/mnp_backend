import express from "express";
import { getAlerts, markAlertAsRead } from "../controllers/alert.controller";

const router = express.Router();

router.get("/", getAlerts);
router.patch("/:id/read", markAlertAsRead);

export default router;
