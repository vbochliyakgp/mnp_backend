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
        items: true, // Include the items relation
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
    const readyForDispatch = await prisma.order.count({
      where: {
        status: "COMPLETED",
        dispatch: null,
      },
    });

    // Get recent orders with totals
    const recentOrders = await prisma.order.findMany({
      orderBy: {
        createdAt: "desc",
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
      take: 5,
    });

    const formattedRecentOrders = recentOrders.map((order) => ({
      orderId: order.orderId,
      total: order.total,
      productName: order.items[0]?.product?.name || "Multiple Products",
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
        message: `Low Stock: ${material.name} (${material.stock} ${material.category.includes("sq") ? "sq meters" : "units"} remaining)`,
        completed: false,
      })),
      ...delayedProductions.map((production) => ({
        type: "PRODUCTION",
        message: `Delayed Production: ${production.product.name} batch #${production.batchId}`,
        completed: true,
      })),
      ...recentLargeOrders.map((order) => ({
        type: "ORDER",
        message: `New bulk order received: ${order.items.reduce((sum, item) => sum + item.quantity, 0)} units`,
        completed: true,
      })),
    ];

    // Prepare production schedule
    const productionSchedule = todaysProduction.map((batch) => ({
      productName: batch.product.name,
      batchId: batch.batchId,
      status: batch.status,
      quantity: batch.quantity,
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
          { orderId: { contains: query } },
          { customer: { contains: query } },
        ],
      },
      take: 5,
    });

    // Search products
    const products = await prisma.product.findMany({
      where: {
        name: { contains: query },
      },
      take: 5,
    });

    // Search customers by looking at unique customers in orders
    const customerOrders = await prisma.order.findMany({
      where: {
        customer: { contains: query },
      },
      select: {
        customer: true,
      },
      distinct: ["customer"],
      take: 5,
    });

    const customers = customerOrders.map((order) => ({
      name: order.customer,
      phone: "", // Customer phone is not stored separately in the current schema
    }));

    successResponse(
      res,
      200,
      {
        orders,
        products,
        customers,
      },
      "Search results retrieved successfully"
    );
  } catch (error) {
    next(error);
  }
};
