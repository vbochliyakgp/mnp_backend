import express from "express";
import { authenticate, requireAdminAccess } from "../middlewares/auth";
import * as userController from "../controllers/user.controller";

const router = express.Router();

// Public routes
router.post("/login", userController.loginUser);

// Protected Routes
router.use(authenticate);

router.get("/profile", userController.getCurrentUser);
router.get("/permissions/my", userController.getMyPermissions);

// Admin routes
router.put("/change-password", requireAdminAccess, userController.changePassword);
router.post("/", requireAdminAccess, userController.createUser);
router.get("/", requireAdminAccess, userController.getUsers);
router.delete("/:id", requireAdminAccess, userController.deleteUser);
router.get("/:id", requireAdminAccess, userController.getUser);
router.put("/:id", requireAdminAccess, userController.updateUser);
router.put("/:id/status", requireAdminAccess, userController.updateUserStatus);

export default router;
