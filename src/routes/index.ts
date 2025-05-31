import { Router } from "express";
import authRoutes from "./auth_routes";
import userRoutes from "./user.routes";
import panelRoutes from "./panel";
import controlRoutes from "./control_routes";
import flowRoutes from "./flow.route";
import mnpRoutes from "./mnp.routes";

const router = Router();

router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/panels", panelRoutes);
router.use("/controls", controlRoutes);
router.use("/flows", flowRoutes);
router.use("/mnp", mnpRoutes);

export default router;
