import express from "express";
import cors from "cors";
import morgan from "morgan";
import userRouter from "./routes/user.routes";
import orderRouter from "./routes/order.routes";
import inventoryRouter from "./routes/inventory.routes";

import productRouter from "./routes/product.routes";
import rawMaterialRouter from "./routes/rawMaterial.routes";
import productionRouter from "./routes/production.routes";
import dispatchRouter from "./routes/dispatch.routes";
import reportRouter from "./routes/report.routes";
import alertRouter from "./routes/alert.routes";

import dashboardRouter from "./routes/dashboard.routes";
import {
  DispatchStatus,
  OrderStatus,
  PrismaClient,
  ProductionStatus,
  StockStatus,
  UserRole,
  UserStatus,
} from "../generated/prisma";

const prisma = new PrismaClient();

const app = express();

// Middlewares
app.use(cors());
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/api/users", userRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/orders", orderRouter);
app.use("/api/inventory", inventoryRouter);
app.use("/api/products", productRouter);
app.use("/api/raw-materials", rawMaterialRouter);
app.use("/api/production", productionRouter);
app.use("/api/dispatch", dispatchRouter);
app.use("/api/reports", reportRouter);
app.use("/api/alerts", alertRouter);

export default app;
