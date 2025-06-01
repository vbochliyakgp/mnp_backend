import express from "express";
import {
  createUser,
  getUsers,
  updateUserStatus,
} from "../controllers/user.controller";

const router = express.Router();

router.post("/", createUser);
router.get("/", getUsers);
router.patch("/:id/status", updateUserStatus);

export default router;
