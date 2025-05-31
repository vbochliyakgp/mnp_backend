import { Response } from "express";
import { AuthRequest } from "../types";
import { PrismaClient } from "../../generated/prisma/client";
const prisma = new PrismaClient();

export const getDashboardStats = async (req: AuthRequest, res: Response) => {
  try {
    // Get current month's data
    const currentMonth = new Date();
    const startOfMonth = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth(),
      1
    );
    const endOfMonth = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth() + 1,
      0
    );

    // Total revenue
    const totalRevenue = await prisma.order.aggregate({
      where: {
        date: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
        status: "COMPLETED",
      },
      _sum: {
        total: true,
      },
    });

    // Orders completed
    const ordersCompleted = await prisma.order.count({
      where: {
        date: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
        status: "COMPLETED",
      },
    });

    // Active customers
    const activeCustomers = await prisma.order.findMany({
      where: {
        date: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
      select: {
        customerId: true,
      },
      distinct: ["customerId"],
    });

    // Production units
    const productionUnits = await prisma.productionBatch.aggregate({
      where: {
        createdAt: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
        status: "COMPLETED",
      },
      _sum: {
        quantity: true,
      },
    });

    // Top selling products
    const topProducts = await prisma.orderItem.groupBy({
      by: ["productId"],
      _sum: {
        quantity: true,
      },
      orderBy: {
        _sum: {
          quantity: "desc",
        },
      },
      take: 4,
    });

    const topProductsWithDetails = await Promise.all(
      topProducts.map(async (item) => {
        const product = await prisma.product.findUnique({
          where: { id: item.productId },
        });
        return {
          name: product?.name || "Unknown",
          units: item._sum.quantity || 0,
        };
      })
    );

    res.json({
      totalRevenue: totalRevenue._sum.total || 0,
      ordersCompleted,
      activeCustomers: activeCustomers.length,
      productionUnits: productionUnits._sum.quantity || 0,
      topSellingProducts: topProductsWithDetails,
    });
  } catch (error) {
    console.error("Dashboard stats error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
