import { Router } from "express";
import {
  register,
  login,
  refreshToken,
  logout,
} from "../controllers/authControllers";
import { authenticateToken } from "../middleware/auth";
import { AuthRequest } from "../types";

const router = Router();

router.post("/register", register);

router.post("/login", login);

router.post("/refresh", refreshToken);

router.post("/logout", authenticateToken, logout);

export default router;
