import express from "express";
import {
  createCustomer,
  getCustomers,
  getCustomerById,
} from "../controllers/customer.controller";

const router = express.Router();

router.post("/", createCustomer);
router.get("/", getCustomers);
router.get("/:id", getCustomerById);

export default router;
