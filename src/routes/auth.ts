import { Router, RequestHandler } from "express";
import {
  register,
  login,
  refreshToken,
  logout,
} from "../controllers/authControllers";
import { authenticateToken } from "../middleware/auth";
import { AuthRequest } from "../types";

const router = Router();

router.post("/register", register as unknown as RequestHandler);

router.post("/login", login as unknown as RequestHandler);

router.post("/refresh", refreshToken as unknown as RequestHandler);

router.post("/logout", authenticateToken, logout as unknown as RequestHandler);

export default router;
