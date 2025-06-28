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

const dispatches = [
  {
    id: "dispatch1",
    dispatchId: "DIS001",
    orderId: "order1",
    userId: "user4",
    customer: "ABC Construction",
    status: DispatchStatus.DELIVERED,
    loadingDate: new Date("2023-05-19"),
    driverName: "John Driver",
    shippingAddress: "123 Main St, Cityville",
    carNumber: "TRK123",
    driverNumber: "+1122334455",
    carrier: "FastShip Logistics",
    transportation: "Third-party logistics",
    trackingId: "FS123456789",
    packageDetails: "120 packages, 2500kg total",
    remarks: "Delivered on time",
    createdAt: new Date("2023-05-19"),
    updatedAt: new Date("2023-05-20"),
  },
  {
    id: "dispatch2",
    dispatchId: "DIS002",
    orderId: "order4",
    userId: "user4",
    customer: "ABC Construction",
    status: DispatchStatus.IN_TRANSIT,
    loadingDate: new Date("2023-05-25"),
    driverName: "Mike Hauler",
    shippingAddress: "123 Main St, Cityville",
    carNumber: "GT5678",
    driverNumber: "+1987654321",
    carrier: "Global Transport",
    transportation: "Third-party logistics",
    trackingId: "GT987654321",
    packageDetails: "40 bundles, 800kg total",
    remarks: "In transit, expected delivery tomorrow",
    createdAt: new Date("2023-05-25"),
    updatedAt: new Date("2023-05-25"),
  },
];

app.get("/", async (req, res) => {
  await prisma.dispatch.create({
    data: dispatches[0],
  });

  res.status(200).json({ message: "Data seeded successfully" });
});

export default app;
