import express from "express";
import {
  createRawMaterial,
  getRawMaterials,
  updateRawMaterialStock,
} from "../controllers/rawMaterial.controller";

const router = express.Router();

router.post("/", createRawMaterial);
router.get("/", getRawMaterials);
router.patch("/:id/stock", updateRawMaterialStock);

export default router;
