import express from "express";
import {
  createProduct,
  getProducts,
  updateProductStock,
} from "../controllers/product.controller";

const router = express.Router();

router.post("/", createProduct);
router.get("/", getProducts);
router.patch("/:id/stock", updateProductStock);

export default router;
