import { Request, Response, NextFunction } from "express";
import { PrismaClient } from "../../generated/prisma";
import { ApiError } from "../utils/apiError";
import { successResponse } from "../utils/apiResponse";
const prisma = new PrismaClient();

export const getManufacturingDashboard = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Get today's orders count
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todaysOrdersCount = await prisma.order.count({
      where: {
        createdAt: {
          gte: today,
        },
      },
    });

    // Get production alerts
    const lowStockMaterials = await prisma.rawMaterial.findMany({
      where: {
        OR: [{ status: "LOW_STOCK" }, { status: "OUT_OF_STOCK" }],
      },
      take: 3,
    });

    const delayedProductions = await prisma.productionBatch.findMany({
      where: {
        status: "DELAYED",
      },
      include: {
        product: true,
      },
      take: 3,
    });

    const recentLargeOrders = await prisma.order.findMany({
      where: {
        items: {
          some: {
            quantity: {
              gt: 100,
            },
          },
        },
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
        },
      },
      include: {
        items: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 3,
    });

    // Get today's production schedule
    const todaysProduction = await prisma.productionBatch.findMany({
      where: {
        OR: [{ status: "IN_PROGRESS" }, { status: "PENDING" }],
        startDate: {
          gte: today,
        },
      },
      include: {
        product: true,
        order: true,
      },
      orderBy: {
        startDate: "asc",
      },
    });

    // Get raw material stock
    const rawMaterials = await prisma.rawMaterial.findMany();
    const totalRawMaterialStock = rawMaterials.reduce(
      (sum, material) => sum + material.stock,
      0
    );

    // Get ready for dispatch count
    const readyForDispatch = await prisma.dispatch.count({
      where: {
        status: "READY_FOR_PICKUP",
      },
    });

    // Get recent orders with totals
    const recentOrders = await prisma.order.findMany({
      orderBy: {
        createdAt: "desc",
      },
      include: {
        items: true,
        dispatch: true,
      },
      take: 5,
    });

    const formattedRecentOrders = recentOrders.map((order) => ({
      orderId: order.orderId,
      total: order.total,
      status: order.status,
      dispatchStatus: order.dispatch[0]?.status || "NOT_DISPATCHED",
    }));

    // Count completed and pending orders
    const completedOrdersCount = await prisma.order.count({
      where: {
        status: "COMPLETED",
      },
    });

    const pendingOrdersCount = await prisma.order.count({
      where: {
        status: "PENDING",
      },
    });

    // Prepare production alerts
    const productionAlerts = [
      ...lowStockMaterials.map((material) => ({
        type: "STOCK",
        message: `Low Stock: ${material.name} (${material.stock} ${material.unit} remaining)`,
        severity: material.status === "OUT_OF_STOCK" ? "CRITICAL" : "WARNING",
      })),
      ...delayedProductions.map((production) => ({
        type: "PRODUCTION",
        message: `Delayed Production: ${production.product.name} batch #${production.batchId}`,
        severity: "WARNING",
      })),
      ...recentLargeOrders.map((order) => ({
        type: "ORDER",
        message: `New bulk order received: ${order.items.reduce((sum, item) => sum + item.quantity, 0)} units`,
        severity: "INFO",
      })),
    ];

    // Prepare production schedule
    const productionSchedule = todaysProduction.map((batch) => ({
      productName: batch.product?.name || "Custom Product",
      batchId: batch.batchId,
      status: batch.status,
      quantity: batch.quantity,
      orderId: batch.order?.orderId || "Direct Production",
    }));

    successResponse(
      res,
      200,
      {
        todaysOrders: todaysOrdersCount,
        productionAlerts,
        productionSchedule,
        rawMaterialStock: totalRawMaterialStock,
        readyForDispatch,
        recentOrders: formattedRecentOrders,
        ordersStatus: {
          completed: completedOrdersCount,
          pending: pendingOrdersCount,
        },
      },
      "Dashboard data retrieved successfully"
    );
  } catch (error) {
    next(error);
  }
};

export const searchDashboard = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { query } = req.query;

    if (!query || typeof query !== "string") {
      throw new ApiError(400, "Search query is required");
    }

    // Search orders
    const orders = await prisma.order.findMany({
      where: {
        OR: [
          { orderId: { contains: query, mode: "insensitive" } },
          { customer: { name: { contains: query, mode: "insensitive" } } },
          {
            customer: {
              customerPhone: { contains: query, mode: "insensitive" },
            },
          },
        ],
      },
      include: {
        items: true,
        dispatch: true,
        customer: true,
      },
      take: 5,
    });

    // Search products
    const products = await prisma.product.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { itemId: { contains: query, mode: "insensitive" } },
        ],
      },
      take: 5,
    });

    // Search raw materials
    const rawMaterials = await prisma.rawMaterial.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { itemId: { contains: query, mode: "insensitive" } },
        ],
      },
      take: 5,
    });

    // Search customers directly
    const customersFound = await prisma.customer.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { customerPhone: { contains: query, mode: "insensitive" } },
        ],
      },
      select: {
        name: true,
        customerPhone: true,
      },
      take: 5,
    });

    const customers = customersFound.map((customer) => ({
      name: customer.name,
      phone: customer.customerPhone || "",
    }));

    successResponse(
      res,
      200,
      {
        orders,
        products,
        rawMaterials,
        customers,
      },
      "Search results retrieved successfully"
    );
  } catch (error) {
    next(error);
  }
};
