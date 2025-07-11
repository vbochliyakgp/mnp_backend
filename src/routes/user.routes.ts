import express from "express";
import { authenticate, requireAdminAccess } from "../middlewares/auth";
import * as userController from "../controllers/user.controller";

const router = express.Router();

// Public routes
router.post("/login", userController.loginUser);

// Protected Routes
router.use(authenticate);

// Get available pages
router.get("/pages", userController.getAvailablePages);

// User's own profile and permissions
router.get("/profile", userController.getCurrentUser);
router.put("/profile", userController.updateUser);
router.put("/change-password", userController.changePassword);
router.get("/permissions/my", userController.getMyPermissions);
router.put("/permissions/my", userController.updateMyPermissions);

// Admin routes (require admin page access)
router.post("/", requireAdminAccess, userController.createUser);
router.get("/", requireAdminAccess, userController.getUsers);
router.get("/:id", requireAdminAccess, userController.getUser);
router.put("/:id", requireAdminAccess, userController.updateUser);
router.put("/:id/status", requireAdminAccess, userController.updateUserStatus);

export default router;
