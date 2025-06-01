import express from "express";
import {
  getSystemSettings,
  updateSystemSetting,
} from "../controllers/system.controller";

const router = express.Router();

router.get("/", getSystemSettings);
router.put("/:key", updateSystemSetting);

export default router;
